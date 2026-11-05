const { test, expect } = require('@playwright/test');

const baseUrl = process.env.HEADER01_BASE_URL || 'http://127.0.0.1:4173';
const fixture = baseUrl + '/tests/browser/fixtures/header01.html';

for (const { width, height } of [
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
]) {
  test(`HEADER-01 redesigned — single brand navigation and geometry at ${width}x${height}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: width < 500,
      hasTouch: width < 500,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(fixture, { waitUntil: 'domcontentloaded' });

    const header = page.getByTestId('header01-topbar');
    const brand = page.getByTestId('header01-brand-navigation');
    const privacy = page.getByTestId('header01-privacy');
    const lock = page.getByTestId('header01-lock');

    await expect(header).toBeVisible();
    await expect(brand).toBeVisible();
    await expect(privacy).toBeVisible();
    await expect(lock).toBeVisible();
    await expect(page.getByTestId('header01-open-menu')).toHaveCount(0);
    await expect(page.getByTestId('header01-context')).toContainText('Valutazioni');
    await expect(page.getByTestId('header01-context')).toContainText('Classe 2C');
    await expect(privacy).toHaveAttribute('aria-pressed', 'true');
    await expect(brand).toHaveAttribute('aria-expanded', 'false');
    await expect(brand).toHaveAttribute('aria-controls', 'header01-test-drawer');
    await expect(brand).toHaveAttribute('aria-label', 'Apri navigazione del Registro');

    const geometry = await page.evaluate(() => {
      const selectors = ['header01-brand-navigation', 'header01-privacy', 'header01-lock'];
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        buttons: selectors.map(id => {
          const el = document.querySelector(`[data-testid="${id}"]`);
          if (!el) throw new Error('Missing control ' + id);
          const r = el.getBoundingClientRect();
          return { id, left: r.left, right: r.right, width: r.width, height: r.height };
        }),
      };
    });
    expect(geometry.documentWidth).toBeLessThanOrEqual(width + 1);
    expect(geometry.viewportWidth).toBe(width);
    for (const button of geometry.buttons) {
      expect(button.width).toBeGreaterThanOrEqual(48);
      expect(button.height).toBeGreaterThanOrEqual(48);
      expect(button.left).toBeGreaterThanOrEqual(0);
      expect(button.right).toBeLessThanOrEqual(width + 1);
    }

    // Brand opens the drawer and does not silently erase the work context.
    await brand.click();
    await expect(brand).toHaveAttribute('aria-expanded', 'true');
    await expect(brand).toHaveAttribute('aria-label', 'Chiudi navigazione del Registro');
    await expect(page.getByTestId('header01-go-home')).toBeFocused();
    await expect(page.getByTestId('header01-home-visits')).toContainText('Visite Oggi: 0');
    await expect(page.getByTestId('header01-context')).toContainText('Valutazioni');

    await page.getByTestId('header01-auto-lock').selectOption('30');
    await expect(page.getByTestId('header01-auto-lock-minutes')).toContainText('30 minuti');

    await page.keyboard.press('Escape');
    await expect(brand).toHaveAttribute('aria-expanded', 'false');
    await expect(brand).toBeFocused();

    await brand.click();
    await page.getByTestId('header01-go-home').click();
    await expect(page.getByTestId('header01-context')).toContainText('Oggi');
    await expect(page.getByTestId('header01-context')).toContainText('Registro Docente');
    await expect(page.getByTestId('header01-home-visits')).toContainText('Visite Oggi: 1');

    await privacy.click();
    await expect(privacy).toHaveAttribute('aria-pressed', 'false');
    await expect(privacy).toHaveAttribute('aria-label', 'Nomi visibili. Proteggi i nomi');
    await lock.click();
    await expect(page.getByTestId('header01-lock-clicks')).toContainText('Blocchi: 1');

    await page.getByTestId('header01-long-context').click();
    const longTitle = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(longTitle.scrollWidth).toBeLessThanOrEqual(width + 1);
    await context.close();
  });
}

test('HEADER-01 redesigned — save evidence, never persistent anonymous green', async ({ page }) => {
  await page.goto(fixture, { waitUntil: 'domcontentloaded' });

  await expect(page.getByTestId('header01-save-notice')).toHaveCount(0);
  await page.getByTestId('header01-show-error').click();
  const error = page.getByTestId('header01-save-notice');
  await expect(error).toHaveAttribute('role', 'alert');
  await expect(error).toContainText('Salvataggio non riuscito');

  await page.getByTestId('header01-clear-status').click();
  await expect(page.getByTestId('header01-save-notice')).toHaveCount(0);
  await page.getByTestId('header01-show-success').click();
  const saved = page.getByTestId('header01-save-notice');
  await expect(saved).toHaveAttribute('role', 'status');
  await expect(saved).toContainText("Salvato nell'archivio locale");
  await expect(page.locator('.animate-ping')).toHaveCount(0);
});

test('HEADER-01 redesigned — keyboard focus does not displace critical security controls', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(fixture, { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Campo di prova tastiera' }).focus();
  await expect(page.getByTestId('header01-privacy')).toBeVisible();
  await expect(page.getByTestId('header01-lock')).toBeVisible();
  await context.close();
});

test('HEADER-01 redesigned — 200% text size at 320px retains all critical controls', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(fixture, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await expect(page.getByTestId('header01-brand-navigation')).toBeVisible();
  await expect(page.getByTestId('header01-privacy')).toBeVisible();
  await expect(page.getByTestId('header01-lock')).toBeVisible();
  const geometry = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    right: document.querySelector('[data-testid="header01-lock"]').getBoundingClientRect().right,
  }));
  expect(geometry.scroll).toBeLessThanOrEqual(geometry.viewport + 1);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewport + 1);
  await context.close();
});
