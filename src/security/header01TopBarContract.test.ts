import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { getHeaderPrivacyPresentation, getHeaderSaveAnnouncement } from '../components/headerTopBarPresentation';

const source = readFileSync('src/components/Header01TopBar.tsx', 'utf8');

describe('HEADER-01 / Task 2 — barra superiore compatta e accessibile', () => {
  test('privacy LIM esplicita lo stato e l’azione corretta', () => {
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
  });

  test('gli annunci distinguono persistenza, assenza di prova e fallimento', () => {
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
  });

  test('la barra mantiene menu, privacy e blocco con bersagli tattili adeguati', () => {
    expect(source).toContain('data-testid="header01-topbar"');
    expect(source).toContain('data-testid="header01-open-menu"');
    expect(source).toContain('data-testid="header01-privacy"');
    expect(source).toContain('data-testid="header01-lock"');
    expect(source).toContain('onClick={onLock}');
    expect(source).toContain('onClick={onTogglePrivacyShield}');
    expect(source).toContain('onClick={onToggleMenu}');
    expect(source).toContain('aria-pressed={privacyPresentation.pressed}');
    expect(source).toContain('aria-expanded={isMenuOpen}');
    expect(source).toContain('aria-controls={menuId}');
    expect(source).toContain('aria-label="Blocca Registro"');
    expect(source).toContain('min-h-11 min-w-11');
  });

  test('il titolo è troncabile, gli annunci hanno ruoli accessibili e non esiste un timer ingannevole', () => {
    expect(source).toContain('min-w-0 flex-1');
    expect(source).toContain('truncate');
    expect(source).toContain('aria-live={announcement.critical');
    expect(source).toContain('role={announcement.role}');
    expect(source).toContain('getHeaderSaveAnnouncement(saveNotice)');
    expect(source).not.toContain('setTimeout');
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('secureStorage');
    expect(source).not.toContain('onNavigateHome');
    expect(source).not.toContain('animate-ping');
  });

  test('nessuna duplicazione di blocco automatico, menu di navigazione o Copilota', () => {
    expect(source).not.toContain('Imposta blocco automatico');
    expect(source).not.toContain('autoLockMinutes');
    expect(source).not.toContain('CopilotDeck');
    expect(source).not.toContain('fixed bottom-');
  });
});
