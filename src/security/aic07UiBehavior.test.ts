import { describe, expect, test } from 'bun:test';

const TYPES = new URL('../types.ts', import.meta.url);
const UTILS = new URL('../utils.ts', import.meta.url);
const SETTINGS = new URL('../components/SettingsView.tsx', import.meta.url);
const DECK = new URL('../components/CopilotDeck.tsx', import.meta.url);
const APP = new URL('../App.tsx', import.meta.url);
const COMPOSER = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);

describe('AIC-07 supervised Copilot Deck UI contract', () => {
  test('adds a durable proactivity profile independent from AIC-06 budget settings', async () => {
    const [types, utils, settings] = await Promise.all([
      Bun.file(TYPES).text(),
      Bun.file(UTILS).text(),
      Bun.file(SETTINGS).text()
    ]);
    expect(types).toContain('copilotProactivity?: CopilotProactivityProfile');
    expect(utils).toContain("copilotProactivity: 'balanced'");
    expect(settings).toContain('Proattività del Copilota');
    expect(settings).toContain('Essenziale');
    expect(settings).toContain('Equilibrato');
    expect(settings).toContain('Presente');
    expect(settings).toContain('Uso delle risorse IA');
    expect(settings.indexOf('Proattività del Copilota')).not.toBe(settings.indexOf('Uso delle risorse IA'));
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
    const deck = await Bun.file(DECK).text();
    expect(deck).not.toContain('fetch(');
    expect(deck).not.toContain('interpretCopilotIntent');
    expect(deck).not.toContain('requestLibraryTeachingProposal');
    expect(deck).not.toContain('generateProposal');
  });

  test('App commits copilotState through the durable coordinator before publishing and Deck owns the sole FAB', async () => {
    const [app, composer] = await Promise.all([
      Bun.file(APP).text(),
      Bun.file(COMPOSER).text()
    ]);
    expect(app).toContain('initialSnapshot.copilotState ?? createEmptyCopilotState()');
    expect(app).toContain('const copilotStateRef = useRef(copilotState)');
    expect(app).toContain('secureStorage.saveCopilotStateAndMeta');
    expect(app).toContain('<CopilotDeck');
    expect(app).toContain('showTrigger={false}');
    expect(composer).toContain('showTrigger?: boolean');
    expect(composer).toContain('showTrigger &&');
  });

  test('preference reset is scoped to copilotState preferences only', async () => {
    const app = await Bun.file(APP).text();
    const start = app.indexOf('const handleResetCopilotPreferences');
    expect(start).toBeGreaterThan(-1);
    const fragment = app.slice(start, start + 1200);
    expect(fragment).toContain('resetCopilotStatePreferences');
    expect(fragment).not.toContain('setLibrary(');
    expect(fragment).not.toContain('setProfessionalMemory(');
    expect(fragment).not.toContain('setUdas(');
    expect(fragment).not.toContain('setAppData(');
  });
});
