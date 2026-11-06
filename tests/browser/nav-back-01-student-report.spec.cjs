const { test, expect } = require('@playwright/test');
const url = (process.env.NAV_BACK_BASE_URL || 'http://127.0.0.1:4173') + '/tests/browser/fixtures/nav-back-01-app.html';

async function openSyntheticClass(page) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Apri classe 3ª A.*Prova sintetica/i }).click();
  await expect(page.getByTestId('header01-context')).toContainText('3ª A');
}

async function openStudentFromOrigin(page, origin) {
  await page.locator('nav').getByRole('button', { name: origin }).click();
  await expect(page.getByTestId('header01-context')).toContainText(origin);
  if (origin === 'Tabellone') {
    await page.getByTestId('matrix-compact-toggle').first().click();
    await page.getByRole('button', { name: 'Apri scheda alunno' }).click();
  } else {
    const details = page.getByTestId('mobile-analytics-student-detail');
    await details.locator('summary').click();
    await details.locator('article button').first().click();
  }
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
  await expect(page.locator('main select').first()).toHaveValue('fittizio-studente-01');
}

for (const origin of ['Tabellone', 'Analisi']) {
  test(`NAV-BACK-01 / Android 390px — ${origin} → Scheda → Back → Forward`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await openSyntheticClass(page);
    await openStudentFromOrigin(page, origin);

    const route = await page.evaluate(() => ({
      history: window.history.state,
      address: window.location.href
    }));
    expect(route.history).toEqual({
      classId: 'classe-fittizia-a',
      tab: 'report',
      studentId: 'fittizio-studente-01'
    });
    expect(route.address).not.toContain('fittizio-studente-01');
    expect(route.address).toContain('tab=report');

    // page.goBack() exercises the browser popstate used by Android's swipe.
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText(origin);
    await expect(page.getByTestId('header01-context')).toContainText('3ª A');
    if (origin === 'Tabellone') await expect(page.getByTestId('matrix-compact-list')).toBeVisible();
    else await expect(page.getByText('Analisi medie & fasce analitiche')).toBeVisible();

    await page.goForward();
    await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
    await expect(page.locator('main select').first()).toHaveValue('fittizio-studente-01');
    await context.close();
  });
}

test('NAV-BACK-01 / Android 320px — changing selected student preserves selection across Back/Forward', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await openSyntheticClass(page);
  await openStudentFromOrigin(page, 'Tabellone');
  await page.locator('main select').first().selectOption('fittizio-studente-02');
  const state = await page.evaluate(() => window.history.state);
  expect(state.studentId).toBe('fittizio-studente-02');

  await page.goBack();
  await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
  await page.goForward();
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
  await expect(page.locator('main select').first()).toHaveValue('fittizio-studente-02');
  await context.close();
});

test('NAV-BACK-01 — forged or deleted student in history does not open a report', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openSyntheticClass(page);
  await openStudentFromOrigin(page, 'Tabellone');
  await page.evaluate(() => {
    const bad = { classId: 'classe-fittizia-a', tab: 'report', studentId: 'non-esistente' };
    history.replaceState(bad, '', '?class=classe-fittizia-a&tab=report');
    window.dispatchEvent(new PopStateEvent('popstate', { state: bad }));
  });
  await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
  await expect(page.getByTestId('header01-context')).toContainText('3ª A');
  await expect(page.getByText('Scheda Alunno & Profilo delle Competenze')).toHaveCount(0);
});
