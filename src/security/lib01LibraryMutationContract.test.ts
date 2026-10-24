import { describe, expect, test } from 'bun:test';
import type { LibraryStateV1 } from '../library/types';
import type { SecureMeta } from './secureAppStorage';

const MUTATION_MODULE = '../persistence/libraryMutation.ts';
const APP_PATH = new URL('../App.tsx', import.meta.url);

function emptyLibrary(): LibraryStateV1 {
  return { schemaVersion: 1, sources: [] };
}

describe('LIB-01A durable private-library mutation contract', () => {
  test('returns the next committed library and meta only after persistence resolves', async () => {
    const { persistLibraryMutation } = await import(MUTATION_MODULE);
    const current = {
      library: emptyLibrary(),
      meta: { changes: 2, lastBackup: null } satisfies SecureMeta
    };

    let releasePersist!: () => void;
    const persistGate = new Promise<void>(resolve => { releasePersist = resolve; });
    let settled = false;

    const pending = persistLibraryMutation(
      current,
      library => ({ ...library, sources: [] }),
      async (library, meta) => {
        expect(library).not.toBe(current.library);
        expect(meta).toEqual({ changes: 3, lastBackup: null });
        await persistGate;
      }
    ).then(result => {
      settled = true;
      return result;
    });

    await Promise.resolve();
    expect(settled).toBe(false);
    expect(current.meta.changes).toBe(2);

    releasePersist();
    await expect(pending).resolves.toEqual({
      library: { schemaVersion: 1, sources: [] },
      meta: { changes: 3, lastBackup: null }
    });
  });

  test('rejects without mutating the committed input when persistence fails', async () => {
    const { persistLibraryMutation } = await import(MUTATION_MODULE);
    const currentLibrary = emptyLibrary();
    const currentMeta: SecureMeta = { changes: 4, lastBackup: '2026-10-20T08:00:00.000Z' };

    await expect(persistLibraryMutation(
      { library: currentLibrary, meta: currentMeta },
      library => ({ ...library, sources: [] }),
      async () => { throw new Error('write failed'); }
    )).rejects.toThrow('write failed');

    expect(currentLibrary).toEqual({ schemaVersion: 1, sources: [] });
    expect(currentMeta).toEqual({ changes: 4, lastBackup: '2026-10-20T08:00:00.000Z' });
  });

  test('App serializes add update link unlink and delete through the shared durable coordinator', async () => {
    const app = await Bun.file(APP_PATH).text();

    expect(app).toContain('const commitLibraryMutation = useCallback');
    expect(app).toContain('mutationCoordinator.enqueueTask');
    expect(app).toContain('persistLibraryMutation');
    expect(app).toContain('secureStorage.saveLibraryAndMeta');
    expect(app).toContain('libraryRef.current = candidate.library');
    expect(app).toContain('setLibrary(candidate.library)');

    for (const handler of [
      'handleAddLibrarySource',
      'handleUpdateLibrarySource',
      'handleLinkLibrarySource',
      'handleUnlinkLibrarySource',
      'handleDeleteLibrarySource'
    ]) {
      expect(app).toContain(handler);
    }

    expect(app).not.toContain("localStorage.setItem('library'");
  });
});
