import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  getHeaderNavigationPresentation,
  getHeaderPrivacyPresentation,
  getHeaderSaveAnnouncement,
  getHeaderVisualContext,
} from '../components/headerTopBarPresentation';

const source = readFileSync('src/components/Header01TopBar.tsx', 'utf8');
const securityDrawer = readFileSync('src/components/Header01DrawerSecurity.tsx', 'utf8');

describe('HEADER-01 / UX REWORK — logo come unico accesso alla navigazione', () => {
  test('il logo apre/chiude il menu e non porta implicitamente a Oggi', () => {
    expect(getHeaderNavigationPresentation(false)).toEqual({
      expanded: false,
      label: 'Apri navigazione del Registro',
    });
    expect(getHeaderNavigationPresentation(true)).toEqual({
      expanded: true,
      label: 'Chiudi navigazione del Registro',
    });
    expect(source).toContain('data-testid="header01-brand-navigation"');
    expect(source).toContain('onClick={onToggleMenu}');
    expect(source).toContain('aria-expanded={navigationPresentation.expanded}');
    expect(source).toContain('aria-controls={menuId}');
    expect(source).toContain('aria-label={navigationPresentation.label}');
    expect(source).not.toContain('data-testid="header01-open-menu"');
    expect(source).not.toContain('<Menu ');
    expect(source).not.toContain('onNavigateHome');
  });

  test('la destinazione Oggi è dichiarata e non viene nascosta nel marchio', () => {
    expect(getHeaderVisualContext({
      title: 'Registro Docente', subtitle: 'Oggi', showBrand: true,
    })).toEqual({ title: 'Oggi', subtitle: 'Registro Docente' });
    expect(getHeaderVisualContext({
      title: 'Valutazioni', subtitle: 'Classe 3ª A', showBrand: false,
    })).toEqual({ title: 'Valutazioni', subtitle: 'Classe 3ª A' });
    expect(getHeaderVisualContext({
      title: 'Biblioteca privata', subtitle: null, showBrand: false,
    })).toEqual({ title: 'Biblioteca privata', subtitle: null });
  });

  test('la privacy LIM è esplicita, indipendente dal lucchetto e leggibile dagli assistenti', () => {
    expect(getHeaderPrivacyPresentation(true)).toEqual({
      pressed: true,
      label: 'Nomi protetti. Mostra i nomi',
      title: 'Protezione nominativi attiva',
    });
    expect(getHeaderPrivacyPresentation(false)).toEqual({
      pressed: false,
      label: 'Nomi visibili. Proteggi i nomi',
      title: 'Protezione nominativi disattivata',
    });
    expect(source).toContain('data-testid="header01-privacy"');
    expect(source).toContain('data-testid="header01-lock"');
    expect(source).toContain('onClick={onTogglePrivacyShield}');
    expect(source).toContain('onClick={onLock}');
    expect(source).toContain('aria-pressed={privacyPresentation.pressed}');
    expect(source).toContain('aria-label="Blocca Registro"');
  });

  test('tutte le azioni essenziali hanno area minima di 48px e stato focus visibile', () => {
    expect(source).toContain('min-h-[48px] min-w-[48px]');
    expect(source).toContain('className={\`${iconButton}');
    expect(source).toContain('min-w-0 flex-1');
    expect(source).toContain('truncate'); // save announcement
    expect(source).toContain('data-testid="header01-context-title" className="min-w-0 break-words');
    expect(source).toContain('data-testid="header01-context-subtitle" className="min-w-0 break-words');
    expect(source).toContain('focus-visible:outline');
  });

  test('solo prove di persistenza autorevoli producono messaggi di salvataggio', () => {
    expect(getHeaderSaveAnnouncement({ kind: 'unknown', message: null, scope: null })).toBeNull();
    expect(getHeaderSaveAnnouncement({
      kind: 'saved-local', message: "Salvato nell'archivio locale", scope: 'registro',
    })).toEqual({
      role: 'status',
      message: "Salvato nell'archivio locale",
      critical: false,
    });
    expect(getHeaderSaveAnnouncement({
      kind: 'error', message: 'Salvataggio non riuscito', scope: 'programmazione',
    })).toEqual({
      role: 'alert',
      message: 'Salvataggio non riuscito',
      critical: true,
    });
    expect(source).toContain('aria-live={announcement.critical');
    expect(source).toContain('role={announcement.role}');
    expect(source).not.toContain('animate-ping');
    expect(source).not.toContain('setTimeout');
  });

  test('il blocco automatico è una scelta esplicita nel pannello, senza duplicare autorità', () => {
    expect(source).not.toContain('autoLockMinutes');
    expect(source).not.toContain('Clock3');
    expect(securityDrawer).toContain('Blocco automatico');
    for (const value of ['value={0}', 'value={15}', 'value={30}', 'value={60}']) {
      expect(securityDrawer).toContain(value);
    }
    expect(securityDrawer).toContain('onAutoLockChange');
    expect(securityDrawer).not.toContain('useEffect(');
    expect(securityDrawer).not.toContain('localStorage');
  });

  test('nessuna seconda navigazione, ritorno distruttivo o controllo galleggiante', () => {
    for (const forbidden of ['onNavigateHome', 'fixed bottom-', 'CopilotDeck', 'secureStorage', 'localStorage', 'history.pushState']) {
      expect(source).not.toContain(forbidden);
    }
  });
});
