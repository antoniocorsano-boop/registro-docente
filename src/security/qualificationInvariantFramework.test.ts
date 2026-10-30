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

  test('the full browser qualification runs the fast invariant smoke before the expensive AIC-07 suite', () => {
    const path = '.github/workflows/browser-qualification.yml';
    const source = readFileSync(path, 'utf8');
    const smoke = source.indexOf('Run qualification invariant smoke');
    const aic07 = source.indexOf('Run dedicated AIC-07 Chromium qualification');
    expect(smoke).toBeGreaterThan(-1);
    expect(aic07).toBeGreaterThan(smoke);
  });
});
