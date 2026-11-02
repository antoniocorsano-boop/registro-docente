import { describe, expect, test } from 'bun:test';

const registry = await Bun.file(
  new URL('../../qualification/invariants.v1.json', import.meta.url)
).json() as {
  invariants: Array<{
    id: string;
    owner: string;
    statement: string;
    impactPaths: string[];
    tests: string[];
  }>;
};

describe('CTX-01 qualification invariant', () => {
  test('publishes the canonical professional-context invariant', () => {
    const invariant = registry.invariants.find(entry => entry.id === 'CTX-01-I01');

    expect(invariant).toBeDefined();
    expect(invariant?.owner).toBe('CTX-01');
    expect(invariant?.statement).toContain('session-only');
    expect(invariant?.statement).toContain('deterministic');
    expect(invariant?.statement).toContain('minimised');
    expect(invariant?.statement).toContain('fail closed');
  });

  test('covers product wiring, CTX-01 contracts and inherited context/privacy contracts', () => {
    const invariant = registry.invariants.find(entry => entry.id === 'CTX-01-I01');
    const impactPaths = new Set(invariant?.impactPaths ?? []);
    const tests = new Set(invariant?.tests ?? []);

    expect(impactPaths.has('qualification/invariants.v1.json')).toBe(true);
    expect(impactPaths.has('src/App.tsx')).toBe(true);
    expect(impactPaths.has('src/context/professionalContext.ts')).toBe(true);
    expect(impactPaths.has('src/security/ctx01ProfessionalContext.test.ts')).toBe(true);
    expect(impactPaths.has('src/security/ctx01AppIntegrationContract.test.ts')).toBe(true);
    expect(impactPaths.has('src/security/ctx01QualificationContract.test.ts')).toBe(true);
    expect(impactPaths.has('src/security/librarySingleCopilotSurfaceContract.test.ts')).toBe(true);
    expect(impactPaths.has('src/security/aic01ContextPrivacyContract.test.ts')).toBe(true);

    expect(tests.has('src/security/ctx01ProfessionalContext.test.ts')).toBe(true);
    expect(tests.has('src/security/ctx01AppIntegrationContract.test.ts')).toBe(true);
    expect(tests.has('src/security/ctx01QualificationContract.test.ts')).toBe(true);
    expect(tests.has('src/security/librarySingleCopilotSurfaceContract.test.ts')).toBe(true);
    expect(tests.has('src/security/aic01ContextPrivacyContract.test.ts')).toBe(true);
  });
});