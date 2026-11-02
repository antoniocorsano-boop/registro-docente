import { describe, expect, test } from 'bun:test';

const TODAY_STATEMENT = 'Home/Oggi is a session-only task router: it never infers class context, never persists task intent, preserves expert Home views, and routes only to existing authoritative specialist surfaces after explicit teacher choices.';

const registry = await Bun.file(
  new URL('../../qualification/invariants.v1.json', import.meta.url)
).json() as {
  invariants: Array<{
    id: string;
    owner: string;
    statement: string;
    impactPaths: string[];
    tests: string[];
    browserSmoke?: string[];
  }>;
};

const navbar = await Bun.file('src/components/Navbar.tsx').text();

describe('TODAY-01 qualification invariant', () => {
  test('publishes the canonical Oggi session-only router invariant', () => {
    const invariant = registry.invariants.find(entry => entry.id === 'TODAY-01-I01');

    expect(invariant).toBeDefined();
    expect(invariant?.owner).toBe('TODAY-01');
    expect(invariant?.statement).toBe(TODAY_STATEMENT);
  });

  test('covers every TODAY-01 product and contract path', () => {
    const invariant = registry.invariants.find(entry => entry.id === 'TODAY-01-I01');
    const impactPaths = new Set(invariant?.impactPaths ?? []);

    for (const path of [
      'qualification/invariants.v1.json',
      'src/App.tsx',
      'src/today/',
      'src/components/HomeView.tsx',
      'src/components/DashboardView.tsx',
      'src/components/Navbar.tsx',
      'src/security/today01RouterContract.test.ts',
      'src/security/today01HomeUiContract.test.ts',
      'src/security/today01SessionContextContract.test.ts',
      'src/security/today01ContinuationContract.test.ts',
      'src/security/today01QualificationContract.test.ts'
    ]) {
      expect(impactPaths.has(path)).toBe(true);
    }
  });

  test('binds TODAY-01 to executable source contracts and the canonical browser smoke', () => {
    const invariant = registry.invariants.find(entry => entry.id === 'TODAY-01-I01');
    const tests = new Set(invariant?.tests ?? []);
    const browserSmoke = new Set(invariant?.browserSmoke ?? []);

    for (const path of [
      'src/security/today01RouterContract.test.ts',
      'src/security/today01HomeUiContract.test.ts',
      'src/security/today01SessionContextContract.test.ts',
      'src/security/today01ContinuationContract.test.ts',
      'src/security/today01QualificationContract.test.ts'
    ]) {
      expect(tests.has(path)).toBe(true);
    }

    expect(browserSmoke.has('tests/browser/qualification-invariant-smoke.spec.cjs')).toBe(true);
  });

  test('renames global Home navigation to Oggi while retaining Classi as an expert Home concept', () => {
    expect(navbar).toContain('<span>Oggi</span>');
    expect(navbar).toContain('<ArrowLeft className="w-3 h-3" /> Oggi');
    expect(navbar).not.toContain('<span>Classi</span>');
    expect(navbar).not.toContain('<ArrowLeft className="w-3 h-3" /> Classi');
  });
});