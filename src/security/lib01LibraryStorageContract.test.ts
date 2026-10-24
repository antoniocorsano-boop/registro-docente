import { describe, expect, test } from 'bun:test';

const storagePath = new URL('./secureAppStorage.ts', import.meta.url);
const vaultTypesPath = new URL('./vaultTypes.ts', import.meta.url);
const appPath = new URL('../App.tsx', import.meta.url);

describe('LIB-01A secure library storage contract', () => {
  test('promotes library to a first-class secure snapshot dataset', async () => {
    const vaultTypes = await Bun.file(vaultTypesPath).text();
    const storage = await Bun.file(storagePath).text();
    const app = await Bun.file(appPath).text();

    expect(vaultTypes).toContain("| 'library'");
    expect(storage).toContain('library: LibraryStateV1 | null');
    expect(storage).toContain('library: LibraryStateV1;');
    expect(storage).toContain("this.vault.get<LibraryStateV1>('library')");
    expect(storage).toContain('saveLibrary(value: LibraryStateV1): Promise<void>');
    expect(storage).toContain('saveLibraryAndMeta(library: LibraryStateV1, meta: SecureMeta): Promise<void>');
    expect(storage).toContain("{ key: 'library', value: library }");
    expect(storage).toContain("{ key: 'library', value: sanitized.library }");
    expect(storage).toContain("['library', snapshot.library]");

    expect(app).toContain('initialSnapshot.library || createEmptyLibraryState()');
    expect(app).not.toContain("localStorage.setItem('library'");
  });
});
