import { describe, expect, test } from 'bun:test';

async function source(path: string) {
  return Bun.file(path).text();
}

describe('FLOW-04 persistence and professional-authority boundary', () => {
  test('keeps ReviewSession exclusively in transient App session state', async () => {
    const [app, types, storage, backup, planning, library, memory, copilot] = await Promise.all([
      source('src/App.tsx'),
      source('src/types.ts'),
      source('src/security/secureAppStorage.ts'),
      source('src/security/backupPayload.ts'),
      source('src/planning/types.ts'),
      source('src/library/types.ts'),
      source('src/memory/types.ts'),
      source('src/copilot/state.ts')
    ]);

    expect(app).toContain('useState<ReviewSessionContext | null>(null)');
    expect(types).not.toContain('reviewSession');
    expect(storage).not.toContain('reviewSession');
    expect(backup).not.toContain('reviewSession');
    expect(planning).not.toContain('reviewSession');
    expect(library).not.toContain('reviewSession');
    expect(memory).not.toContain('reviewSession');
    expect(copilot).not.toContain('reviewSession');
    expect(storage).not.toContain('ReviewSessionContext');
    expect(backup).not.toContain('ReviewSessionContext');
  });

  test('keeps review presentation descriptive and non-deliberative', async () => {
    const [panel, banner] = await Promise.all([
      source('src/components/ReviewRouterPanel.tsx'),
      source('src/components/ReviewMissionBanner.tsx')
    ]);
    const reviewPresentation = `${panel}\n${banner}`;

    for (const phrase of [
      'Sintesi matematica',
      'Indicatori e trend',
      'Traccia delle registrazioni',
      'Dossier individuale',
      'Progressione didattica',
      'Evidenze comportamentali'
    ]) {
      expect(reviewPresentation).toContain(phrase);
    }

    expect(reviewPresentation).not.toMatch(
      /assegna voto|voto suggerito|promuovi|boccia|decisione suggerita|devi correggere|correggi automaticamente/i
    );
  });

  test('registers FLOW-04 as an explicit qualification invariant', async () => {
    const registry = JSON.parse(await source('qualification/invariants.v1.json')) as {
      invariants: Array<{
        id: string;
        owner: string;
        statement: string;
        impactPaths: string[];
        tests: string[];
      }>;
    };

    const invariant = registry.invariants.find(entry => entry.id === 'FLOW-04-I01');
    expect(invariant).toBeDefined();
    expect(invariant?.owner).toBe('FLOW-04');
    expect(invariant?.statement).toContain('session-only');
    expect(invariant?.statement).toContain('never decides');

    const impactPaths = new Set(invariant?.impactPaths ?? []);
    for (const path of [
      'qualification/invariants.v1.json',
      'src/App.tsx',
      'src/review/',
      'src/components/DashboardView.tsx',
      'src/components/ReviewRouterPanel.tsx',
      'src/components/ReviewMissionBanner.tsx',
      'src/recording/reviewRouting.ts',
      'src/security/flow04ReviewSessionContract.test.ts',
      'src/security/flow04ReviewUiContract.test.ts',
      'src/security/flow04PersistenceBoundary.test.ts'
    ]) {
      expect(impactPaths.has(path)).toBe(true);
    }

    const tests = new Set(invariant?.tests ?? []);
    for (const path of [
      'src/security/flow04ReviewSessionContract.test.ts',
      'src/security/flow04ReviewUiContract.test.ts',
      'src/security/flow04PersistenceBoundary.test.ts',
      'src/security/flow03bContextualReviewContract.test.ts',
      'src/security/today01ContinuationContract.test.ts',
      'src/security/today01SessionContextContract.test.ts'
    ]) {
      expect(tests.has(path)).toBe(true);
    }
  });
});
