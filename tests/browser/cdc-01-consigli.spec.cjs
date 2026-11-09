const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const CLASS_NAME = '2Z CDC-01 sintetica';

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(60000);

async function navigate(page, name) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const drawer = page.getByRole('complementary');
  await drawer.getByRole('button', { name, exact: true }).click();
}

test('CDC-01: teacher explicitly chooses class and saves an independent entrance grade', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill('cdc-01-synthetic');
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();

  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)').fill('Alfa Uno');
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();

  await navigate(page, 'Consigli di classe');
  await expect(page.getByRole('heading', { name: 'Consigli di classe', exact: true })).toBeVisible();
  const picker = page.getByRole('combobox', { name: 'Seleziona classe per il Consiglio' });
  await expect(picker).toHaveValue('');
  await picker.selectOption({ label: CLASS_NAME });
  const grade = page.locator('input[aria-label^="Voto di ingresso per"]');
  await expect(grade).toHaveCount(1);
  await expect(grade).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Salva valutazioni di ingresso' })).toBeDisabled();

  await grade.fill('8,5');
  await expect(page.getByText('Modifiche non ancora salvate.')).toBeVisible();
  await navigate(page, 'Oggi');
  const guard = page.getByRole('dialog', { name: 'Modifiche non salvate' });
  await expect(guard).toBeVisible();
  await guard.getByRole('button', { name: 'Rimani nei Consigli' }).click();
  await expect(grade).toHaveValue('8,5');

  await page.getByRole('button', { name: 'Salva valutazioni di ingresso' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Valutazioni di ingresso salvate nell’archivio' })).toBeVisible();
  await expect(page.getByText('Con voto')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Riepilogo delle fasce di ingresso' })).toContainText('Alta · 8,5–10');

  await navigate(page, 'Oggi');
  const confirmation = page.getByRole('alertdialog').filter({ has: page.getByRole('heading', { name: 'Tornare a Oggi?' }) });
  if (await confirmation.isVisible().catch(() => false)) {
    await confirmation.getByRole('button', { name: 'Torna a Oggi' }).click();
  }
  await navigate(page, 'Consigli di classe');
  await picker.selectOption({ label: CLASS_NAME });
  await expect(grade).toHaveValue('8.5');
});
