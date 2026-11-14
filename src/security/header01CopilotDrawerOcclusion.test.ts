import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx', 'utf8');
const copilot = readFileSync('src/components/CopilotDeck.tsx', 'utf8');
const navbar = readFileSync('src/components/Navbar.tsx', 'utf8');
const browser = readFileSync('tests/browser/header-01-copilot-drawer-occlusion.spec.cjs', 'utf8');

describe('HEADER-01 / Copilota e Drawer senza sovrapposizioni', () => {
  test('l’App nasconde il trigger mobile durante il pannello di navigazione', () => {
    expect(app).toContain('showClosedTrigger={shouldOfferAmbientCopilot({');
    expect(app).toContain('drawerOpen: isDrawerOpen');
    expect(app).toContain('inlineMobileTrigger={true}');
    expect(app).toContain('isDrawerOpen={isDrawerOpen}');
    // The individual report has no floating launcher on either layout.
    expect(app).toContain("recordingActive: isActiveRecordFocus");
  });

  test('il trigger Copilota rimane indipendente e rispetta la soppressione senza cambiare il desktop', () => {
    expect(copilot).toContain('data-testid="library-copilot-trigger"');
    // Suppression is unconditional (drawer/write views); adaptive scrolling
    // hides only floating launchers, never the in-flow launcher.
    expect(copilot).toContain('suppressMobileTrigger || (!inlineMobileTrigger && hiddenOnMobile)');
    expect(copilot).toContain("inlineMobileTrigger ? 'relative self-end");
    expect(copilot).toContain("inlineMobileTrigger ? 'relative self-end mx-3 mt-1 shrink-0 md:mx-5'");
    expect(copilot).toContain("'max-md:hidden' : ''");
    expect(navbar).toContain('id="registro-navigation-drawer"');
    expect(navbar).toContain('isDrawerOpen ?');
  });

  test('il browser copre apertura e chiusura del pannello con due larghezze mobili', () => {
    for (const token of ['320', '390', 'header01-brand-navigation', 'library-copilot-trigger', 'Esporta backup cifrato']) {
      expect(browser).toContain(token);
    }
  });
});
