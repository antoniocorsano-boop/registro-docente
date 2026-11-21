import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { buildFastPlan } from './ci-fast-plan.mjs';

const base='a'.repeat(40),head='b'.repeat(40);
const fixture=(changedPaths,testFiles=[],affectedInvariantIds=['CI-FAST-01-I01'])=>({
 schemaVersion:1,baseSha:base,candidateSha:head,changedPaths,
 testFiles,affectedInvariantIds,browserSmokeFiles:[],qualificationStatus:'IMPACT_DERIVED'
});
const exists=()=>true;

describe('CI-FAST-01 risk-proportional development gate',()=>{
 test('documentation-only branch needs neither Bun installation nor full suite',()=>{
  const plan=buildFastPlan(fixture(['docs/qualification/OPERATING_PROTOCOL.md'],[],[]),exists);
  expect(plan.needBun).toBe(false);
  expect(plan.checks.typecheck).toBe(false);
  expect(plan.checks.build).toBe(false);
  expect(plan.status).toBe('DEVELOPMENT_ONLY_NOT_QUALIFIED');
  expect(plan.escalation.requiresCompleteExactShaGateBeforeIntegration).toBe(true);
 });
 test('a small UI change runs inherited contracts, TypeScript and build, not native emulators',()=>{
  const plan=buildFastPlan(fixture(['src/components/DailyMatrixWorkspace.tsx'],
   ['src/security/val01Product04PlannedLifecycle.test.ts']),exists);
  expect(plan.testFiles).toEqual(['src/security/val01Product04PlannedLifecycle.test.ts']);
  expect(plan.checks.typecheck).toBe(true);
  expect(plan.checks.build).toBe(true);
  expect(plan.escalation.browserRelatedPaths).toEqual(['src/components/DailyMatrixWorkspace.tsx']);
  expect(plan.escalation.nativeOrEncryptionRelated).toBe(false);
  expect(plan.escalation.browserSmokeFiles).toEqual([]);
 });
 test('inherited browser-smoke files remain visible as deferred obligations for feature acceptance',()=>{
  const manifest={...fixture(['src/components/Example.tsx'],
   ['src/security/exampleContract.test.ts']),browserSmokeFiles:['tests/browser/example-smoke.spec.cjs']};
  const plan=buildFastPlan(manifest,exists);
  expect(plan.escalation.browserSmokeFiles).toEqual(['tests/browser/example-smoke.spec.cjs']);
  expect(plan.testFiles).toEqual(['src/security/exampleContract.test.ts']);
  expect(plan.status).toBe('DEVELOPMENT_ONLY_NOT_QUALIFIED');
 });
 test('sensitive changes are prominently escalated but remain fast for interim development',()=>{
  const plan=buildFastPlan(fixture(['src/security/secureVault.ts','src/persistence/commit.ts'],
   ['src/security/vaultContract.test.ts']),exists);
  expect(plan.escalation.nativeOrEncryptionRelated).toBe(true);
  expect(plan.escalation.highRiskPaths).toHaveLength(2);
  expect(plan.escalation.requiresCompleteExactShaGateBeforeIntegration).toBe(true);
  expect(plan.checks.bunTests).toBe(true);
 });
 test('workflow-only changes run their invariant contract but no gratuitous Android or UI suite',()=>{
  const plan=buildFastPlan(fixture(['.github/workflows/ci-fast-development.yml'],
   ['scripts/qualification/ci-fast-plan.test.mjs']),exists);
  expect(plan.testFiles).toEqual(['scripts/qualification/ci-fast-plan.test.mjs']);
  expect(plan.needBun).toBe(true);
  expect(plan.checks.typecheck).toBe(false);
  expect(plan.checks.build).toBe(false);
  expect(plan.escalation.highRiskPaths).toHaveLength(1);
 });
 test('changed unit tests are directly selected without running all 1900 security tests',()=>{
  const plan=buildFastPlan(fixture(['src/security/example.test.ts'],[],[]),exists);
  expect(plan.testFiles).toEqual(['src/security/example.test.ts']);
  expect(plan.checks.bunTests).toBe(true);
 });
 test('a browser specification cannot run accidentally in the Bun-only inherited gate',()=>{
  expect(()=>buildFastPlan(fixture(['tests/browser/feature.spec.cjs'],
   ['tests/browser/feature.spec.cjs']),exists)).toThrow('CI_FAST_NON_BUN_TEST');
 });
 test('missing test, forged paths and malformed candidate references fail closed',()=>{
  expect(()=>buildFastPlan(fixture(['src/components/X.tsx'],['src/security/missing.test.ts']),()=>false))
   .toThrow('CI_FAST_MISSING_TEST');
  expect(()=>buildFastPlan(fixture(['../src/App.tsx']),exists)).toThrow('CI_FAST_INVALID_CHANGED_PATH');
  expect(()=>buildFastPlan({...fixture(['src/App.tsx']),candidateSha:'not-a-sha'},exists)).toThrow('CI_FAST_INVALID_IMPACT_MANIFEST');
 });
 test('new fast workflow never disables existing main-targeted full gates',()=>{
  const fast=readFileSync('.github/workflows/ci-fast-development.yml','utf8');
  const full=readFileSync('.github/workflows/beta2-reference-qualification.yml','utf8');
  const native=readFileSync('.github/workflows/val01-native-evidence.yml','utf8');
  const invariant=readFileSync('.github/workflows/qualification-invariants.yml','utf8');
  expect(fast).toContain("branches-ignore: ['main']");
  expect(fast).toContain('cancel-in-progress: true');
  expect(fast).toContain('persist-credentials: false');
  expect(fast).toContain('CI_FAST_NOT_FULL_QUALIFICATION');
  expect(fast).not.toContain('pull_request_target:');
  expect(fast).not.toContain('permissions: write-all');
  expect(full).toContain("branches: ['main']");
  expect(full).toContain('Complete security and memory test suite');
  expect(full).toContain('Run real Chromium navigation regressions');
  expect(native).toContain('matrix:');
  expect(native).toContain('api: [32, 36]');
  expect(native).toContain('mode: [legacy, v9]');
  expect(invariant).toContain('Run inherited invariant contracts');
 });
});
