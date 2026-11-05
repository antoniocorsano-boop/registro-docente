import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const nav = readFileSync('src/components/Navbar.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const root = readFileSync('src/components/SecureRegistroRoot.tsx', 'utf8');
const vault = readFileSync('src/components/VaultControls.tsx', 'utf8');
const home = readFileSync('src/components/HomeView.tsx', 'utf8');
const browser = readFileSync('tests/browser/header-01-navbar-integration.spec.cjs', 'utf8');

describe('HEADER-01 / Task 5 — collegamento professionale protetto (isolato)', () => {
  test('l’intestazione mobile reale usa il componente nuovo e una sola navigazione con logo', () => {
    expect(nav).toContain('import { Header01TopBar }');
    expect(nav).toContain('resolveHeaderContext({');
    expect(nav).toContain('<Header01TopBar');
    expect(nav).toContain('menuId="registro-navigation-drawer"');
    expect(nav).toContain('headerSecurity.onLock');
    expect(nav).toContain('onToggleMenu={() => setIsDrawerOpen(!isDrawerOpen)}');
    expect(nav).toContain('className="md:hidden"');
    expect(nav).toContain('data-testid="header01-mobile-integration"');
    expect(nav).not.toContain('saveNotice={saveIndicatorText}');
  });

  test('la persistenza non viene inferita da toast o da Sincronizzato', () => {
    expect(nav).toContain("saveNotice={{ kind: 'unknown', message: null, scope: null }}");
    expect(nav).toContain('headerSecurity ?');
    expect(nav).toContain('hidden md:flex');
  });

  test('il titolare del blocco resta SecureRegistroRoot; il vecchio portale non duplica comandi', () => {
    expect(root).toContain('headerSecurity={{');
    expect(root).toContain('onLock: handleLock');
    expect(root).toContain('autoLockMinutes');
    expect(root).toContain('onAutoLockChange: handleAutoLockChange');
    expect(root).toContain('mobileControlsEnabled={false}');
    expect(vault).toContain('mobileControlsEnabled');
    expect(vault).toContain('mobileControlsEnabled && mobileHeaderHost && createPortal(');
    expect(nav).toContain('<Header01DrawerSecurity');
    expect(nav).toContain('onAutoLockChange={headerSecurity.onAutoLockChange}');
  });

  test('Oggi è una destinazione testuale e richiede consenso prima di azzerare il contesto', () => {
    expect(nav).toContain('data-testid="header01-go-home"');
    expect(nav).toContain('requestNavigateHome');
    expect(nav).toContain('data-testid="header01-home-confirm"');
    expect(nav).toContain('onNavigateHome();');
    expect(nav).toContain('Rimani qui');
    expect(nav).toContain('Torna a Oggi');
    expect(nav).toContain('La sessione corrente');
  });

  test('Oggi non viene duplicato come intestazione della scheda su smartphone', () => {
    expect(home).toContain('<span className="md:hidden">Da dove vuoi iniziare?</span>');
    expect(home).toContain('<span className="hidden md:inline">Oggi</span>');
  });

  test('il pannello mobile preserva tastiera, focus e controllo Esc', () => {
    expect(nav).toContain('id="registro-navigation-drawer"');
    expect(nav).toContain('aria-label="Navigazione del Registro"');
    expect(nav).toContain('onKeyDown={handleDrawerKeyDown}');
    expect(nav).toContain('event.key === \'Escape\'');
    expect(nav).toContain('event.key === \'Tab\'');
    expect(nav).toContain('aria-hidden={!isDrawerOpen}');
    expect(nav).toContain('inert={!isDrawerOpen}');
  });

  test('l’integrazione browser verifica 320/390, duplicazione, lock, drawer e consenso', () => {
    expect(browser).toContain('320');
    expect(browser).toContain('390');
    expect(browser).toContain('getByTestId');
    expect(browser).toContain('header01-home-confirm');
    expect(browser).toContain('header01-go-home');
    expect(browser).toContain('header01-lock');
  });
});
