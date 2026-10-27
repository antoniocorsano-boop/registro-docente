import { describe, expect, test } from 'bun:test';

const GOVERNOR = 'src/copilot/aiBudgetGovernor.ts';
const TYPES = 'src/types.ts';
const PROPOSAL = 'src/library/teachingProposal.ts';
const RUNTIME = 'src/server/teachingProposalRuntime.ts';
const ROUTE = 'src/server/libraryProposalRoute.ts';
const PANEL = 'src/components/LibraryProposalPanel.tsx';
const SETTINGS = 'src/components/SettingsView.tsx';

async function sourceOrEmpty(path: string): Promise<string> {
  const file = Bun.file(path);
  return await file.exists() ? file.text() : '';
}

describe('AIC-06 dynamic AI budget governor contract', () => {
  test('defines one shared browser/server budget policy with bounded tiers', async () => {
    const source = await sourceOrEmpty(GOVERNOR);

    expect(source).toContain("export type AiBudgetProfile = 'economy' | 'balanced' | 'quality'");
    expect(source).toContain("export type AiRemoteTier = 'remote-low' | 'remote-expanded'");
    expect(source).toContain("'BINARY_SOURCE'");
    expect(source).toContain("'LARGE_SOURCE'");
    expect(source).toContain("'RICH_CONTEXT'");
    expect(source).toContain('16 * 1024');
    expect(source).toContain('64 * 1024');
    expect(source).toContain('128 * 1024');
    expect(source).toContain('30 * 60 * 1000');
    expect(source).toContain('maxOutputTokens: 1024');
    expect(source).toContain('maxOutputTokens: 2048');
    expect(source).toContain('normalizeAiBudgetProfile');
    expect(source).toContain('resolvePrepareBudget');
    expect(source).toContain('isAiBudgetAuthorizationValid');
  });

  test('stores only the durable base profile in existing settings', async () => {
    const types = await sourceOrEmpty(TYPES);
    const settings = await sourceOrEmpty(SETTINGS);

    expect(types).toContain('aiBudgetProfile?: AiBudgetProfile');
    expect(settings).toContain('Uso delle risorse IA');
    expect(settings).toContain('Risparmio');
    expect(settings).toContain('Bilanciato');
    expect(settings).toContain('Qualità');
  });

  test('requires a budget envelope on PREPARE and enforces it before provider execution', async () => {
    const proposal = await sourceOrEmpty(PROPOSAL);
    const route = await sourceOrEmpty(ROUTE);
    const runtime = await sourceOrEmpty(RUNTIME);

    expect(proposal).toContain('budget: {');
    expect(proposal).toContain('activityKey');
    expect(route).toContain('AI_BUDGET_ESCALATION_REQUIRED');
    expect(route).toContain('resolvePrepareBudget');
    expect(route.indexOf('resolvePrepareBudget')).toBeLessThan(route.indexOf('executor.generate'));
    expect(runtime).toContain('maxOutputTokens?: number');
    expect(runtime).toContain('Math.min');
  });

  test('keeps temporary escalation teacher-controlled and non-persistent', async () => {
    const panel = await sourceOrEmpty(PANEL);

    expect(panel).toContain('Autorizza solo questa operazione');
    expect(panel).toContain('Autorizza per questa attività');
    expect(panel).not.toContain('localStorage');
    expect(panel).not.toContain('sessionStorage');
    expect(panel).not.toContain('maxOutputTokens');
    expect(panel).not.toContain('temperature');
  });
});
