import { describe, expect, test } from 'bun:test';

const MAIN = new URL('../main.tsx', import.meta.url);
const MOBILE_DOCK_STYLES = new URL('../styles/lsm01cBMobilePrimaryActionDock.css', import.meta.url);
const PROPOSAL_PANEL = new URL('../components/LibraryProposalPanel.tsx', import.meta.url);

async function source(url: URL): Promise<string> {
  return Bun.file(url).text();
}

describe('LSM-01C-B mobile primary action dock contract', () => {
  test('the mobile dock stylesheet is loaded after the canonical application stylesheet', async () => {
    const main = await source(MAIN);

    expect(main).toContain("import './index.css';");
    expect(main).toContain("import './styles/lsm01cBMobilePrimaryActionDock.css';");
    expect(main.indexOf("import './styles/lsm01cBMobilePrimaryActionDock.css';"))
      .toBeGreaterThan(main.indexOf("import './index.css';"));
  });

  test('mobile Copilot reserves bottom space and fixes exactly the PREPARE primary action above the safe area', async () => {
    const css = await source(MOBILE_DOCK_STYLES);

    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('[data-testid="library-copilot-scroll"]');
    expect(css).toContain('padding-bottom: calc(6.5rem + env(safe-area-inset-bottom)) !important;');
    expect(css).toContain('[data-testid="library-copilot-prepare-disclosure"]');
    expect(css).toContain('button.border-violet-700');
    expect(css).toContain('button.bg-violet-200');
    expect(css).toContain('button.bg-amber-200');
    expect(css).toContain('position: fixed;');
    expect(css).toContain('bottom: max(1rem, env(safe-area-inset-bottom));');
    expect(css).toContain('z-index: 110;');
    expect(css).toContain('width: calc(100% - 2rem);');
  });

  test('the dock does not alter PREPARE consent, authorization or persistence governance', async () => {
    const panel = await source(PROPOSAL_PANEL);

    expect(panel).toContain('Consenti per questa richiesta');
    expect(panel).toContain('prepareAction.label');
    expect(panel).toContain('Autorizza solo questa operazione');
    expect(panel).toContain('explicitTeacherOptIn: true');
    expect(panel).toContain('setRemoteConsent(false)');
  });
});
