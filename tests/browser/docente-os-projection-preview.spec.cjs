const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { navigationButton, settleOggiNavigation } = require('./header01-navigation.cjs');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const projectionBytes = fs.readFileSync(
  path.resolve(__dirname, '../docs/contracts/fixtures/docente-os-registro-teaching-projection-v1.json')
);

test.use({ viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' });
test.setTimeout(180000);

async function configureVault(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill('a4-r2b-import-synthetic-qualification');
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
}

async function drawerAction(page, name) {
  await navigationButton(page).click();
  const drawer = page.getByRole('complementary')
    .filter({ has: page.getByRole('button', { name, exact: true }) });
  await drawer.getByRole('button', { name, exact: true }).click();
  if (name === 'Oggi') {
    const confirmation = page.getByRole('alertdialog')
      .filter({ has: page.getByRole('heading', { name: 'Tornare a Oggi?' }) });
    if (await confirmation.isVisible().catch(() => false)) {
      await confirmation.getByRole('button', { name: 'Torna a Oggi', exact: true }).click();
    }
    await settleOggiNavigation(page);
  }
}

async function openImportPanel(page) {
  await drawerAction(page, 'Programmazione didattica');
  await expect(page.getByRole('heading', { name: 'Programmazione didattica', exact: true })).toBeVisible();
  const summary = page.locator('summary').filter({ hasText: 'Importa da Docente OS' });
  await expect(summary).toBeVisible();
  const panel = page.locator('details').filter({ has: summary }).first();
  await summary.click();
  await expect(panel.getByText('File di proiezione')).toBeVisible();
  return panel;
}

async function upload(panel, bytes, name = 'proiezione-docente-os.json') {
  await panel.locator('input[type=file]').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: bytes
  });
}

async function createSyntheticClass(page, className) {
  await drawerAction(page, 'Oggi');
  page.once('dialog', dialog => dialog.accept(className));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: 'Gestione Elenco Alunni: ' + className })).toBeVisible();
  const saveConfirmation = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await saveConfirmation.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  }
}

test('A4-R2B mobile: local JSON preview, fail-closed identity, explicit durable acceptance', async ({ page }) => {
  await configureVault(page);
  let panel = await openImportPanel(page);

  await upload(panel, Buffer.from('{"invalid":true}', 'utf8'), 'invalid.json');
  await expect(panel.getByRole('alert')).toContainText('non contiene una proiezione Docente OS valida');
  await expect(panel.getByRole('button', { name: 'Accetta e salva la proiezione' })).toHaveCount(0);

  await upload(panel, projectionBytes);
  await expect(panel.getByRole('heading', { name: 'Anteprima della programmazione' })).toBeVisible();
  await expect(panel.getByText('Non associata', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Accetta e salva la proiezione' })).toBeDisabled();
  await expect(panel.getByRole('status')).toHaveCount(0);

  await createSyntheticClass(page, '1A');
  panel = await openImportPanel(page);
  await upload(panel, projectionBytes);
  await expect(panel.getByText('Associata · 1A', { exact: true })).toBeVisible();
  const accept = panel.getByRole('button', { name: 'Accetta e salva la proiezione' });
  await expect(accept).toBeEnabled();
  await expect(panel.getByText('Proiezione Docente OS accettata e salvata.')).toHaveCount(0);
  await accept.click();
  await expect(panel.getByRole('status')).toHaveText('Proiezione Docente OS accettata e salvata.');

  // A second Registro class with the same semantic identity makes the
  // previously resolved source identity ambiguous, even after acceptance.
  await createSyntheticClass(page, '1ª A');
  panel = await openImportPanel(page);
  await upload(panel, projectionBytes);
  await expect(panel.getByText('Ambigua', { exact: true })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Accetta e salva la proiezione' })).toBeDisabled();
  await expect(panel.getByRole('status')).toHaveCount(0);
});
