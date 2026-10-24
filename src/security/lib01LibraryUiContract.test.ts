import { describe, expect, test } from 'bun:test';

const TYPES_PATH = new URL('../types.ts', import.meta.url);
const NAVBAR_PATH = new URL('../components/Navbar.tsx', import.meta.url);
const VIEW_PATH = new URL('../components/LibraryView.tsx', import.meta.url);
const CARD_PATH = new URL('../components/LibrarySourceCard.tsx', import.meta.url);
const APP_PATH = new URL('../App.tsx', import.meta.url);

describe('LIB-01A private-library teacher surface', () => {
  test('adds Biblioteca privata only as a secondary teaching tool', async () => {
    const types = await Bun.file(TYPES_PATH).text();
    const navbar = await Bun.file(NAVBAR_PATH).text();

    expect(types).toContain("| 'biblioteca'");
    expect(navbar).toContain('Biblioteca privata');

    const teachingTools = navbar.indexOf('Didattica e strumenti');
    const library = navbar.indexOf('Biblioteca privata');
    expect(teachingTools).toBeGreaterThanOrEqual(0);
    expect(library).toBeGreaterThan(teachingTools);

    const workflowStart = navbar.indexOf('Desktop / Tablet Workflow Hub Bar');
    const workflowEnd = navbar.indexOf('Class active banner for small screens');
    const primaryWorkflow = navbar.slice(workflowStart, workflowEnd);
    expect(primaryWorkflow).not.toContain('Biblioteca privata');
    expect(primaryWorkflow).not.toContain("handleNav('biblioteca')");
  });

  test('keeps the initial LibraryView compact and progressively discloses capture choices', async () => {
    const viewFile = Bun.file(VIEW_PATH);
    expect(await viewFile.exists()).toBe(true);
    const view = await viewFile.text();

    expect(view).toContain('Aggiungi fonte');
    expect(view).toContain('Cerca nella biblioteca');
    expect(view).toContain('Recenti');
    expect(view).toContain('Collegate');
    expect(view).toContain('Da rivedere');
    expect(view).toContain('Foto o file');
    expect(view).toContain('URL');
    expect(view).toContain('Testo o idea');

    for (const forbidden of ['rubrica', 'debate', 'verifica formativa']) {
      expect(view.toLocaleLowerCase('it')).not.toContain(forbidden);
    }
  });

  test('gives each source one primary Usa action and hides secondary maintenance in details', async () => {
    const cardFile = Bun.file(CARD_PATH);
    expect(await cardFile.exists()).toBe(true);
    const card = await cardFile.text();

    expect(card).toContain('Usa');
    expect(card).toContain('<details');
    expect(card).toContain('Rinomina');
    expect(card).toContain('Collega');
    expect(card).toContain('Scollega');
    expect(card).toContain('Elimina');
    expect(card).toContain('Funzioni contestuali disponibili con il copilota');
  });

  test('App renders the library with durable handlers and pending/error state', async () => {
    const app = await Bun.file(APP_PATH).text();
    expect(app).toContain("activeTab === 'biblioteca'");
    expect(app).toContain('<LibraryView');
    expect(app).toContain('onAddSource={handleAddLibrarySource}');
    expect(app).toContain('onUpdateSource={handleUpdateLibrarySource}');
    expect(app).toContain('onLinkSource={handleLinkLibrarySource}');
    expect(app).toContain('onUnlinkSource={handleUnlinkLibrarySource}');
    expect(app).toContain('onDeleteSource={handleDeleteLibrarySource}');
    expect(app).toContain('isPending={isLibraryMutationPending}');
    expect(app).toContain('errorMessage={libraryMutationError}');
  });
});
