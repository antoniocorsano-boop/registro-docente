import { describe, expect, test } from 'bun:test';

const COMPOSER = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);
const PROPOSAL_PANEL = new URL('../components/LibraryProposalPanel.tsx', import.meta.url);
const MOBILE_DOCK = new URL('../components/MobilePrimaryActionDock.tsx', import.meta.url);

async function source(url: URL): Promise<string> {
  return Bun.file(url).text();
}

describe('LSM-01C-B mobile primary action dock contract', () => {
  test('direct Library Copilot reserves one mobile bottom action dock outside the single scrolling body', async () => {
    const composer = await source(COMPOSER);

    expect(composer).toContain('data-testid="library-copilot-scroll"');
    expect(composer).toContain('overflow-y-auto');
    expect(composer).toContain('pb-[calc(6rem+env(safe-area-inset-bottom))]');
    expect(composer).toContain('mobilePrimaryActionDock={isMobileDialog && hasCompleteDirectLaunch}');
  });

  test('the dock is fixed to the mobile safe area and becomes ordinary inline content on desktop', async () => {
    const dock = await source(MOBILE_DOCK);

    expect(dock).toContain('data-testid="library-copilot-primary-action-dock"');
    expect(dock).toContain('fixed');
    expect(dock).toContain('bottom-0');
    expect(dock).toContain('pb-[max(1rem,env(safe-area-inset-bottom))]');
    expect(dock).toContain('md:static');
  });

  test('PREPARE keeps exactly the current primary consent/generation action in the dock without changing governance', async () => {
    const panel = await source(PROPOSAL_PANEL);

    expect(panel).toContain('mobilePrimaryActionDock?: boolean;');
    expect(panel).toContain('<MobilePrimaryActionDock enabled={mobilePrimaryActionDock}>');
    expect(panel).toContain('Consenti per questa richiesta');
    expect(panel).toContain('prepareAction.label');
    expect(panel).toContain('explicitTeacherOptIn: true');
    expect(panel).toContain('setRemoteConsent(false)');
  });
});
