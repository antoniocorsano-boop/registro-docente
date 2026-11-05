const { test, expect } = require('@playwright/test');

const baseUrl = process.env.HEADER01_BASE_URL || 'http://127.0.0.1:4173';
const fixture = baseUrl + '/tests/browser/fixtures/header01.html';

for (const { width, height } of [
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 1280, height: 900 },
]) {
  test(`HEADER-01 isolated Chromium — controls and geometry at ${width}x${height}`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width, height },
      isMobile: width < 500,
      hasTouch: width < 500,
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await page.goto(fixture, { waitUntil: 'domcontentloaded' });

    const header = page.getByTestId('header01-topbar');
    const menu = page.getByTestId('header01-open-menu');
    const privacy = page.getByTestId('header01-privacy');
    const lock = page.getByTestId('header01-lock');

    await expect(header).toBeVisible();
    await expect(menu).toBeVisible();
    await expect(privacy).toBeVisible();
    await expect(lock).toBeVisible();
    await expect(page.getByTestId('header01-context')).toContainText('Valutazioni');
    await expect(page.getByTestId('header01-context')).toContainText('Classe 2C');
    await expect(privacy).toHaveAttribute('aria-pressed', 'true');
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await expect(menu).toHaveAttribute('aria-controls', 'header01-test-drawer');

    const geometry = await page.evaluate(() => {
      const h = document.querySelector('[data-testid="header01-topbar"]');
      const selectors = ['header01-open-menu', 'header01-privacy', 'header01-lock'];
      const buttons = selectors.map(id => {
        const element = document.querySelector(`[data-testid="${id}"]`);
        if (!element) throw new Error('Missing control ' + id);
        const r = element.getBoundingClientRect();
        return { id, left: r.left, right: r.right, width: r.width, height: r.height };
      });
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        headerWidth: h.getBoundingClientRect().width,
        buttons,
      };
    });
    expect(geometry.documentWidth).toBeLessThanOrEqual(width + 1);
    expect(geometry.viewportWidth).toBe(width);
    for (const button of geometry.buttons) {
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.left).toBeGreaterThanOrEqual(0);
      expect(button.right).toBeLessThanOrEqual(width + 1);
    }

    await privacy.click();
    await expect(privacy).toHaveAttribute('aria-pressed', 'false');
    await expect(privacy).toHaveAttribute('aria-label', 'Nomi visibili. Proteggi i nomi');
    await lock.click();
    await expect(page.getByTestId('header01-lock-clicks')).toContainText('Blocchi: 1');
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('header01-menu-open')).toBeVisible();

    await page.getByTestId('header01-long-context').click();
    const afterLongTitle = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }));
    expect(afterLongTitle.scrollWidth).toBeLessThanOrEqual(width + 1);

    await context.close();
  });
}

test('HEADER-01 isolated Chromium — save evidence is announced, not inferred', async ({ page }) => {
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

test('HEADER-01 isolated Chromium — text input does not displace critical actions', async ({ browser }) => {
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
