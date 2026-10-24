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

  test('UXT-A uses separate compact mobile and desktop Vault presentations with touch-safe mobile controls', async () => {
    const controls = await source('components/VaultControls.tsx');

    expect(controls).toContain('md:hidden');
    expect(controls).toContain('hidden md:flex');
    expect(controls).toContain('min-h-11');
    expect(controls).toContain('min-w-11');
    expect(controls).toContain('aria-label="Blocca Registro"');
    expect(controls).not.toContain('fixed bottom-16 md:bottom-3');
  });

  test('UXT-A reuses one mobile touch-target contract on audited high-impact operational controls', async () => {
    const evaluations = await source('components/EvaluationsView.tsx');
    const behaviors = await source('components/BehaviorsView.tsx');
    const history = await source('components/HistoryView.tsx');

    for (const view of [evaluations, behaviors, history]) {
      expect(view).toContain("import { MOBILE_TOUCH_TARGET_CLASS } from './mobileTouch';");
      expect(view).toContain('MOBILE_TOUCH_TARGET_CLASS');
    }

    expect(evaluations).toContain('MOBILE_TOUCH_TARGET_CLASS} px-2 py-0.5');
    expect(evaluations).toContain('MOBILE_TOUCH_TARGET_CLASS} p-1.5');
    expect(behaviors).toContain('MOBILE_TOUCH_TARGET_CLASS} px-2.5 py-1');
    expect(history).toContain('MOBILE_TOUCH_TARGET_CLASS} p-2');
  });
});
