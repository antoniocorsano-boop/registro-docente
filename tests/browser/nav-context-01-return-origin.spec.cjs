const { test, expect } = require('@playwright/test');

const url = (process.env.NAV_CONTEXT_BASE_URL || 'http://127.0.0.1:4173')
  + '/tests/browser/fixtures/nav-back-01-app.html';

async function openClass(page) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Apri classe 3ª A.*Prova sintetica/i }).click();
  await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
}

async function navigateTo(page, tab) {
  await page.locator('nav').getByRole('button', { name: tab }).click();
  await expect(page.getByTestId('header01-context')).toContainText(tab);
}

test('NAV-CONTEXT-01 / Android 390 — Tabellone restores the selected student row and mode after Back', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  await openClass(page);
  await navigateTo(page, 'Tabellone');

  // The same compact row is opened before and after the report detour.
  const target = page.locator('[data-testid="matrix-compact-toggle"][aria-controls="matrix-compact-details-fittizio-studente-01"]');
  await page.getByRole('button', { name: 'Per Tipologia' }).click();
  await target.click();
  await expect(target).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('region', { name: 'Medie per tipologia' })).toBeVisible();
  await page.getByRole('button', { name: 'Apri scheda alunno' }).click();
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');

  const reportState = await page.evaluate(() => window.history.state);
  expect(reportState).toEqual({
    classId: 'classe-fittizia-a', tab: 'report', studentId: 'fittizio-studente-01'
  });
  expect(page.url()).not.toContain('fittizio-studente-01');
  expect(JSON.stringify(reportState)).not.toContain('expandedStudentId');

  await page.goBack();
  await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
  await expect(target).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Medie per tipologia' })).toBeVisible();

  await page.goForward();
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
  await page.goBack();
  await expect(target).toHaveAttribute('aria-expanded', 'true');

  // Ordinary menu navigation is NOT a report return. No stale disclosure.
  await navigateTo(page, 'Analisi');
  await navigateTo(page, 'Tabellone');
  await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(0);
  await context.close();
});

test('NAV-CONTEXT-01 / Android 390 — Analisi reopens student details and retains the calculation mode', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  await openClass(page);
  await navigateTo(page, 'Analisi');

  const section = page.getByTestId('mobile-analytics-student-detail');
  await section.locator('summary').click();
  await expect(section).toHaveAttribute('open', '');
  await section.locator('article button').first().click();
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
  await page.goBack();
  await expect(page.getByTestId('header01-context')).toContainText('Analisi');
  await expect(section).toHaveAttribute('open', '');
  await expect(section.locator('article button').first()).toBeVisible();

  // Going back a second time must restore the real prior dashboard.
  await page.goBack();
  await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
  await context.close();
});

test('NAV-CONTEXT-01 / Android 320 — report detour does not reveal a private student name or overflow the viewport', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  await openClass(page);
  await navigateTo(page, 'Tabellone');
  const row = page.locator('[data-testid="matrix-compact-toggle"][aria-controls="matrix-compact-details-fittizio-studente-01"]');
  await row.click();
  await page.getByRole('button', { name: 'Apri scheda alunno' }).click();
  await page.goBack();
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Persona Fittizia Uno', { exact: true })).toHaveCount(0);
  const geometry = await page.evaluate(() => ({
    content: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth
  }));
  expect(geometry.content).toBeLessThanOrEqual(geometry.viewport + 1);
  await context.close();
});
