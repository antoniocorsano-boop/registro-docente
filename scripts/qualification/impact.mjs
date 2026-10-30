import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const REGISTRY_PATH = 'qualification/invariants.v1.json';

function usage() {
  console.error('usage: bun scripts/qualification/impact.mjs <baseSha> <candidateSha> [--tests | --manifest <path>]');
  process.exit(2);
}

const [baseSha, candidateSha, mode, modeValue] = process.argv.slice(2);
if (!baseSha || !candidateSha) usage();
if (mode && !['--tests', '--manifest'].includes(mode)) usage();
if (mode === '--manifest' && !modeValue) usage();

const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));

function pathMatches(path, pattern) {
  if (pattern.endsWith('/')) return path.startsWith(pattern);
  return path === pattern;
}

function gitDiffNames(base, head) {
  const output = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], {
    encoding: 'utf8'
  });
  return Array.from(new Set(output.split(/\r?\n/).map(value => value.trim()).filter(Boolean))).sort();
}

function registryAtCommit(commitSha) {
  const object = `${commitSha}:${REGISTRY_PATH}`;
  try {
    execFileSync('git', ['cat-file', '-e', object], {
      stdio: ['ignore', 'ignore', 'ignore']
    });
  } catch {
    return null;
  }

  // Read the published baseline registry with `git show <baseSha>:<path>`.
  const source = execFileSync('git', ['show', object], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return JSON.parse(source);
}

function enforcePublishedInvariantStability(baseRegistry, candidateRegistry) {
  if (!baseRegistry) return [];

  const candidateById = new Map(
    (candidateRegistry.invariants ?? []).map(invariant => [invariant.id, invariant])
  );
  const checked = [];
  let failed = false;

  for (const published of baseRegistry.invariants ?? []) {
    const candidate = candidateById.get(published.id);
    if (!candidate) {
      console.error(`QUAL_INVARIANT_REMOVED ${published.id}`);
      failed = true;
      continue;
    }

    checked.push(published.id);
    if (candidate.owner !== published.owner || candidate.statement !== published.statement) {
      console.error(`QUAL_INVARIANT_SEMANTICS_CHANGED ${published.id}`);
      failed = true;
    }
  }

  if (failed) process.exit(1);
  return checked.sort();
}

const baseRegistry = registryAtCommit(baseSha);
const stableInvariantIdsChecked = enforcePublishedInvariantStability(baseRegistry, registry);

let changedPaths;
try {
  changedPaths = gitDiffNames(baseSha, candidateSha);
} catch (error) {
  console.error(`QUAL_INVARIANT_IMPACT_ERROR unable to diff ${baseSha}...${candidateSha}`);
  throw error;
}

const affected = [];
const uncoveredGuardedPaths = [];

for (const invariant of registry.invariants ?? []) {
  const matchingPaths = changedPaths.filter(path =>
    (invariant.impactPaths ?? []).some(pattern => pathMatches(path, pattern))
  );
  if (matchingPaths.length > 0) affected.push({ invariant, matchingPaths });
}

for (const changedPath of changedPaths) {
  const guarded = (registry.guardedRoots ?? []).some(root => pathMatches(changedPath, root));
  if (!guarded) continue;
  const covered = affected.some(entry => entry.matchingPaths.includes(changedPath));
  if (!covered) uncoveredGuardedPaths.push(changedPath);
}

if (uncoveredGuardedPaths.length > 0) {
  console.error('QUAL_INVARIANT_UNCOVERED_GUARDED_PATHS');
  for (const path of uncoveredGuardedPaths) console.error(`- ${path}`);
  process.exit(1);
}

const affectedInvariantIds = affected.map(entry => entry.invariant.id).sort();
const testFiles = Array.from(new Set(
  affected.flatMap(entry => entry.invariant.tests ?? [])
)).sort();
const browserSmokeFiles = Array.from(new Set(
  affected.flatMap(entry => entry.invariant.browserSmoke ?? [])
)).sort();

const manifest = {
  schemaVersion: 1,
  baseSha,
  candidateSha,
  baseRegistryPresent: Boolean(baseRegistry),
  stableInvariantIdsChecked,
  changedPaths,
  affectedInvariantIds,
  testFiles,
  browserSmokeFiles,
  qualificationStatus: 'IMPACT_DERIVED'
};

if (mode === '--tests') {
  process.stdout.write(testFiles.join(' '));
} else if (mode === '--manifest') {
  writeFileSync(modeValue, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`QUAL_INVARIANT_MANIFEST_WRITTEN ${modeValue}`);
} else {
  console.log(JSON.stringify(manifest, null, 2));
}
