const { test, expect } = require('@playwright/test');

const url = (process.env.NAV_MOBILE_DISCLOSURE_BASE_URL || 'http://127.0.0.1:4173')
  + '/tests/browser/fixtures/nav-back-01-app.html';

async function openClass(browser, width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: width === 320 ? 700 : 844 },
    isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Apri classe 3ª A.*Prova sintetica/i }).click();
  await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
  return { context, page };
}

async function nav(page, section) {
  await page.locator('nav').getByRole('button', { name: section, exact: true }).click();
  await expect(page.getByTestId('header01-context')).toContainText(section);
}

function firstRow(page) {
  return page.locator('[data-testid="matrix-compact-toggle"][aria-controls="matrix-compact-details-fittizio-studente-01"]');
}

test('NAV-MOBILE-BACK / 390 — first Back closes the row, second Back returns to Valutazioni', async ({ browser }) => {
  const { context, page } = await openClass(browser);
  try {
    await nav(page, 'Valutazioni');
    await nav(page, 'Tabellone');
    const row = firstRow(page);
    await row.click();
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    const detail = await page.evaluate(() => history.state);
    expect(detail).toEqual({ classId: 'classe-fittizia-a', tab: 'tabellone', matrixDisclosure: true });
    expect(JSON.stringify(detail)).not.toContain('fittizio-studente-01');
    expect(page.url()).not.toContain('fittizio-studente-01');

    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
    await expect(row).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(0);
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Valutazioni');
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
  } finally { await context.close(); }
});

test('NAV-MOBILE-BACK / 390 — Forward restores only the same live row; manual collapse consumes the entry', async ({ browser }) => {
  const { context, page } = await openClass(browser);
  try {
    await nav(page, 'Tabellone');
    const row = firstRow(page);
    await row.click();
    await page.goBack();
    await expect(row).toHaveAttribute('aria-expanded', 'false');
    await page.goForward();
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    await row.click();
    await expect(row).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
  } finally { await context.close(); }
});

test('NAV-MOBILE-BACK / 320 — switching students stays one disclosure step; protected names remain masked', async ({ browser }) => {
  const { context, page } = await openClass(browser, 320);
  try {
    await nav(page, 'Tabellone');
    const first = firstRow(page);
    const second = page.locator('[data-testid="matrix-compact-toggle"][aria-controls="matrix-compact-details-fittizio-studente-02"]');
    await first.click();
    await second.click();
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await expect(second).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(1);
    await expect(page.getByText('Persona Fittizia Uno', { exact: true })).toHaveCount(0);
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
    await expect(second).toHaveAttribute('aria-expanded', 'false');
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
  } finally { await context.close(); }
});

test('NAV-MOBILE-BACK / 390 — report Back restores row, then inline Back collapses before Riepilogo', async ({ browser }) => {
  const { context, page } = await openClass(browser);
  try {
    await nav(page, 'Tabellone');
    const row = firstRow(page);
    await row.click();
    await page.getByRole('button', { name: 'Apri scheda alunno' }).click();
    await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
    await expect(row).toHaveAttribute('aria-expanded', 'true');
    await page.goBack();
    await expect(row).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
  } finally { await context.close(); }
});

test('NAV-MOBILE-BACK / 390 — explicit tab navigation does not resurrect an old row', async ({ browser }) => {
  const { context, page } = await openClass(browser);
  try {
    await nav(page, 'Tabellone');
    await firstRow(page).click();
    await nav(page, 'Valutazioni');
    await nav(page, 'Tabellone');
    await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(0);
  } finally { await context.close(); }
});


test('NAV-MOBILE-BACK / 390 — leaving an expanded row through the menu does not leave ghost Tabellone entries', async ({ browser }) => {
  const { context, page } = await openClass(browser);
  try {
    await nav(page, 'Tabellone');
    await firstRow(page).click();
    await nav(page, 'Valutazioni');
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
    await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(0);
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
  } finally { await context.close(); }
});

test('NAV-MOBILE-BACK / 390 — Rivedi mission survives an inline Back and an explicit row collapse', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Rivedi', exact: true }).click();
    await page.getByRole('button', { name: /Apri classe 3ª A.*Prova sintetica/i }).click();
    const review = page.getByRole('region', { name: /Rivedi la classe 3ª A.*Prova sintetica/ });
    await expect(review).toBeVisible();
    await review.getByRole('button', { name: /^Tabellone/ }).click();
    const mission = page.getByRole('complementary', { name: /Sessione Rivedi per la classe 3ª A.*Prova sintetica/ });
    await expect(mission).toBeVisible();

    const row = firstRow(page);
    await row.click();
    await page.goBack();
    await expect(row).toHaveAttribute('aria-expanded', 'false');
    await expect(mission).toBeVisible();
    await row.click();
    await row.click();
    await expect(row).toHaveAttribute('aria-expanded', 'false');
    await expect(mission).toBeVisible();
    await expect(mission.getByRole('button', { name: 'Torna a Rivedi' })).toBeVisible();
  } finally { await context.close(); }
});
