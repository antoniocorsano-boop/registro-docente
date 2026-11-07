const { test, expect } = require('@playwright/test');

const url = (process.env.BASE_URL || 'http://127.0.0.1:4173')
  + '/tests/browser/fixtures/nav-back-01-app.html';

async function openSyntheticHistory(page) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Apri classe 3ª A.*Prova sintetica/i }).click();
  await expect(page.getByTestId('header01-context')).toContainText('Riepilogo');
  await page.getByTestId('header01-brand-navigation').click();
  await page.getByRole('complementary', { name: 'Navigazione del Registro' })
    .getByRole('button', { name: 'Storico prove' }).click();
  await expect(page.getByRole('heading', { name: /Storico Prove Registrate: 3ª A/ })).toBeVisible();
  await expect(page).toHaveURL(/[?&]tab=storico/);
}

test('REG-NAV-01 / Android 390 — Annulla modifica returns to Storico without changing synthetic grade', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await openSyntheticHistory(page);
    await page.getByRole('button', { name: 'Modifica valutazione' }).click();
    await expect(page.getByRole('heading', { name: 'Modifica Valutazione Esistente' })).toBeVisible();
    await expect(page).toHaveURL(/[?&]tab=voti/);
    const route = await page.evaluate(() => history.state);
    expect(route.tab).toBe('voti');
    expect(route.classId).toBe('classe-fittizia-a');
    expect(JSON.stringify(route)).not.toContain('fittizio-lotto');
    expect(page.url()).not.toContain('fittizio-lotto');

    await expect(page.getByPlaceholder('es. 7.5').first()).toHaveValue('8');
    await page.getByPlaceholder('es. 7.5').first().fill('6');
    await page.getByRole('button', { name: 'Annulla Modifica' }).click();
    await expect(page.getByRole('heading', { name: /Storico Prove Registrate: 3ª A/ })).toBeVisible();
    await expect(page).toHaveURL(/[?&]tab=storico/);
    await expect.poll(() => page.evaluate(() => history.state?.tab)).toBe('storico');

    await page.goForward();
    await expect(page.getByRole('heading', { name: /Storico Prove Registrate: 3ª A/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Modifica valutazione' }).click();
    await expect(page.getByRole('heading', { name: 'Modifica Valutazione Esistente' })).toBeVisible();
    await expect(page.getByPlaceholder('es. 7.5').first()).toHaveValue('8');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('REG-NAV-01 / Android 390 — Back/Forward preserves only an existing authorized editor target', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true
  });
  const page = await context.newPage();
  try {
    await openSyntheticHistory(page);
    await page.getByRole('button', { name: 'Modifica valutazione' }).click();
    await expect(page.getByRole('heading', { name: 'Modifica Valutazione Esistente' })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole('heading', { name: /Storico Prove Registrate: 3ª A/ })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('heading', { name: 'Modifica Valutazione Esistente' })).toBeVisible();
    await expect(page.getByPlaceholder('es. 7.5').first()).toHaveValue('8');
  } finally { await context.close(); }
});
