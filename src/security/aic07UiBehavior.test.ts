import { describe, expect, test } from 'bun:test';

const TYPES = new URL('../types.ts', import.meta.url);
const PROACTIVITY = new URL('../copilot/proactivity.ts', import.meta.url);
const SETTINGS = new URL('../components/CopilotProactivitySettings.tsx', import.meta.url);
const DECK = new URL('../components/CopilotDeck.tsx', import.meta.url);
const EXPERIENCE = new URL('../components/CopilotExperience.tsx', import.meta.url);
const COMPOSER = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);
const APP = new URL('../App.tsx', import.meta.url);

describe('AIC-07 supervised Copilot Deck UI contract', () => {
  test('adds a durable proactivity profile independent from AIC-06 budget settings', async () => {
    const [types, proactivity, settings] = await Promise.all([
      Bun.file(TYPES).text(),
      Bun.file(PROACTIVITY).text(),
      Bun.file(SETTINGS).text()
    ]);
    expect(types).toContain('copilotProactivity?: CopilotProactivityProfile');
    expect(proactivity).toContain("return value === 'essential' || value === 'present' || value === 'balanced'");
    expect(proactivity).toContain(": 'balanced'");
    expect(settings).toContain('Proattività del Copilota');
    expect(settings).toContain('Essenziale');
    expect(settings).toContain('Equilibrato');
    expect(settings).toContain('Presente');
    expect(settings).toContain('Uso delle risorse IA');
    expect(settings).toContain('Reimposta preferenze del Copilota');
    expect(settings).toContain('onResetCopilotPreferences');
  });

  test('renders a bounded evidence-backed Deck with three semantic sections and progressive overflow', async () => {
    expect(await Bun.file(DECK).exists()).toBe(true);
    const deck = await Bun.file(DECK).text();
    expect(deck).toContain('Qui');
    expect(deck).toContain('Oggi');
    expect(deck).toContain('Più tardi');
    expect(deck).toContain('opportunity.whyNow');
    expect(deck).toContain('Altre possibilità');
    expect(deck).toContain('Metti da parte');
    expect(deck).toContain('Ignora');
    expect(deck).toContain('Anteprima');
    expect(deck).toContain('Parla con il Copilota');
    expect(deck).toContain('min-h-[44px]');
  });

  test('shows the complete first mission preview and supervised lifecycle copy', async () => {
    const deck = await Bun.file(DECK).text();
    expect(deck).toContain('Obiettivo');
    expect(deck).toContain('Contesto');
    expect(deck).toContain('Userà');
    expect(deck).toContain('Produrrà');
    expect(deck).toContain('Non farà');
    expect(deck).toContain('▶ Avvia incarico');
    expect(deck).toContain('▶ Riprendi');
    expect(deck).toContain('Il contesto è cambiato da quando hai iniziato.');
    expect(deck).toContain('Pronta da controllare');
  });

  test('opening or rendering the Deck cannot start intent/provider/generative work', async () => {
    const [deck, experience] = await Promise.all([
      Bun.file(DECK).text(),
      Bun.file(EXPERIENCE).text()
    ]);
    for (const source of [deck, experience]) {
      expect(source).not.toContain('fetch(');
      expect(source).not.toContain('interpretCopilotIntent');
      expect(source).not.toContain('requestLibraryTeachingProposal');
      expect(source).not.toContain('generateProposal');
    }
  });

  test('App commits copilotState through the durable coordinator and Deck structurally owns the only floating entry', async () => {
    const [app, composer] = await Promise.all([
      Bun.file(APP).text(),
      Bun.file(COMPOSER).text()
    ]);
    expect(app).toContain('initialSnapshot.copilotState ?? createEmptyCopilotState()');
    expect(app).toContain('const copilotStateRef = useRef(copilotState)');
    expect(app).toContain('secureStorage.saveCopilotStateAndMeta');
    expect(app).toContain('<CopilotExperience');
    expect(app).toContain('showStandaloneTrigger={false}');
    expect(app).not.toContain('aic07-hide-legacy-copilot-trigger');
    expect(composer).toContain('showStandaloneTrigger?: boolean;');
    expect(composer).toContain('showStandaloneTrigger = true');
    expect(composer).toContain('if (!isOpen && !showStandaloneTrigger) return null;');
  });

  test('preference reset is scoped to copilotState preferences only', async () => {
    const app = await Bun.file(APP).text();
    const start = app.indexOf('const handleResetCopilotPreferences');
    expect(start).toBeGreaterThan(-1);
    const end = app.indexOf('const handleAdoptTeachingProposalToUda', start);
    expect(end).toBeGreaterThan(start);
    const fragment = app.slice(start, end);
    expect(fragment).toContain('resetCopilotStatePreferences');
    expect(fragment).not.toContain('setLibrary(');
    expect(fragment).not.toContain('setProfessionalMemory(');
    expect(fragment).not.toContain('setUdas(');
    expect(fragment).not.toContain('setAppData(');
  });
});
