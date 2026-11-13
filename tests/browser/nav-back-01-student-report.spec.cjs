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
    await page.locator('[data-testid="matrix-compact-toggle"][aria-controls="matrix-compact-details-fittizio-studente-01"]').click();
    await page.getByRole('button', { name: 'Apri scheda alunno' }).click();
  } else {
    const details = page.getByTestId('mobile-analytics-student-detail');
    await page.getByTestId('analytics-view-students').click();
    await details.locator('article button').first().click();
  }
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
  const actualStudentId = await page.locator('main select').first().inputValue();
  expect(['fittizio-studente-01', 'fittizio-studente-02']).toContain(actualStudentId);
  return actualStudentId;
}

for (const origin of ['Tabellone', 'Analisi']) {
  test(`NAV-BACK-01 / Android 390px — ${origin} → Scheda → Back → Forward`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await openSyntheticClass(page);
    const selectedStudentId = await openStudentFromOrigin(page, origin);

    const route = await page.evaluate(() => ({
      history: window.history.state,
      address: window.location.href
    }));
    expect(route.history).toEqual({
      classId: 'classe-fittizia-a',
      tab: 'report',
      studentId: selectedStudentId,
      __tramaHistoryEntryId: expect.any(String),
      __tramaHistoryEpoch: expect.any(String),
      __tramaHistoryPosition: expect.any(Number)
    });
    expect(route.history.__tramaHistoryPosition).toBeGreaterThanOrEqual(0);
    expect(route.address).not.toContain(selectedStudentId);
    expect(route.address).toContain('tab=report');

    // page.goBack() exercises the browser popstate used by Android's swipe.
    await page.goBack();
    await expect(page.getByTestId('header01-context')).toContainText(origin);
    await expect(page.getByTestId('header01-context')).toContainText('3ª A');
    if (origin === 'Tabellone') await expect(page.getByTestId('matrix-compact-list')).toBeVisible();
    else await expect(page.getByTestId('analytics-mobile-views')).toBeVisible();

    await page.goForward();
    await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
    await expect(page.locator('main select').first()).toHaveValue(selectedStudentId);
    await context.close();
  });
}

test('NAV-BACK-01 / Android 320px — changing selected student preserves selection across Back/Forward', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await openSyntheticClass(page);
  const initialStudentId = await openStudentFromOrigin(page, 'Tabellone');
  const nextStudentId = initialStudentId === 'fittizio-studente-01'
    ? 'fittizio-studente-02' : 'fittizio-studente-01';
  await page.locator('main select').first().selectOption(nextStudentId);
  const state = await page.evaluate(() => window.history.state);
  expect(state.studentId).toBe(nextStudentId);

  await page.goBack();
  await expect(page.getByTestId('header01-context')).toContainText('Tabellone');
  await page.goForward();
  await expect(page.getByTestId('header01-context')).toContainText('Scheda alunno');
  await expect(page.locator('main select').first()).toHaveValue(nextStudentId);
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

for (const width of [320, 390]) {
  test('MOBILE-DENSITY-04 — ' + width + ' essential/dossier, selection, privacy and readable evidence', async ({ page }) => {
    await page.setViewportSize({ width, height: width === 320 ? 700 : 844 });
    await page.goto(url + '?visualRoster=8');
    await page.getByRole('button', { name: /Apri classe 3ª A.*Prova sintetica/i }).click();
    await openStudentFromOrigin(page, 'Tabellone');
    const root = page.getByTestId('student-report-workspace');
    const essential = page.getByTestId('student-report-essential');
    const dossier = page.getByTestId('student-report-dossier');
    const select = root.getByRole('combobox', { name: 'Seleziona alunno' });
    await expect(essential).toBeVisible();
    await expect(dossier).toBeHidden();
    await expect(essential.getByTestId('student-report-average')).toHaveText('8,5');
    await expect(essential.getByTestId('student-report-grade-count')).toHaveText('2');
    await expect(root.getByRole('button', { name: 'Essenziale', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const out = process.env.REPORT_EVIDENCE_DIR || '../browser-evidence';
    require('node:fs').mkdirSync(out, { recursive: true });
    await page.screenshot({ path: out + '/student-report-' + width + '-essential.png' });
    await root.getByRole('button', { name: 'Dossier', exact: true }).click();
    await expect(essential).toBeHidden();
    await expect(dossier).toBeVisible();
    await expect(dossier.locator('details[open]')).toHaveCount(0);
    await dossier.getByText('Elenco valutazioni', { exact: true }).click();
    await expect(dossier.locator('details[open]')).toHaveCount(1);
    await expect(dossier.locator('details[open]')).toContainText('Esercizio sintetico Q2');
    await page.screenshot({ path: out + '/student-report-' + width + '-grades.png' });
    await dossier.getByText('Comportamenti e partecipazione', { exact: true }).click();
    await expect(dossier.locator('details[open]')).toHaveCount(1);
    await expect(dossier.locator('details[open]')).toContainText('Nessuna nota comportamentale');
    await select.selectOption('fittizio-studente-02');
    await expect(essential).toBeVisible();
    await expect(essential.getByTestId('student-report-average')).toHaveText('6,5');
    await expect(dossier).toBeHidden();
    const privacy = page.getByTestId('header01-privacy');
    if (await privacy.getAttribute('data-privacy-state') !== 'protected') await privacy.click();
    await expect(select).not.toContainText('Persona Fittizia Due');
    await page.evaluate(() => document.documentElement.style.fontSize = '200%');
    await expect(essential).toBeVisible();
    expect(await essential.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: out + '/student-report-' + width + '-200.png' });
  });
}
