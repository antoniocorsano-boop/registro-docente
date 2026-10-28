import { describe, expect, test } from 'bun:test';

const APP = new URL('../App.tsx', import.meta.url);
const PANEL = new URL('../components/LibraryProposalPanel.tsx', import.meta.url);
const DECK = new URL('../components/CopilotDeck.tsx', import.meta.url);
const OUTCOME = new URL('../copilot/missionOutcome.ts', import.meta.url);
const PREFERENCE = new URL('../copilot/preferenceLearning.ts', import.meta.url);

describe('AIC-07 professional authority regressions', () => {
  test('mission readiness does not adopt, link, grade, publish or send anything', async () => {
    const app = await Bun.file(APP).text();
    const start = app.indexOf('const handleMissionProposalReady');
    expect(start).toBeGreaterThan(-1);
    const end = app.indexOf('const handleMissionOutcome', start);
    expect(end).toBeGreaterThan(start);
    const fragment = app.slice(start, end);
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
  });

  test('mission outcome learning classifies edit usefulness without changing mission authority', async () => {
    expect(await Bun.file(OUTCOME).exists()).toBe(true);
    const [outcome, preference] = await Promise.all([
      Bun.file(OUTCOME).text(),
      Bun.file(PREFERENCE).text()
    ]);
    expect(outcome).toContain("'used-as-is'");
    expect(outcome).toContain("'small-edits'");
    expect(outcome).toContain("'heavy-rework'");
    expect(preference).toContain("'saved-to-library'");
    expect(preference).toContain("'linked-to-uda'");
    expect(preference).toContain("'discarded'");
    expect(outcome).not.toContain('persistentProfessionalWrite: true');
    expect(outcome).not.toContain('scopeExpansion: true');
  });

  test('Deck preview Play never imports provider or durable professional mutation functions', async () => {
    const deck = await Bun.file(DECK).text();
    expect(deck).not.toContain('requestLibraryTeachingProposal');
    expect(deck).not.toContain('onAdoptProposalToUda');
    expect(deck).not.toContain('linkLibrarySource');
    expect(deck).not.toContain('saveAppData');
  });
});
