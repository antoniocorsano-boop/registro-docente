const { test, expect } = require('@playwright/test');
const { navigationButton } = require('./header01-navigation.cjs');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
test.use({ viewport: { width: 360, height: 780 }, trace: 'retain-on-failure' });
test.setTimeout(60000);

async function navigate(page, name) {
  await navigationButton(page).first().click();
  await page.getByRole('complementary').getByRole('button', { name, exact: true }).click();
}

test('CDC-02/S1: on smartphone two sessions can be saved and reopened after returning to Consigli', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('#vault-password').fill('cdc-02-synthetic');
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();

  const className = '2Z CDC-02 sintetica';
  page.once('dialog', dialog => dialog.accept(className));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await navigate(page, 'Consigli di classe');
  const picker = page.getByRole('combobox', { name: 'Seleziona classe per il Consiglio' });
  await picker.selectOption({ label: className });
  const overview = page.getByRole('region', { name: 'Quadro sintetico delle evidenze della classe' });
  await expect(overview).toBeVisible();
  await expect(overview).toContainText('Dati correnti');
  await expect(overview).toContainText('Con prove numeriche');
  await expect(overview).toContainText('Senza prove numeriche');
  await expect(overview).toContainText('Senza voto di ingresso salvato');
  await expect(overview.getByText('0', { exact: true })).toHaveCount(6);
  const noSessionBefore = page.getByText('Nessuna seduta registrata per questa classe e questo anno.');
  await expect(noSessionBefore).toBeVisible();
  const year = await page.getByRole('combobox', { name: 'Seleziona anno scolastico del Consiglio' }).inputValue();
  const start = Number(year.slice(0, 4));
  const date = page.getByRole('textbox', { name: 'Data di nuova seduta' }).or(page.getByLabel('Data di nuova seduta'));
  await page.getByRole('combobox', { name: 'Tipo di nuova seduta' }).selectOption('monitoraggio');
  await date.fill(`${start}-11-09`);
  await page.getByRole('button', { name: 'Registra seduta' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Seduta salvata.' })).toBeVisible();

  await date.fill(`${start}-11-16`);
  await page.getByRole('button', { name: 'Registra seduta' }).click();
  const entries = page.getByRole('list', { name: 'Elenco cronologico delle sedute' }).getByRole('button');
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText(`${start}-11-16`);

  await navigate(page, 'Oggi');
  const confirmation = page.getByRole('alertdialog').filter({ has: page.getByRole('heading', { name: 'Tornare a Oggi?' }) });
  if (await confirmation.isVisible().catch(() => false)) {
    await confirmation.getByRole('button', { name: 'Torna a Oggi' }).click();
  }
  await navigate(page, 'Consigli di classe');
  await picker.selectOption({ label: className });
  const restoredEntries = page.getByRole('list', { name: 'Elenco cronologico delle sedute' }).getByRole('button');
  await expect(restoredEntries).toHaveCount(2);
  await restoredEntries.last().click();
  await expect(page.getByRole('region', { name: 'Seduta recuperata' })).toContainText(`${start}-11-09`);
  // The overview is a live read-only projection; it remains available after navigation.
  await expect(page.getByRole('region', { name: 'Quadro sintetico delle evidenze della classe' })).toBeVisible();

  // Historical records are not grades and do not require a student or per-session votes.
  await expect(page.getByRole('region', { name: 'Tabellone delle valutazioni di ingresso' })).toBeVisible();
  const xOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(xOverflow).toBe(false);
});
