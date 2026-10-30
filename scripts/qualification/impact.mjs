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
