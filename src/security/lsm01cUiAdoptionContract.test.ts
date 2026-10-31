import { describe, expect, test } from 'bun:test';

const SETTINGS = new URL('../components/SemanticMemorySettings.tsx', import.meta.url);
const APP = new URL('../App.tsx', import.meta.url);
const LIBRARY_VIEW = new URL('../components/LibraryView.tsx', import.meta.url);

async function readIfExists(url: URL): Promise<string> {
  const file = Bun.file(url);
  return (await file.exists()) ? file.text() : '';
}

describe('LSM-01C-A explicit session-only UI adoption', () => {
  test('materializes a secondary local-memory control with no persistence or automatic network effect', async () => {
    const settings = await readIfExists(SETTINGS);

    expect(settings.length).toBeGreaterThan(0);
    expect(settings).toContain("http://127.0.0.1:8765");
    expect(settings).toContain('Connetti memoria locale');
    expect(settings).toContain('Sincronizza');
    expect(settings).toContain('type="password"');
    expect(settings).toContain('solo sul dispositivo');
    expect(settings).not.toContain('localStorage');
    expect(settings).not.toContain('sessionStorage');
    expect(settings).not.toContain('AppSettings');
    expect(settings).not.toContain('useEffect');
    expect(settings).not.toContain('.health(');
    expect(settings).not.toContain('fetch(');
  });

  test('App owns the ephemeral client and performs health/sync only in explicit handlers', async () => {
    const app = await Bun.file(APP).text();

    expect(app).toContain("from './semanticMemory/httpClient'");
    expect(app).toContain("from './semanticMemory/projections'");
    expect(app).toContain("from './semanticMemory/sync'");
    expect(app).toContain('semanticMemoryPortRef');
    expect(app).toContain('handleConnectSemanticMemory');
    expect(app).toContain('createSemanticMemoryHttpClient');
    expect(app).toContain('await client.health()');
    expect(app).toContain('handleSyncSemanticMemory');
    expect(app).toContain('buildRegistroSemanticMemorySnapshot');
    expect(app).toContain('syncRegistroSemanticMemory');
    expect(app).not.toContain('semanticMemoryToken');
    expect(app).not.toContain('setSemanticMemoryToken');
  });

  test('Library keeps textual search and existing local semantic fallback while preferring a ready LSM session', async () => {
    const view = await Bun.file(LIBRARY_VIEW).text();

    expect(view).toContain('searchLibrarySources(library, query)');
    expect(view).toContain("retrieveLibrarySourcesByMeaning");
    expect(view).toContain("retrieveLibrarySourcesFromSemanticMemory");
    expect(view).toContain('semanticMemoryPort');
    expect(view).toContain('semanticMemorySession');
    expect(view).toContain('<SemanticMemorySettings');
    expect(view).toContain('semanticMemoryPort\n        ? await retrieveLibrarySourcesFromSemanticMemory');
    expect(view).not.toContain('onChange={event => void handleRunSemanticSearch');
  });

  test('sync remains unavailable until the App reports a usable ready/degraded session', async () => {
    const settings = await Bun.file(SETTINGS).text();

    expect(settings).toContain("session.status === 'ready' || session.status === 'degraded'");
    expect(settings).toContain('disabled={!canSync || isSyncing}');
    expect(settings).toContain('onConnect({ endpoint, token })');
    expect(settings).toContain('onSync()');
  });
});
