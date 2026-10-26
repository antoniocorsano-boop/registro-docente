import { describe, expect, test } from 'bun:test';

const APP = new URL('../App.tsx', import.meta.url);
const MUTATION = new URL('../persistence/teachingProposalOutcomeMutation.ts', import.meta.url);

describe('AIC-02 governed PREPARE outcome boundary', () => {
  test('materializes one compound candidate before App can persist a proposal into Library and UDA', async () => {
    const mutation = Bun.file(MUTATION);
    expect(await mutation.exists()).toBe(true);
    if (!(await mutation.exists())) return;

    const source = await mutation.text();
    expect(source).toContain('deriveTeachingProposalOutcomeCandidate');
    expect(source).toContain('buildTeachingProposalUdaAdoption');
    expect(source).toContain('addLibrarySource');
    expect(source).toContain('incrementBackupChanges');
  });

  test('App commits Library UDA and meta through one coordinator entry and publishes only after persistence', async () => {
    const app = await Bun.file(APP).text();

    expect(app).toContain("from './persistence/teachingProposalOutcomeMutation'");
    expect(app).toContain('const handleAdoptTeachingProposalToUda = useCallback(');
    expect(app).toContain('library: libraryRef.current');
    expect(app).toContain('udas: udasRef.current');
    expect(app).toContain('meta: metaRef.current');
    expect(app).toContain('deriveTeachingProposalOutcomeCandidate(current, input)');
    expect(app).toContain('secureStorage.saveLibraryUdasAndMeta(candidate.library, candidate.udas, candidate.meta)');
    expect(app).toContain('libraryRef.current = candidate.library');
    expect(app).toContain('udasRef.current = candidate.udas');
    expect(app).toContain('metaRef.current = candidate.meta');
    expect(app).toContain("toast('Proposta aggiunta all’UDA')");
  });
});
