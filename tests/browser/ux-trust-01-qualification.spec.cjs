const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const vaultPassword = 'ux-trust-01-qualification-only';
const CLASS_NAME = 'Classe Sintetica UXT-A';

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

test('UXT-A compact Vault stays touch-safe above mobile workflow navigation — 390x844', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await setupFreshVault(page);

  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);

  const autoLock = page.locator('#vault-auto-lock-mobile');
  const lockButton = page.locator('button[aria-label="Blocca Registro"]');
  const cluster = autoLock.locator('..');
  const bottomNavButton = page.getByRole('button', { name: 'Riepilogo', exact: true });

  await expect(autoLock).toBeVisible();
  await expect(lockButton).toBeVisible();
  await expect(bottomNavButton).toBeVisible();

  const clusterBox = await cluster.boundingBox();
  const autoLockBox = await autoLock.boundingBox();
  const lockBox = await lockButton.boundingBox();
  const navBox = await bottomNavButton.locator('..').boundingBox();

  expect(clusterBox).not.toBeNull();
  expect(autoLockBox).not.toBeNull();
  expect(lockBox).not.toBeNull();
  expect(navBox).not.toBeNull();

  expect(clusterBox.width).toBeLessThanOrEqual(200);
  expect(autoLockBox.height).toBeGreaterThanOrEqual(44);
  expect(lockBox.width).toBeGreaterThanOrEqual(44);
  expect(lockBox.height).toBeGreaterThanOrEqual(44);
  expect(clusterBox.y + clusterBox.height).toBeLessThanOrEqual(navBox.y + 1);

  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await context.close();
});

test('UXT-A desktop Vault controls preserve auto-lock and manual lock semantics — 1280x900', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await setupFreshVault(page);

  const autoLock = page.locator('#vault-auto-lock-desktop');
  const lockButton = page.getByRole('button', { name: 'Blocca Registro', exact: true });

  await expect(autoLock).toBeVisible();
  await expect(lockButton).toBeVisible();
  await autoLock.selectOption('30');
  await expect(autoLock).toHaveValue('30');

  await lockButton.click();
  await expect(page.getByRole('heading', { name: 'Sblocca Registro' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
  await expect(page.locator('#vault-auto-lock-desktop')).toHaveValue('30');

  await context.close();
});
