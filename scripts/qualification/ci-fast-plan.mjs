/**
 * CI-FAST-01: deterministic, advisory development checks for stacked PRs.
 *
 * This planner never qualifies a candidate for merge, publication or Android
 * installation. The existing main-targeted qualification workflows remain
 * the sole full automated evidence for a final exact SHA.
 *
 * Inputs: exact-SHA qualification/impact.mjs manifest.
 * Output: bounded checks to run during ordinary development.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9_./-]+$/;
const BUN_TEST = /(?:^|\/)[^/]+\.test\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const ROOT_APP = /^(?:src\/|vendor\/|server\.ts$|vite\.config\.ts$|index\.html$|package\.json$|bun\.lock$|public\/)/;
const TS_SCOPE = /^(?:src\/|vendor\/|server\.ts$|vite\.config\.ts$|tests\/browser\/fixtures\/|package\.json$|bun\.lock$)/;
const APP_BUILD = /^(?:src\/(?!.*\.test\.[cm]?[jt]sx?$)|vendor\/|server\.ts$|vite\.config\.ts$|index\.html$|package\.json$|bun\.lock$|public\/)/;
const HIGH_RISK = /^(?:src\/(?:security|persistence|assessment)\/|mobile\/|scripts\/diagnostics\/|\.github\/workflows\/|server\.ts$|package\.json$|bun\.lock$|qualification\/)/;
const UI_RELATED = /^(?:src\/(?:components|views|App\.tsx)|tests\/browser\/|public\/|index\.html$|vite\.config\.ts$)/;

function checkPath(p, role) {
  if (typeof p !== 'string' || !SAFE_PATH.test(p) || p.includes('\\')) {
    throw new Error(`CI_FAST_INVALID_${role}_PATH: ${String(p)}`);
  }
  return p;
}
function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'en'));
}

export function buildFastPlan(manifest, available = existsSync) {
  if (!manifest || manifest.schemaVersion !== 1 ||
      !SHA.test(manifest.baseSha) || !SHA.test(manifest.candidateSha) ||
      !Array.isArray(manifest.changedPaths) ||
      !Array.isArray(manifest.testFiles) ||
      !Array.isArray(manifest.affectedInvariantIds) ||
      !Array.isArray(manifest.browserSmokeFiles)) {
    throw new Error('CI_FAST_INVALID_IMPACT_MANIFEST');
  }
  const changedPaths = sortedUnique(manifest.changedPaths.map(p => checkPath(p, 'CHANGED')));
  const inheritedTests = sortedUnique(manifest.testFiles.map(p => checkPath(p, 'INHERITED_TEST')));
  const changedTests = changedPaths.filter(p => BUN_TEST.test(p) && !p.startsWith('tests/browser/'));
  const testFiles = sortedUnique([...inheritedTests, ...changedTests]);
  for (const p of testFiles) {
    if (!BUN_TEST.test(p) || p.startsWith('tests/browser/')) {
      throw new Error(`CI_FAST_NON_BUN_TEST: ${p}. Browser evidence belongs in a dedicated browser gate.`);
    }
    if (!available(p)) {
      throw new Error(`CI_FAST_MISSING_TEST: ${p}`);
    }
  }
  const typecheck = changedPaths.some(p => TS_SCOPE.test(p));
  const build = changedPaths.some(p => APP_BUILD.test(p));
  const needBun = typecheck || build || testFiles.length > 0;
  const highRiskPaths = changedPaths.filter(p => HIGH_RISK.test(p));
  const browserRelatedPaths = changedPaths.filter(p => UI_RELATED.test(p));
  const changedNodeScripts = changedPaths.filter(p =>
    p.startsWith('scripts/qualification/') && p.endsWith('.mjs') && available(p));
  return {
    schemaVersion: 1,
    status: 'DEVELOPMENT_ONLY_NOT_QUALIFIED',
    baseSha: manifest.baseSha,
    candidateSha: manifest.candidateSha,
    changedPaths,
    affectedInvariantIds: sortedUnique(manifest.affectedInvariantIds),
    testFiles,
    changedNodeScripts,
    checks: {
      registry: true,
      impact: true,
      syntax: changedNodeScripts.length > 0,
      typecheck,
      build,
      bunTests: testFiles.length > 0
    },
    needBun,
    escalation: {
      requiresCompleteExactShaGateBeforeIntegration: true,
      highRiskPaths,
      browserRelatedPaths,
      nativeOrEncryptionRelated: changedPaths.some(p =>
        /^(?:mobile\/|src\/(?:security|persistence)\/|scripts\/diagnostics\/)/.test(p))
    },
    caveat: 'Fast checks are advisory. All applicable full main-branch qualification, independent review and physical Android release gates remain unchanged.'
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [, , manifestPath, outputPath] = process.argv;
  if (!manifestPath || !outputPath) {
    console.error('usage: node scripts/qualification/ci-fast-plan.mjs <impact-manifest.json> <ci-fast-plan.json>');
    process.exit(2);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (process.env.CANDIDATE_SHA && process.env.CANDIDATE_SHA !== manifest.candidateSha) {
    throw new Error('CI_FAST_CANDIDATE_SHA_MISMATCH');
  }
  if (process.env.BASE_SHA && process.env.BASE_SHA !== manifest.baseSha) {
    throw new Error('CI_FAST_BASE_SHA_MISMATCH');
  }
  const plan = buildFastPlan(manifest);
  writeFileSync(outputPath, JSON.stringify(plan, null, 2) + '\n');
  console.log(`CI_FAST_PLAN: ${plan.testFiles.length} inherited/changed contract files, typecheck=${plan.checks.typecheck}, build=${plan.checks.build}, highRisk=${plan.escalation.highRiskPaths.length > 0}`);
  console.log('CI_FAST_NOT_FULL_QUALIFICATION');
}
