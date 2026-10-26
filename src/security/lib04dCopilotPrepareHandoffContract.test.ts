import { describe, expect, test } from 'bun:test';

const COMPOSER = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);
const PANEL = new URL('../components/LibraryProposalPanel.tsx', import.meta.url);
const APP = new URL('../App.tsx', import.meta.url);

describe('LIB-04D Copilot PREPARE governed handoff contract', () => {
  test('reuses LibraryProposalPanel instead of introducing a second generative path', async () => {
    const composer = await Bun.file(COMPOSER).text();
    const panel = await Bun.file(PANEL).text();

    expect(panel).toContain('export const LibraryProposalPanel');
    expect(composer).toContain("import { LibraryProposalPanel } from './LibraryProposalPanel'");
    expect(composer).not.toContain("from '../services/libraryProposalService'");
    expect(composer).not.toContain("from '../library/teachingProposal'");
    expect(composer).not.toContain('requestLibraryTeachingProposal');
  });

  test('requires the existing durable source-update callback and keeps add-source unchanged', async () => {
    const composer = await Bun.file(COMPOSER).text();

    expect(composer).toContain("import type { LibrarySourcePatch } from '../library/libraryState'");
    expect(composer).toContain('onUpdateSource: (sourceId: string, patch: LibrarySourcePatch) => Promise<void>');
    expect(composer).toContain('onAddSource: (source: LibrarySource) => Promise<void>');
  });

  test('mounts PREPARE only after explicit PREPARE intent with a valid source, context and UDA', async () => {
    const composer = await Bun.file(COMPOSER).text();

    expect(composer).toContain('const [isPrepareOpen, setIsPrepareOpen] = useState(false)');
    expect(composer).toContain('const proposalUda = useMemo');
    expect(composer).toContain('resolvedTeachingContext.udaId');
    expect(composer).toContain('data-testid="library-copilot-prepare-disclosure"');
    expect(composer).not.toContain('Apri preparazione assistita');
    expect(composer).toContain('La preparazione compare solo dopo una richiesta esplicita.');
    expect(composer).toContain('isPrepareOpen && selectedSource && resolvedTeachingContext && proposalUda &&');
    expect(composer).toContain('<LibraryProposalPanel');
    expect(composer).toContain('source={selectedSource}');
    expect(composer).toContain('uda={proposalUda}');
    expect(composer).toContain('teachingContext={resolvedTeachingContext}');
    expect(composer).toContain('onUpdate={onUpdateSource}');
    expect(composer).toContain('onAddSource={onAddSource}');
  });

  test('fails closed on source/context changes and does not dispatch PREPARE from the Composer', async () => {
    const composer = await Bun.file(COMPOSER).text();

    expect(composer).toContain('setIsPrepareOpen(false)');
    expect(composer).toContain('resolvedTeachingContext?.udaId');
    expect(composer).toContain('resolvedTeachingContext?.lessonId');
    expect(composer).not.toContain("actionId: 'prepare-from-source'");
  });

  test('wires the Composer to the existing durable update/add handlers in App', async () => {
    const app = await Bun.file(APP).text();

    expect(app).toContain('onAddSource={handleAddLibrarySource}');
    expect(app).toContain('onUpdateSource={handleUpdateLibrarySource}');
  });
});
