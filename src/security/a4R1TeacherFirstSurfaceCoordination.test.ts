import { describe, expect, test } from 'bun:test';

const APP = new URL('../App.tsx', import.meta.url);
const DECK = new URL('../components/CopilotDeck.tsx', import.meta.url);
const EXPERIENCE = new URL('../components/CopilotExperience.tsx', import.meta.url);
const COMPOSER = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);
const ROOT = new URL('../components/SecureRegistroRoot.tsx', import.meta.url);
const VAULT = new URL('../components/VaultControls.tsx', import.meta.url);

async function source(url: URL): Promise<string> {
  return Bun.file(url).text();
}

describe('A4-R1 one Copilot surface coordination', () => {
  test('App owns one closed/home/compose Copilot surface mode for Deck and Composer', async () => {
    const app = await source(APP);
    const experience = await source(EXPERIENCE);
    const deck = await source(DECK);
    const composer = await source(COMPOSER);

    expect(app).toContain("type CopilotSurfaceMode = 'closed' | 'home' | 'compose'");
    expect(app).toContain('const [copilotSurfaceMode, setCopilotSurfaceMode]');
    expect(app).toContain('surfaceMode={copilotSurfaceMode}');
    expect(app).toContain('onSurfaceModeChange={setCopilotSurfaceMode}');

    expect(experience).toContain('surfaceMode: CopilotSurfaceMode');
    expect(deck).toContain("const isOpen = surfaceMode === 'home'");
    expect(deck).not.toContain('const [isOpen, setIsOpen] = useState(false)');

    expect(composer).toContain("const isOpen = surfaceMode === 'compose'");
    expect(composer).not.toContain('const [isOpen, setIsOpen] = useState(false)');
  });

  test('SecureRegistroRoot coordinates foreground Vault presentation with the Copilot surface', async () => {
    const app = await source(APP);
    const root = await source(ROOT);
    const vault = await source(VAULT);

    expect(app).toContain('onCopilotSurfaceOpenChange?: (isOpen: boolean) => void');
    expect(app).toContain("onCopilotSurfaceOpenChange?.(copilotSurfaceMode !== 'closed')");
    expect(root).toContain('const [isCopilotSurfaceOpen, setIsCopilotSurfaceOpen] = useState(false)');
    expect(root).toContain('onCopilotSurfaceOpenChange={setIsCopilotSurfaceOpen}');
    expect(root).toContain('copilotSurfaceOpen={isCopilotSurfaceOpen}');
    expect(vault).toContain('copilotSurfaceOpen?: boolean');
    expect(vault).toContain('!copilotSurfaceOpen &&');
    expect(vault).toContain('aria-label="Blocca Registro"');
  });
});
