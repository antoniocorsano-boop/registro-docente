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
  const toggle = section.getByTestId('analytics-compact-toggle').first();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await section.locator('article button').first().click();
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
  await page.goBack();
  await expect(page.getByTestId('header01-context')).toContainText('Analisi');
  await expect(section).toHaveAttribute('open', '');
  await expect(section.locator('article button').first()).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(section.locator('[data-testid="analytics-compact-detail"]:visible')).toHaveCount(1);

  // Going back a second time must restore the real prior dashboard.
  await page.goBack();
  await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
  await context.close();
});

test('NAV-CONTEXT-01 — an explicit Analisi → Tabellone → Analisi route resets mobile student detail', async ({ browser }) => {
  for (const width of [390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 }, isMobile: true, hasTouch: true
    });
    try {
      const page = await context.newPage();
      await openClass(page);
      await navigateTo(page, 'Analisi');
      let section = page.getByTestId('mobile-analytics-student-detail');

      // Ordinary navigation must discard manually expanded UI state.
      await section.locator('summary').click();
      await expect(section).toHaveAttribute('open', '');
      await navigateTo(page, 'Tabellone');
      await navigateTo(page, 'Analisi');
      section = page.getByTestId('mobile-analytics-student-detail');
      await expect(section).not.toHaveAttribute('open', '');
      await expect(section.getByPlaceholder('Cerca alunno')).toBeHidden();

      // Legitimate report Back still restores an open detail, but only once.
      await section.locator('summary').click();
      await section.locator('article button').first().click();
      await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
      await page.goBack();
      await expect(page.getByTestId('header01-context')).toContainText('Analisi');
      section = page.getByTestId('mobile-analytics-student-detail');
      await expect(section).toHaveAttribute('open', '');

      await navigateTo(page, 'Tabellone');
      await navigateTo(page, 'Analisi');
      section = page.getByTestId('mobile-analytics-student-detail');
      await expect(section).not.toHaveAttribute('open', '');
      await expect(section.getByPlaceholder('Cerca alunno')).toBeHidden();
    } finally {
      await context.close();
    }
  }
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

test('NAV-CONTEXT-01 — a privacy toggle while in report scrubs the saved visible-name search', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  await openClass(page);
  await navigateTo(page, 'Analisi');
  const privacy = page.getByTestId('header01-privacy');
  await privacy.click(); // privacy off, purely synthetic data
  await expect(privacy).toHaveAttribute('data-privacy-state', 'visible');

  const section = page.getByTestId('mobile-analytics-student-detail');
  await section.locator('summary').click();
  const search = section.getByPlaceholder('Cerca alunno');
  await search.fill('Persona Fittizia');
  await section.locator('article button').first().click();
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');

  await privacy.click(); // turn protection ON while Analytics is unmounted
  await expect(privacy).toHaveAttribute('data-privacy-state', 'protected');
  await privacy.click(); // return to visible mode: old search must remain scrubbed
  await expect(privacy).toHaveAttribute('data-privacy-state', 'visible');

  await page.goBack();
  await expect(page.getByTestId('header01-context')).toContainText('Analisi');
  await expect(section).toHaveAttribute('open', '');
  await expect(search).toHaveValue('');
  await page.goForward();
  await page.goBack();
  await expect(search).toHaveValue('');
  await context.close();
});

test('NAV-CONTEXT-01 — a backup action leaves the report and discards the previous disclosure', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  await openClass(page);
  await navigateTo(page, 'Tabellone');
  const row = page.locator('[data-testid="matrix-compact-toggle"][aria-controls="matrix-compact-details-fittizio-studente-01"]');
  await row.click();
  await page.getByRole('button', { name: 'Apri scheda alunno' }).click();
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');

  await page.getByTestId('header01-brand-navigation').click();
  await page.getByRole('button', { name: 'Esporta backup cifrato' }).click();
  await expect(page.getByTestId('header01-context')).toContainText('Privacy');
  // The backup navigation is explicit, even though legacy code does not push
  // a new history entry. Back must NOT revive the old expanded row.
  await page.goBack();
  await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
  await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(0);
  await context.close();
});
