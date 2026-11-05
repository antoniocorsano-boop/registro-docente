const { test, expect } = require('@playwright/test');

const url = (process.env.HEADER01_BASE_URL || 'http://127.0.0.1:4173') + '/tests/browser/fixtures/header01-navbar.html';

for (const width of [320, 390]) {
  test(`HEADER-01 real Navbar / ${width}px: one logo, one lock, no false saved status`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width, height: width === 320 ? 700 : 844 }, isMobile: true, hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const brand = page.getByTestId('header01-brand-navigation');
    const privacy = page.getByTestId('header01-privacy');
    const lock = page.getByTestId('header01-lock');
    await expect(page.getByTestId('header01-mobile-integration')).toBeVisible();
    await expect(brand).toBeVisible();
    await expect(privacy).toBeVisible();
    await expect(lock).toBeVisible();
    await expect(page.getByTestId('header01-context')).toContainText('Valutazioni');
    await expect(page.getByTestId('header01-context')).toContainText('Classe 3ª A');
    await expect(page.getByTestId('header01-save-notice')).toHaveCount(0);
    await expect(page.locator('.badge-ok:visible')).toHaveCount(0);
    await expect(page.locator('[aria-label="Imposta blocco automatico"]:visible')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Blocca Registro' })).toHaveCount(1);
    await expect(page.locator('[data-testid="header01-open-menu"]')).toHaveCount(0);

    const sizes = await page.evaluate(() => {
      const ids = ['header01-brand-navigation', 'header01-privacy', 'header01-lock'];
      return {
        scrollWidth: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
        rects: ids.map(id => {
          const { x, width, height, right } = document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect();
          return { x, width, height, right };
        }),
      };
    });
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.viewport + 1);
    for (const rect of sizes.rects) {
      expect(rect.width).toBeGreaterThanOrEqual(48);
      expect(rect.height).toBeGreaterThanOrEqual(48);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(width + 1);
    }

    await brand.click();
    await expect(page.getByTestId('header01-go-home')).toBeFocused();
    await expect(page.getByTestId('header01-integration-active-tab')).toHaveText('voti');
    await expect(page.getByTestId('header01-integration-home-visits')).toContainText('Visite Oggi: 0');
    await page.getByTestId('header01-auto-lock').selectOption('30');
    await expect(page.getByTestId('header01-integration-auto-lock')).toContainText('30 minuti');

    await page.keyboard.press('Escape');
    await expect(brand).toBeFocused();
    await brand.click();
    await page.getByTestId('header01-go-home').click();
    await expect(page.getByTestId('header01-home-confirm')).toBeVisible();
    await expect(page.getByTestId('header01-integration-active-tab')).toHaveText('voti');
    await page.getByRole('button', { name: 'Rimani qui' }).click();
    await expect(page.getByTestId('header01-home-confirm')).toHaveCount(0);
    await expect(page.getByTestId('header01-integration-home-visits')).toContainText('Visite Oggi: 0');

    await brand.click();
    await page.getByTestId('header01-go-home').click();
    await page.getByRole('button', { name: 'Torna a Oggi' }).click();
    await expect(page.getByTestId('header01-integration-active-tab')).toHaveText('home');
    await expect(page.getByTestId('header01-integration-home-visits')).toContainText('Visite Oggi: 1');

    await privacy.click();
    await expect(privacy).toHaveAttribute('aria-pressed', 'false');
    await lock.click();
    await expect(page.getByTestId('header01-integration-lock-count')).toContainText('Blocchi: 1');
    await context.close();
  });
}

test('HEADER-01 real Navbar desktop keeps existing specialist navigation and Vault controls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('header01-mobile-integration')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Imposta blocco automatico' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Blocca Registro' })).toHaveCount(1);
  await expect(page.getByText('Tabellone', { exact: true }).first()).toBeVisible();
});

test('HEADER-01 real Navbar: keyboard remains usable and lock reachable with focused editor', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Campo di prova tastiera' }).focus();
  await expect(page.getByTestId('header01-privacy')).toBeVisible();
  await expect(page.getByTestId('header01-lock')).toBeVisible();
  await context.close();
});
