import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';

const REQUIRED_FILES = [
  'qualification/invariants.v1.json',
  'scripts/qualification/check-invariants.mjs',
  'scripts/qualification/impact.mjs',
  '.github/workflows/qualification-invariants.yml',
  'tests/browser/qualification-invariant-smoke.spec.cjs'
] as const;

describe('QUAL-INVARIANT-01 canonical qualification invariant framework', () => {
  test('materializes the machine-readable registry, impact gate, exact-SHA workflow and fast browser smoke', () => {
    for (const path of REQUIRED_FILES) {
      expect(existsSync(path), `missing ${path}`).toBe(true);
    }
  });

  test('the registry names stable invariant ids and binds each invariant to executable evidence', () => {
    const path = 'qualification/invariants.v1.json';
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;

    const registry = JSON.parse(readFileSync(path, 'utf8')) as {
      schemaVersion?: number;
      guardedRoots?: string[];
      invariants?: Array<{ id?: string; tests?: string[]; impactPaths?: string[] }>;
    };
    expect(registry.schemaVersion).toBe(1);
    expect(registry.invariants?.length ?? 0).toBeGreaterThan(0);

    const ids = (registry.invariants ?? []).map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const invariant of registry.invariants ?? []) {
      expect(invariant.id).toMatch(/^[A-Z0-9-]+-I\d{2}$/);
      expect(invariant.tests?.length ?? 0).toBeGreaterThan(0);
      expect(invariant.impactPaths?.length ?? 0).toBeGreaterThan(0);
    }
  });

  test('all product source, browser qualification and workflow changes are fail-closed until classified', () => {
    const registry = JSON.parse(readFileSync('qualification/invariants.v1.json', 'utf8')) as {
      guardedRoots?: string[];
    };
    const roots = new Set(registry.guardedRoots ?? []);
    expect(roots.has('src/')).toBe(true);
    expect(roots.has('tests/browser/')).toBe(true);
    expect(roots.has('.github/workflows/')).toBe(true);
    expect(roots.has('vendor/')).toBe(true);
  });

  test('published invariant ids cannot disappear or silently change owner or statement relative to the base registry', () => {
    const source = readFileSync('scripts/qualification/impact.mjs', 'utf8');
    expect(source).toContain('QUAL_INVARIANT_REMOVED');
    expect(source).toContain('QUAL_INVARIANT_SEMANTICS_CHANGED');
    expect(source).toContain('git show');
  });

  test('PREDEPLOY derives exact-SHA impact, runs inherited contracts and emits an inspectable manifest', () => {
    const source = readFileSync('.github/workflows/predeploy-security-qualification.yml', 'utf8');
    expect(source).toContain('fetch-depth: 0');
    expect(source).toContain('Validate invariant registry');
    expect(source).toContain('Derive invariant impact and manifest');
    expect(source).toContain('Run inherited invariant contracts');
    expect(source).toContain('qualification-manifest.json');
    expect(source).toContain('CANDIDATE_SHA');
  });

  test('the full browser qualification runs the fast invariant smoke before the expensive AIC-07 suite', () => {
    const path = '.github/workflows/browser-qualification.yml';
    const source = readFileSync(path, 'utf8');
    const smoke = source.indexOf('Run qualification invariant smoke');
    const aic07 = source.indexOf('Run dedicated AIC-07 Chromium qualification');
    expect(smoke).toBeGreaterThan(-1);
    expect(aic07).toBeGreaterThan(smoke);
  });
});
