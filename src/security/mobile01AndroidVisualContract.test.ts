import { describe, expect, test } from 'bun:test';

const root = new URL('../../', import.meta.url);
const load = async (path: string) => Bun.file(new URL(path, root)).text();

describe('MOBILE-01/UX-QA-03 Android visual review guard', () => {
  test('header and navigation drawer use native SystemBars insets with web fallback', async () => {
    const css = await load('src/index.css');
    expect(css).toContain('[data-testid="header01-topbar"]');
    expect(css).toContain('padding-top: var(--safe-area-inset-top, env(safe-area-inset-top, 0px));');
    expect(css).toContain('#registro-navigation-drawer');
    expect(css).toContain('calc(1.25rem + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))');
    expect(css).toContain('var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))');
    const native = await load('mobile/android-probe/package.json');
    expect(JSON.parse(native).dependencies['@capacitor/core']).toBe('8.6.0');
    const browser = await load('tests/browser/header-01-navbar-integration.spec.cjs');
    expect(browser).toContain("setProperty('--safe-area-inset-top', '32px')");
    expect(browser).toContain('MOBILE-01 Android status bar:');
  });

  test('full class identity remains preserved while manage never overlays class title', async () => {
    const home = await load('src/components/HomeView.tsx');
    expect(home).toContain('const classShortLabel = nameSegments[0]?.trim() || classData.name;');
    expect(home).toContain("nameSegments.slice(1).join(' - ').trim()");
    expect(home).toContain('data-testid="class-card-short-name"');
    expect(home).toContain('data-testid="class-card-descriptor"');
    expect(home).toContain('data-testid="class-card-manage"');
    expect(home).toContain('aria-label={`Apri classe ${classData.name}`}');
    expect(home).toContain('aria-label={`Gestisci classe ${classData.name}`}');
    expect(home).not.toContain('absolute top-1 right-1 min-h-[44px] min-w-[44px]');
    const browser = await load('tests/browser/today-01-home-oggi-router.spec.cjs');
    expect(browser).toContain('MOBILE-01 Android cards: long class names');
    expect(browser).toContain('for (const width of [390, 320])');
  });

  test('never declares an Android visual PASS from a synthetic browser test or debug build alone', async () => {
    const config = JSON.parse(await load('mobile/android-probe/capacitor.config.json'));
    expect(config.appId).toBe('it.trama.registrodocente.prova');
    const manifestWorkflow = await load('.github/workflows/mobile-01-android-probe.yml');
    expect(manifestWorkflow).toContain('offline_end_to_end_qualified=false');
    expect(manifestWorkflow).toContain('vault_android_qualified=false');
    expect(manifestWorkflow).toContain('android_hpr_qualified=false');
    expect(manifestWorkflow).not.toContain('android_hpr_qualified=true');
  });
});
