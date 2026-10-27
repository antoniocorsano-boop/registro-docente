import { describe, expect, test } from 'bun:test';

async function source(path: string): Promise<string> {
  return Bun.file(path).text();
}

describe('AIC-06 budget UI contract', () => {
  test('persists only the base profile through existing settings mutation', async () => {
    const settings = await source('src/components/SettingsView.tsx');
    expect(settings).toContain('Uso delle risorse IA');
    expect(settings).toContain('Risparmio');
    expect(settings).toContain('Bilanciato');
    expect(settings).toContain('Qualità');
    expect(settings).toContain('onUpdateSettings({ aiBudgetProfile: profile })');
    expect(settings).not.toContain('localStorage');
    expect(settings).not.toContain('sessionStorage');
  });

  test('preflights budget before the remote proposal call and offers only temporary escalation choices', async () => {
    const panel = await source('src/components/LibraryProposalPanel.tsx');
    expect(panel).toContain('resolvePrepareBudget');
    expect(panel).toContain('createAiBudgetAuthorization');
    expect(panel).toContain('Autorizza solo questa operazione');
    expect(panel).toContain('Autorizza per questa attività');
    expect(panel.indexOf('resolvePrepareBudget')).toBeLessThan(panel.indexOf('requestLibraryTeachingProposal'));
    expect(panel).not.toContain('localStorage');
    expect(panel).not.toContain('sessionStorage');
    expect(panel).not.toContain('maxOutputTokens');
    expect(panel).not.toContain('temperature');
  });

  test('wires the durable profile from the application to the proposal panel', async () => {
    const app = await source('src/App.tsx');
    const composer = await source('src/components/LibraryCopilotComposer.tsx');
    expect(app).toContain('aiBudgetProfile={settings.aiBudgetProfile}');
    expect(composer).toContain('aiBudgetProfile?: AiBudgetProfile');
    expect(composer).toContain('aiBudgetProfile={aiBudgetProfile}');
  });
});
