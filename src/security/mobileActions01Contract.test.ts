import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const deck = readFileSync('src/components/CopilotDeck.tsx', 'utf8');
const hook = readFileSync('src/components/useAdaptiveMobileActionVisibility.ts', 'utf8');
const vault = readFileSync('src/components/VaultControls.tsx', 'utf8');
const navbar = readFileSync('src/components/Navbar.tsx', 'utf8');
const browser = readFileSync('tests/browser/mobile-actions-01-adaptive-copilot.spec.cjs', 'utf8');
const workflow = readFileSync('.github/workflows/browser-qualification.yml', 'utf8');

describe('MOBILE-ACTIONS-01 / A — Copilota mobile contestuale', () => {
  test('a single compact and accessible mobile trigger preserves the existing Copilota entry', () => {
    expect(deck).toContain('useAdaptiveMobileActionVisibility(surfaceMode)');
    expect(deck).toContain('data-testid="library-copilot-trigger"');
    expect(deck).toContain('aria-label="Apri Copilota"');
    expect(deck).toContain("onSurfaceModeChange('home')");
    expect(deck).toContain('min-h-12 min-w-12');
    expect(deck).toContain('left-3');
    expect(deck).toContain('md:right-4');
    expect(deck).toContain('max-md:hidden');
    expect(deck).toContain('hidden md:inline');
    expect(deck).not.toContain('fixed right-4 bottom-36 md:bottom-20');
  });

  test('scroll and input focus remove visual obstruction without timers or changes to professional state', () => {
    expect(hook).toContain("addEventListener('scroll'");
    expect(hook).toContain("addEventListener('focusin'");
    expect(hook).toContain("addEventListener('focusout'");
    expect(hook).toContain('setScrollingDown(true)');
    expect(hook).toContain('setScrollingDown(false)');
    expect(hook).toContain('setEditingField');
    expect(hook).toContain('advanceMobileScroll');
    expect(hook).toContain('isCopilotSurface(event.target)');
    expect(hook).toContain("if (surfaceMode === 'closed')");
    expect(browser).toContain("data-test-only");
    expect(hook).not.toContain('setTimeout(');
    expect(hook).not.toContain('localStorage');
  });

  test('direct secure Vault lock and five-place bottom navigation remain independent', () => {
    expect(vault).toContain('aria-label="Blocca Registro"');
    expect(vault).toContain('aria-label="Imposta blocco automatico"');
    expect(vault).toContain('createPortal(');
    expect(vault).toContain("document.getElementById('registro-vault-header-actions')");
    expect(vault).not.toContain('fixed bottom-16 right-3');
    expect(navbar).toContain('md:hidden fixed bottom-0');
    for (const tab of ["'dashboard'", "'voti'", "'comportamenti'", "'tabellone'", "'analytics'"]) {
      expect(navbar).toContain("handleNav(" + tab + ")");
    }
  });

  test('mobile and desktop browser evidence is mandatory for this increment', () => {
    expect(browser).toContain('390');
    expect(browser).toContain('320');
    expect(browser).toContain('1280');
    expect(browser).toContain('page.evaluate');
    expect(browser).toContain('getByTestId');
    expect(workflow).toContain('Run MOBILE-ACTIONS-01 Chromium qualification');
  });
});
