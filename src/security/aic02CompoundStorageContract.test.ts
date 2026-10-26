import { describe, expect, test } from 'bun:test';

const STORAGE = new URL('./secureAppStorage.ts', import.meta.url);

describe('AIC-02 compound storage contract', () => {
  test('persists Library UDA and meta through one dedicated vault batch', async () => {
    const storage = await Bun.file(STORAGE).text();

    expect(storage).toContain(
      'saveLibraryUdasAndMeta(library: LibraryStateV1, udas: UdaRecord[], meta: SecureMeta): Promise<void>'
    );
    expect(storage).toContain("{ key: 'library', value: library }");
    expect(storage).toContain("{ key: 'udas', value: udas }");
    expect(storage).toContain("{ key: 'meta', value: meta }");

    const method = storage.split('saveLibraryUdasAndMeta(', 2)[1] ?? '';
    expect(method).toContain('this.vault.putMany([');
    expect(method).not.toContain('saveLibraryAndMeta(');
    expect(method).not.toContain('saveUdasAndMeta(');
  });
});
