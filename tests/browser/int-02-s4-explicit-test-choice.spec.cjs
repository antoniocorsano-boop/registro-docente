const { test, expect } = require('@playwright/test');
const { navigationButton } = require('./header01-navigation.cjs');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';

test.use({ viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' });
test.setTimeout(120000);

async function capture(page, file) {
  const dir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
  await fs.promises.mkdir(dir, { recursive: true });
  const dest = path.join(dir, file);
  await page.screenshot({ path: dest, fullPage: true, animations: 'disabled' });
  expect((await fs.promises.stat(dest)).size).toBeGreaterThan(4000);
}

test('INT-02/S4b: Stampa e Analisi non aprono implicitamente il primo test del catalogo', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill('synthetic-int02-s4-vault');
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();

  await navigationButton(page).click();
  await page.getByRole('complementary', { name: 'Navigazione del Registro' })
    .getByRole('button', { name: 'Verifiche online', exact: true }).click();

  const analysisTab = page.getByRole('button', { name: /Esiti & Item Analysis/ });
  await analysisTab.click();
  const analysisSelect = page.getByRole('combobox', { name: 'Test da analizzare' });
  await expect(analysisSelect).toHaveValue('');
  await expect(page.getByText('Seleziona una verifica da analizzare.', { exact: false })).toBeVisible();
  const choices = await analysisSelect.locator('option').evaluateAll(options =>
    options.map(option => option.value).filter(Boolean)
  );
  expect(choices.length).toBeGreaterThan(0);
  await capture(page, 'int02-s4-01-analisi-senza-scelta-390.png');

  await analysisSelect.selectOption(choices[0]);
  await expect(analysisSelect).toHaveValue(choices[0]);
  await expect(page.getByText('Seleziona una verifica da analizzare.', { exact: false })).toHaveCount(0);
  await analysisSelect.selectOption('');
  await expect(page.getByText('Seleziona una verifica da analizzare.', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Scheda Cartacea / PDF' }).click();
  const printSelect = page.getByRole('combobox', { name: 'Test da stampare' });
  await expect(printSelect).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'Seleziona una verifica da stampare' })).toBeVisible();
  await capture(page, 'int02-s4-02-stampa-senza-scelta-390.png');

  await printSelect.selectOption(choices[0]);
  await expect(printSelect).toHaveValue(choices[0]);
  await expect(page.getByText('Test da Stampare')).toBeVisible();

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    )).toBeLessThanOrEqual(2);
  }
  expect(errors).toEqual([]);
});
