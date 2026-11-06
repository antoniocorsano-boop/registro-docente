const { test, expect } = require('@playwright/test');

const url = (process.env.HEADER01_DRAWER_BASE_URL || 'http://127.0.0.1:4173')
  + '/tests/browser/fixtures/nav-back-01-app.html';

for (const width of [390, 320]) {
  test(`HEADER-01 / ${width}px — Copilot launcher never overlays an open navigation drawer`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width, height: width === 320 ? 700 : 844 },
      isMobile: true, hasTouch: true
    });
    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const trigger = page.getByTestId('library-copilot-trigger');
      await expect(trigger).toBeVisible();

      await page.getByTestId('header01-brand-navigation').click();
      const drawer = page.locator('#registro-navigation-drawer');
      await expect(drawer).toBeVisible();
      await expect(drawer).toHaveAttribute('aria-hidden', 'false');
      await expect(trigger).toBeHidden();

      const backup = drawer.getByRole('button', { name: 'Esporta backup cifrato' });
      await expect(backup).toBeVisible();
      await backup.scrollIntoViewIfNeeded();
      const rect = await backup.boundingBox();
      expect(rect).not.toBeNull();
      const isTriggerOverBackup = await page.evaluate(({ x, y }) => {
        const top = document.elementFromPoint(x, y);
        return !!top?.closest('[data-testid="library-copilot-trigger"]');
      }, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
      expect(isTriggerOverBackup).toBe(false);

      // A normal close restores the launcher without changing the class, data or route.
      await drawer.locator('button').first().click();
      await expect(drawer).toHaveAttribute('aria-hidden', 'true');
      await expect(trigger).toBeVisible();
      await expect(page.getByTestId('header01-context')).toContainText('Oggi');
    } finally {
      await context.close();
    }
  });
}
