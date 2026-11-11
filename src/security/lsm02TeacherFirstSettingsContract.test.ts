import { describe, expect, test } from 'bun:test';

const SETTINGS = new URL('../components/SemanticMemorySettings.tsx', import.meta.url);
const LIBRARY = new URL('../components/LibraryView.tsx', import.meta.url);

describe('LSM-02 Beta 1: memoria facoltativa e impostazioni comprensibili', () => {
  test('non espone gergo infrastrutturale nel testo ordinario e raggruppa i dettagli', async () => {
    const settings = await Bun.file(SETTINGS).text();
    const section = settings.slice(settings.indexOf('data-testid="semantic-memory-settings"'));
    const summary = section.indexOf('Configurazione avanzata');
    const endpoint = section.indexOf('Endpoint locale');

    expect(summary).toBeGreaterThan(0);
    expect(endpoint).toBeGreaterThan(summary);
    expect(section).toContain('<details');
    expect(section).toContain('data-testid="semantic-memory-advanced"');
    expect(section).not.toContain('Termux');
    expect(section).toContain('La ricerca per significato è facoltativa.');
    expect(section).toContain('Attiva memoria locale');
    expect(section).toContain('Disattiva');
  });

  test('il ripiego testuale permane, senza mutazioni o sincronizzazione implicita', async () => {
    const settings = await Bun.file(SETTINGS).text();
    const library = await Bun.file(LIBRARY).text();
    expect(settings).toContain('Puoi continuare a cercare nella Biblioteca.');
    expect(settings).toContain("onConnect({ endpoint })");
    expect(settings).toContain('disabled={!canSync || isSyncing}');
    expect(settings).toContain('onSync()');
    expect(settings).not.toContain('useEffect');
    expect(settings).not.toContain('localStorage');
    expect(library).toContain('searchLibrarySources(library, query)');
    expect(library).toContain('retrieveLibrarySourcesFromSemanticMemory');
  });
});
