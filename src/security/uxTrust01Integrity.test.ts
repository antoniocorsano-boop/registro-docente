import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';

const source = async (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('UX-TRUST-01 Option B integrity', () => {
  test('UXT-A delegates READY-state vault controls to a compact responsive component without changing shell clearance', async () => {
    const root = await source('components/SecureRegistroRoot.tsx');
    const app = await source('App.tsx');

    expect(app).toContain('pb-36 md:pb-20');
    expect(root).toContain("import { VaultControls } from './VaultControls';");
    expect(root).toContain('<VaultControls');
    expect(root).not.toContain('fixed bottom-16 md:bottom-3 right-3 z-50 flex items-center gap-2');
  });
});
