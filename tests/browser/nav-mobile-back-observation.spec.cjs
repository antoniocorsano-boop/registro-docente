const { test, expect } = require('@playwright/test');

const baseURL = process.env.NAV_MOBILE_BACK_BASE_URL || 'http://127.0.0.1:4173';
const fixture = baseURL + '/tests/browser/fixtures/nav-back-01-app.html';

async function pageWithClass(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(fixture, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Apri classe 3ª A.*Prova sintetica/i }).click();
  await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
  return { context, page };
}

async function switchSection(page, title) {
  await page.locator('nav').getByRole('button', { name: title, exact: true }).click();
  await expect(page.getByTestId('header01-context')).toContainText(title);
}

test('NAV-MOBILE-BACK / Android 390 — chronology of Riepilogo → Valutazioni → Tabellone → Back → Back', async ({ browser }) => {
  const { context, page } = await pageWithClass(browser);
  try {
    await switchSection(page, 'Valutazioni');
    await switchSection(page, 'Tabellone');
    const row = page.locator('[data-testid="matrix-compact-toggle"]').first();
    await row.click();
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    expect(await page.evaluate(() => history.state)).toEqual({ classId: 'classe-fittizia-a', tab: 'tabellone' });

    // This is the behavior of the current candidate: disclosure does not push a history entry.
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Valutazioni');
    expect(await page.evaluate(() => history.state)).toEqual({ classId: 'classe-fittizia-a', tab: 'voti' });
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');

    await page.goForward();
    await expect(page.getByTestId('header01-context')).toContainText('Valutazioni');
    await page.goForward();
    await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
    await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('NAV-MOBILE-BACK / Android 390 — Scheda alunno is a real route and returns to the same expanded row', async ({ browser }) => {
  const { context, page } = await pageWithClass(browser);
  try {
    await switchSection(page, 'Tabellone');
    const row = page.locator('[data-testid="matrix-compact-toggle"]').first();
    await row.click();
    await page.getByRole('button', { name: 'Apri scheda alunno' }).click();
    await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
    await expect(row).toHaveAttribute('aria-expanded', 'true');
  } finally {
    await context.close();
  }
});

test('NAV-MOBILE-BACK / Android 320 — each tab transition creates an ordinary Back entry with the same class', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    await page.goto(fixture, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Apri classe 3ª A.*Prova sintetica/i }).click();
    await switchSection(page, 'Tabellone');
    await switchSection(page, 'Valutazioni');
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Oggi');
  } finally {
    await context.close();
  }
});
