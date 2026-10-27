import { describe, expect, test } from 'bun:test';

const APP = new URL('../App.tsx', import.meta.url);
const PANEL = new URL('../components/LibraryProposalPanel.tsx', import.meta.url);
const DECK = new URL('../components/CopilotDeck.tsx', import.meta.url);

describe('AIC-07 professional authority regressions', () => {
  test('mission readiness does not adopt, link, grade, publish or send anything', async () => {
    const app = await Bun.file(APP).text();
    const start = app.indexOf('const handleMissionProposalReady');
    expect(start).toBeGreaterThan(-1);
    const fragment = app.slice(start, start + 1800);
    expect(fragment).not.toContain('handleAdoptTeachingProposalToUda');
    expect(fragment).not.toContain('handleLinkLibrarySource');
    expect(fragment).not.toContain('handleSaveEvaluations');
    expect(fragment).not.toContain('fetch(');
    expect(fragment).not.toContain('publish');
    expect(fragment).not.toContain('send');
  });

  test('proposal adoption remains behind the existing explicit teacher actions', async () => {
    const panel = await Bun.file(PANEL).text();
    expect(panel).toContain('Adotta in Biblioteca');
    expect(panel).toContain("Adotta e aggiungi all'UDA");
    expect(panel).toContain('await onAddSource(adopted)');
    expect(panel).toContain('await onAdoptProposalToUda');
    const readyIndex = panel.indexOf('onMissionProposalReady');
    const adoptIndex = panel.indexOf('const adoptLibraryContent');
    expect(readyIndex).toBeGreaterThan(-1);
    expect(adoptIndex).toBeGreaterThan(readyIndex);
  });

  test('mission outcome learning records use/edit/discard signals but never changes mission authority', async () => {
    const panel = await Bun.file(PANEL).text();
    expect(panel).toContain("'used-as-is'");
    expect(panel).toContain("'small-edits'");
    expect(panel).toContain("'heavy-rework'");
    expect(panel).toContain("'saved-to-library'");
    expect(panel).toContain("'linked-to-uda'");
    expect(panel).toContain("'discarded'");
    expect(panel).not.toContain('persistentProfessionalWrite: true');
    expect(panel).not.toContain('scopeExpansion: true');
  });

  test('Deck preview Play never imports provider or durable professional mutation functions', async () => {
    const deck = await Bun.file(DECK).text();
    expect(deck).not.toContain('requestLibraryTeachingProposal');
    expect(deck).not.toContain('onAdoptProposalToUda');
    expect(deck).not.toContain('linkLibrarySource');
    expect(deck).not.toContain('saveAppData');
  });
});
