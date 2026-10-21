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

    // UI-only preference remains intentionally non-sensitive.
    expect(appSource).toContain("localStorage.setItem('registro_privacy_shield_active'");
  });

  test('wires configurable inactivity auto-lock and an explicit manual lock action', async () => {
    const appSource = await Bun.file('src/App.tsx').text();
    const rootSource = await Bun.file('src/components/SecureRegistroRoot.tsx').text();
    const navbarSource = await Bun.file('src/components/Navbar.tsx').text();
    const typesSource = await Bun.file('src/types.ts').text();
    const utilsSource = await Bun.file('src/utils.ts').text();

    expect(typesSource).toContain('autoLockMinutes?: 0 | 15 | 30 | 60');
    expect(utilsSource).toContain('autoLockMinutes: 15');
    expect(appSource).toContain('settings.autoLockMinutes');
    expect(appSource).toContain('window.setTimeout');
    expect(appSource).toContain("'pointerdown'");
    expect(appSource).toContain("'keydown'");
    expect(appSource).toContain('onLock');
    expect(rootSource).toContain("setGateState('LOCKED')");
    expect(navbarSource).toContain('Blocca Registro');
  });
});
