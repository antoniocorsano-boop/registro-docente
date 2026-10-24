const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const vaultPassword = 'ux-qa-01-review-regressions';
const CLASS_A = 'Classe Sintetica UXQA Review A';
const CLASS_B = 'Classe Sintetica UXQA Review B';

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(120000);

async function setupFreshVault(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function closePersistenceConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  await expect(heading).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(heading).toBeHidden();
}

async function openDrawerItem(page, label) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const item = page.locator('aside').getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

async function returnHome(page) {
  await openDrawerItem(page, 'Classi');
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function createSyntheticClass(page, name) {
  page.once('dialog', dialog => dialog.accept(name));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${name}` })).toBeVisible();
  await closePersistenceConfirmation(page);
  await returnHome(page);
}

async function openClass(page, name) {
  const button = page.getByRole('button', { name: `Apri classe ${name}`, exact: true });
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByRole('heading', { name: `Panoramica Sezione: ${name}` })).toBeVisible();
}

async function reloadAndUnlock(page) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  const unlockHeading = page.getByRole('heading', { name: 'Sblocca Registro' });
  if (await unlockHeading.isVisible().catch(() => false)) {
    await page.locator('#vault-password').fill(vaultPassword);
    await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

test('neutral bootstrap replaces stale class history so Back returns to Home after selecting another class', async ({ page }) => {
  await setupFreshVault(page);
  await createSyntheticClass(page, CLASS_A);
  await createSyntheticClass(page, CLASS_B);

  await openClass(page, CLASS_A);
  await reloadAndUnlock(page);

  await openClass(page, CLASS_B);
  await page.goBack({ waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
  await expect(page.getByRole('heading', { name: `Panoramica Sezione: ${CLASS_A}` })).toHaveCount(0);
  await expect(page.locator('select[title="Cambia rapidamente classe attiva"]')).toHaveCount(0);
});
