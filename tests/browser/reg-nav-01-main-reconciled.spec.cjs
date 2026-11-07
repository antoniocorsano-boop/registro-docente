const { test, expect } = require('@playwright/test');

// Exercise the actual compiled app served by vite preview. A /tests/browser/fixtures
// URL falls back to the production Vault page, so never treat it as fixture data.
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const CLASS_NAME = 'Classe sintetica NAV-S1';
const FIRST_STUDENT = 'Rossi Mario';
const SECOND_STUDENT = 'Bianchi Anna';
const TEST_NAME = 'Prova sintetica NAV-S1';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, trace: 'retain-on-failure' });
test.setTimeout(120000); // Full new local Vault + class + two students + grade: not a static page.

async function closeSaveNotice(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await heading.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  }
}

async function fromDrawer(page, label) {
  await page.getByTestId('header01-brand-navigation').click();
  const drawer = page.locator('#registro-navigation-drawer');
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');
  await drawer.getByRole('button', { name: label, exact: true }).click();
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
}

async function expectRoute(page, tab) {
  await expect(page).toHaveURL(new RegExp('[?&]tab=' + tab + '(&|$)'));
  await expect.poll(() => page.evaluate(() => history.state?.tab)).toBe(tab);
}

async function prepareSyntheticHistory(page) {
  await test.step('Initialize fresh isolated local Vault and fictional class', async () => {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
    await page.locator('#vault-password').fill('reg-nav-01-synthetic-only');
    await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
    await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();

    page.once('dialog', dialog => dialog.accept(CLASS_NAME));
    await page.getByRole('button', { name: /Nuova Classe/ }).click();
    await expect(page.getByRole('heading', { name: 'Gestione Elenco Alunni: ' + CLASS_NAME })).toBeVisible();
    await closeSaveNotice(page);

    // The privacy shield can be disabled only inside this disposable synthetic Vault.
    const shield = page.locator('button[title^="Privacy Shield"]');
    await expect(shield).toBeVisible();
    await shield.click();
    for (const student of [FIRST_STUDENT, SECOND_STUDENT]) {
      await page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)').fill(student);
      await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
      await expect(page.getByText(student, { exact: true })).toBeVisible();
      await closeSaveNotice(page);
    }
  });

  await test.step('Record one fictional evaluation, then return to Storico', async () => {
    await fromDrawer(page, 'Storico prove');
    await expectRoute(page, 'storico');
    await page.getByRole('button', { name: /Nuova Valutazione/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();
    await expectRoute(page, 'voti');
    await page.getByPlaceholder('es. Verifica su Fonti Rinnovabili').fill(TEST_NAME);
    await page.getByRole('button', { name: 'Tutti 8', exact: true }).click();
    await page.getByRole('button', { name: 'Salva Valutazioni di Classe', exact: true }).click();
    await closeSaveNotice(page);
    await expect(page.getByRole('heading', { name: 'Storico Prove Registrate: ' + CLASS_NAME })).toBeVisible();
    await expect(page.getByText(TEST_NAME, { exact: true })).toBeVisible();
    await expectRoute(page, 'storico');
  });
}

async function editSyntheticEvaluation(page) {
  await page.locator('button[title="Modifica valutazione"]').first().click();
  await expect(page.getByRole('heading', { name: 'Modifica Valutazione Esistente' })).toBeVisible();
  await expectRoute(page, 'voti');
  await expect(page.getByPlaceholder('es. 7.5').first()).toHaveValue('8');
}

test('REG-NAV-01 / Android 390 — Annulla modifica preserves original vote and history', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await prepareSyntheticHistory(page);
  await test.step('Cancel volatile changes and return to real Storico', async () => {
    await editSyntheticEvaluation(page);
    const route = await page.evaluate(() => history.state);
    expect(route.returnTab).toBe('storico');
    expect(JSON.stringify(route)).not.toContain(TEST_NAME);
    expect(page.url()).not.toContain(TEST_NAME);
    await page.getByPlaceholder('es. 7.5').first().fill('6');
    await page.getByRole('button', { name: 'Annulla Modifica' }).click();
    await expect(page.getByRole('heading', { name: 'Storico Prove Registrate: ' + CLASS_NAME })).toBeVisible();
    await expectRoute(page, 'storico');
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toHaveCount(0);
    await expectRoute(page, 'storico');
  });

  await test.step('Reopen and verify durable original grade remains 8', async () => {
    await editSyntheticEvaluation(page);
    await expect(page.getByPlaceholder('es. 7.5').first()).toHaveValue('8');
    expect(errors).toEqual([]);
  });
});

test('REG-NAV-01 / Android 390 — Back/Forward restores same authorized editor', async ({ page }) => {
  await prepareSyntheticHistory(page);
  await editSyntheticEvaluation(page);
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Storico Prove Registrate: ' + CLASS_NAME })).toBeVisible();
  await expectRoute(page, 'storico');
  await page.goForward({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Modifica Valutazione Esistente' })).toBeVisible();
  await expect(page.getByPlaceholder('es. 7.5').first()).toHaveValue('8');
  await expectRoute(page, 'voti');
});

test('REG-NAV-01 / Android 390 — rapid navigation after cancel uses latest destination', async ({ page }) => {
  await prepareSyntheticHistory(page);
  await editSyntheticEvaluation(page);

  // Force a delayed traversal to expose the otherwise narrow asynchronous race.
  await page.evaluate(() => {
    const originalBack = history.back.bind(history);
    history.back = () => { setTimeout(originalBack, 250); };
  });
  await page.getByRole('button', { name: 'Annulla Modifica' }).click();
  await page.locator('nav').getByRole('button', { name: 'Analisi', exact: true }).click();
  await expectRoute(page, 'analytics');
  await expect(page.getByRole('heading', { name: /Analisi medie/ })).toBeVisible();
  await page.waitForTimeout(350);
  await expectRoute(page, 'analytics');
});
