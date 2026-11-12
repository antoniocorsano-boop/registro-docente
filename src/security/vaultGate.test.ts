import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'bun:test';
import { VaultGate } from '../components/VaultGate';

const handlers = {
  onSetup: async (_password: string) => {},
  onUnlock: async (_password: string) => {},
  onMigrate: async (_password: string) => {},
  onRetry: () => {}
};

function render(state: React.ComponentProps<typeof VaultGate>['state']): string {
  return renderToStaticMarkup(
    React.createElement(
      VaultGate,
      { state, ...handlers },
      React.createElement('div', null, 'SENSITIVE_CHILD_MARKER')
    )
  );
}

describe('SEC-1 VaultGate', () => {
  test('renders application children only when the vault is READY', () => {
    expect(render('READY')).toContain('SENSITIVE_CHILD_MARKER');
    expect(render('LOCKED')).not.toContain('SENSITIVE_CHILD_MARKER');
    expect(render('MIGRATION_REQUIRED')).not.toContain('SENSITIVE_CHILD_MARKER');
    expect(render('SETUP_REQUIRED')).not.toContain('SENSITIVE_CHILD_MARKER');
    expect(render('ERROR')).not.toContain('SENSITIVE_CHILD_MARKER');
  });

  test('shows explicit secure actions for setup, migration and unlock states', () => {
    const setup = render('SETUP_REQUIRED');
    expect(setup).toContain('Configura archivio protetto');
    expect(setup).toContain('Archivio professionale');
    expect(setup).toContain('Ambiente dimostrativo');
    expect(setup).not.toContain('id="vault-password"');
    expect(render('LOCKED')).not.toContain('Ambiente dimostrativo');
    expect(render('MIGRATION_REQUIRED')).toContain('Proteggi i dati esistenti');
    expect(render('LOCKED')).toContain('Sblocca Registro');
    expect(render('ERROR')).toContain('Sicurezza non disponibile');
  });
});
