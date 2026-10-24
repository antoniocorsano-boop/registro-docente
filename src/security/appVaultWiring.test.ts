import { describe, expect, test } from 'bun:test';

const SENSITIVE_KEYS = [
  'STORAGE_KEY',
  'SETTINGS_KEY',
  'UDA_KEY',
  'CUSTOM_TESTS_KEY',
  'SUBMISSIONS_KEY',
  'META_KEY'
] as const;

describe('SEC-1 application vault wiring', () => {
  test('boots through SecureRegistroRoot before rendering App', async () => {
    const mainSource = await Bun.file('src/main.tsx').text();

    expect(mainSource).toContain('SecureRegistroRoot');
    expect(mainSource).toContain('<SecureRegistroRoot');
  });

  test('App consumes an unlocked secure snapshot and storage adapter', async () => {
    const appSource = await Bun.file('src/App.tsx').text();

    expect(appSource).toContain('initialSnapshot');
    expect(appSource).toContain('secureStorage');
  });

  test('App never reads or writes sensitive datasets through localStorage', async () => {
    const appSource = await Bun.file('src/App.tsx').text();

    for (const key of SENSITIVE_KEYS) {
      expect(appSource).not.toContain(`localStorage.getItem(${key})`);
      expect(appSource).not.toContain(`localStorage.setItem(${key}`);
    }
    expect(appSource).not.toContain('localStorage.clear()');

    // PRIVACY-01: the display shield is intentionally session-only and fails closed on reload.
    expect(appSource).not.toContain('registro_privacy_shield_active');
  });

  test('wires configurable inactivity auto-lock and an explicit manual lock action', async () => {
    const rootSource = await Bun.file('src/components/SecureRegistroRoot.tsx').text();
    const controlsSource = await Bun.file('src/components/VaultControls.tsx').text();

    expect(rootSource).toContain('AUTO_LOCK_STORAGE_KEY');
    expect(rootSource).toContain('15 * 60_000');
    expect(rootSource).toContain('window.setTimeout');
    expect(rootSource).toContain("'pointerdown'");
    expect(rootSource).toContain("'keydown'");
    expect(rootSource).toContain("setGateState('LOCKED')");
    expect(rootSource).toContain('<VaultControls');
    expect(controlsSource).toContain('Mai durante la lezione');
    expect(controlsSource).toContain('Blocca Registro');
  });
});