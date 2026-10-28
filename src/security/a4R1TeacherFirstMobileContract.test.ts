import { describe, expect, test } from 'bun:test';

const DECK = new URL('../components/CopilotDeck.tsx', import.meta.url);
const VAULT = new URL('../components/VaultControls.tsx', import.meta.url);

async function source(url: URL): Promise<string> {
  return Bun.file(url).text();
}

describe('A4-R1 teacher-first mobile surface contract', () => {
  test('Copilot Deck collapses an empty opportunity set into one useful teacher-facing state', async () => {
    const deck = await source(DECK);

    expect(deck).toContain('Non vedo qualcosa di urgente adesso. Posso comunque aiutarti con una classe, una UDA o un materiale.');
    expect(deck).not.toContain('Nessuna opportunità forte in questo gruppo.');
  });

  test('the floating Copilot trigger is not rendered while the Deck is already open', async () => {
    const deck = await source(DECK);

    expect(deck).toContain('{!isOpen && (');
    expect(deck).toContain('data-testid="library-copilot-trigger"');
  });

  test('mobile Vault controls keep direct lock access without a persistent wide select toolbar', async () => {
    const vault = await source(VAULT);

    expect(vault).toContain('aria-label="Blocca Registro"');
    expect(vault).toContain('aria-label="Imposta blocco automatico"');
    expect(vault).toContain('mobileSettingsOpen &&');
    expect(vault).not.toContain('w-[88px]');
    expect(vault).toContain('hidden md:flex fixed bottom-3 right-3');
  });
});
