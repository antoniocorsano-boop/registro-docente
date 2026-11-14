import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const navbar = readFileSync('src/components/Navbar.tsx', 'utf8');
const vault = readFileSync('src/components/VaultControls.tsx', 'utf8');
const deck = readFileSync('src/components/CopilotDeck.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const browser = readFileSync('tests/browser/mobile-actions-01-adaptive-copilot.spec.cjs', 'utf8');

describe('MOBILE-ACTIONS-01/B — no occlusion of professional writes', () => {
  test('Vault actions occupy a real header slot without covering scrolling content', () => {
    expect(navbar).toContain('id="registro-vault-header-actions"');
    expect(vault).toContain('createPortal(');
    expect(vault).toContain("document.getElementById('registro-vault-header-actions')");
    expect(vault).not.toContain('fixed bottom-16 right-3');
    expect(vault).toContain('aria-label="Blocca Registro"');
    expect(vault).toContain('aria-label="Imposta blocco automatico"');
    expect(vault).toContain('onClick={onLock}');
    expect(vault).toContain('onAutoLockChange(');
  });

  test('Copilota launcher yields to professional input and saving screens, desktop remains usable', () => {
    expect(app).toContain('showClosedTrigger={shouldOfferAmbientCopilot({');
    expect(app).toContain('drawerOpen: isDrawerOpen');
    expect(app).toContain('inlineMobileTrigger={true}');
    expect(app).toContain('isDrawerOpen={isDrawerOpen}');
    // Biblioteca remains an eligible contextual Copilota entry for teacher-first source use.
    expect(app).toContain("'voti'");
    expect(app).toContain("'comportamenti'");
    const bridge = readFileSync('src/components/CopilotExperience.tsx', 'utf8');
    expect(bridge).toContain('suppressMobileTrigger?: boolean');
    expect(bridge).toContain('suppressMobileTrigger={suppressMobileTrigger}');
    expect(deck).toContain('suppressMobileTrigger?: boolean');
    expect(deck).toContain('suppressMobileTrigger = false');
    expect(deck).toContain('max-md:hidden');
    expect(deck).toContain('hidden md:inline');
  });

  test('browser verifies geometrical safety at 320 and 390 px and Vault access', () => {
    expect(browser).toContain('MOBILE-ACTIONS-01/B');
    expect(browser).toContain("name: 'Salva Valutazioni di Classe'");
    expect(browser).toContain('expectNoOverlap(');
    expect(browser).toContain("page.getByTestId('header01-lock')");
    expect(browser).toContain("page.getByTestId('header01-privacy')");
    expect(browser).toContain("page.getByTestId('header01-auto-lock')");
    expect(browser).toContain("await navigationButton(page).click()");
    expect(browser).toContain("await settings.selectOption('30')");
    expect(browser).toContain("await expectNoOverlap(save, lock)");
    expect(browser).toContain("await expectNoOverlap(save, privacy)");
    expect(browser).toContain('390');
    expect(browser).toContain('320');
  });
});
