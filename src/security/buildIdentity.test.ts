import { describe, expect, test } from 'bun:test';
import { resolveBuildIdentity } from '../product/buildIdentity';

describe('BUILD-ID-01 — exact source identity, no release implication', () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';
  test('valid complete commit, compact presentation, explicit lab identity', () => {
    expect(resolveBuildIdentity(sha, 'lab')).toEqual({
      sourceSha: sha, label: 'Collaudo B4.3', text: 'Collaudo B4.3 · 0123456789ab'
    });
    expect(resolveBuildIdentity(sha, 'android').text).toBe('Android · 0123456789ab');
  });
  test('missing, short or invalid commit never masquerades as a known version', () => {
    for (const input of [undefined, '', '01234567', 'g'.repeat(40)]) {
      expect(resolveBuildIdentity(input, 'lab').sourceSha).toBeNull();
      expect(resolveBuildIdentity(input, 'lab').text).toBe('Compilazione non identificata');
    }
  });
  test('the same read-only component appears in gate and drawer, never in the topbar', async () => {
    for (const path of ['src/components/VaultGate.tsx','src/components/Navbar.tsx']) {
      const source = await Bun.file(path).text();
      expect(source).toContain('<BuildIdentity />');
      expect(source).not.toContain('v3.5 Neon');
    }
    expect(await Bun.file('src/components/Header01TopBar.tsx').text()).not.toContain('BuildIdentity');
  });
});
