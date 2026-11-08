const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const CLASS_NAME = '3ª A Sintetica INT-02';
const SOURCE_TITLE = 'Fonte esclusivamente sintetica INT-02';
const SOURCE_TEXT = 'Appunto professionale dimostrativo sulle energie rinnovabili.';

test.use({ viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' });
test.setTimeout(120000);

async function openDrawerItem(page, label) {
  const brand = page.getByTestId('header01-brand-navigation');
  await expect(brand).toBeVisible();
  await brand.click();
  const drawer = page.getByRole('complementary', { name: 'Navigazione del Registro' });
  await drawer.getByRole('button', { name: label, exact: true }).click();
}

async function expectNoHorizontalOverflow(page) {
  await expect.poll(async () => page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth;
  })).toBeLessThanOrEqual(1);
}

test('INT-02/S1: class-scoped professional source reaches unsaved test editor without UDA or URL payload', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill('synthetic-int02-s1-vault');
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();

  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  // A fresh class can open the existing durable-save acknowledgement.
  const saveNotice = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await saveNotice.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(saveNotice).toBeHidden();
  }

  await openDrawerItem(page, 'Biblioteca privata');
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(SOURCE_TITLE);
  await page.getByLabel('Contenuto').fill(SOURCE_TEXT);
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();

  await expect(page.getByTestId('int02-prepare-assessment')).toHaveCount(0);
  await page.getByText('Gestisci', { exact: true }).click();
  // HPR 2026-11-08: the long professional-classification control must not
  // push the source card and the whole document beyond the Android viewport.
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 390, height: 844 });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Classifica come materiale professionale' }).click();
  await expect(page.getByText('Professionale', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Usa', exact: true }).click();
  const prepare = page.getByTestId('int02-prepare-assessment');
  await expect(prepare).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await expectNoHorizontalOverflow(page);
  const bounds = await prepare.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  await prepare.click();

  const handoff = page.getByTestId('int02-assessment-handoff');
  await expect(handoff).toBeVisible();
  await expect(handoff).toContainText(SOURCE_TITLE);
  await expect(handoff).toContainText(CLASS_NAME);
  await expect(handoff).toContainText('Non è stata creata alcuna verifica');
  expect(page.url()).not.toContain(SOURCE_TITLE);
  expect(page.url()).not.toContain(SOURCE_TEXT);
  expect(page.url()).not.toContain('sourceId');

  await page.getByTestId('int02-open-assessment-editor').click();
  await expect(page.getByRole('heading', { name: 'Crea Nuova Verifica Formativa' })).toBeVisible();
  await expect(page.getByTestId('int02-open-assessment-editor')).toHaveCount(0);
  await expect(handoff.getByRole('status')).toContainText('Editor già aperto');
  const titleInput = page.getByPlaceholder('es. Verifica Formativa: Energie Rinnovabili e Impatto Ambientale');
  await titleInput.fill('BOZZA NON SALVATA INT-02');
  await expect(titleInput).toHaveValue('BOZZA NON SALVATA INT-02');
  const udaSelect = page.getByText('Collega a UDA Curricolare').locator('..').locator('select');
  await expect(udaSelect).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Salva Verifica' })).toBeVisible();
  await expect(udaSelect.locator('option').filter({ hasText: '3ª B' })).toHaveCount(0);

  // Internal navigation must not silently discard a modified assessment.
  const padletTab = page.getByRole('button', { name: 'Condivisione Padlet' });
  await padletTab.click();
  const internalExit = page.getByRole('dialog', { name: 'Modifiche non salvate' });
  await expect(internalExit).toBeVisible();
  await internalExit.getByRole('button', { name: "Rimani nell'editor" }).click();
  await expect(padletTab).toBeFocused();
  await expect(titleInput).toHaveValue('BOZZA NON SALVATA INT-02');

  // The native Android Back equivalent must restore history before displaying
  // a confirmation. Staying preserves the edited form; leaving discards only
  // session form state and does not create a test.
  await page.goBack();
  const exitDialog = page.getByRole('dialog', { name: 'Modifiche non salvate' });
  await expect(exitDialog).toBeVisible();
  await exitDialog.getByRole('button', { name: 'Rimani nell’editor' }).click();
  await expect(titleInput).toHaveValue('BOZZA NON SALVATA INT-02');
  await expect(handoff).toBeVisible();

  await page.goBack();
  await expect(exitDialog).toBeVisible();
  await exitDialog.getByRole('button', { name: 'Esci senza salvare' }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
  await expect(page.getByTestId('int02-assessment-handoff')).toHaveCount(0);
});
