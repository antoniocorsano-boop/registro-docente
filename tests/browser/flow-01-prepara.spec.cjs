const { test, expect } = require('@playwright/test');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const CLASS_NAME = '2C Sintetica FLOW-01';

function evidencePath(name) {
  const dir = process.env.EVIDENCE_DIR;
  return dir ? path.resolve(dir, name) : name;
}

async function configureVault(page, password) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
}

async function closePersistenceConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  await expect(heading).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(heading).toBeHidden();
}

async function openOggiFromDrawer(page) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const drawer = page.getByRole('complementary');
  const oggi = drawer.getByRole('button', { name: 'Oggi', exact: true });
  await expect(oggi).toBeVisible();
  await oggi.click();
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
}

async function createSyntheticClass(page) {
  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);
  await openOggiFromDrawer(page);
}

async function openPreparationRouter(page) {
  await page.getByRole('button', { name: 'Prepara', exact: true }).click();
  const pending = page.getByRole('status');
  await expect(pending).toContainText('Per continuare con Prepara, scegli una classe.');
  await expect(page.getByRole('heading', { name: `Panoramica Sezione: ${CLASS_NAME}` })).toHaveCount(0);
  await page.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true }).click();

  const router = page.getByRole('region', { name: `Prepara per ${CLASS_NAME}` });
  await expect(router).toBeVisible();
  await expect(router).toContainText(`Stai preparando per ${CLASS_NAME}`);
  for (const label of [
    'Definisci la cornice',
    'Sviluppa UDA o lezione',
    'Trova o usa un materiale',
    'Prepara una verifica',
    'Chiedi supporto'
  ]) {
    await expect(router.getByRole('button', { name: new RegExp(`^${label}`) })).toBeVisible();
  }
  return router;
}

async function reenterPreparationRouter(page) {
  await openOggiFromDrawer(page);
  return openPreparationRouter(page);
}

async function assertSelectedClassStillVisible(page) {
  await expect(page.getByText(CLASS_NAME, { exact: true }).last()).toBeVisible();
}

async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function verifyTabDestinations(page) {
  let router = await openPreparationRouter(page);

  await router.getByRole('button', { name: /^Definisci la cornice/ }).click();
  await expect(page.getByRole('heading', { name: 'Programmazione didattica', exact: true })).toBeVisible();
  await assertSelectedClassStillVisible(page);

  router = await reenterPreparationRouter(page);
  await router.getByRole('button', { name: /^Sviluppa UDA o lezione/ }).click();
  await expect(page.getByRole('button', { name: 'Nuova UDA', exact: true })).toBeVisible();
  await assertSelectedClassStillVisible(page);

  router = await reenterPreparationRouter(page);
  await router.getByRole('button', { name: /^Trova o usa un materiale/ }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
  await assertSelectedClassStillVisible(page);

  router = await reenterPreparationRouter(page);
  await router.getByRole('button', { name: /^Prepara una verifica/ }).click();
  await expect(page.getByRole('heading', { name: 'Verifiche sulle Lezioni & Flashcards Formative' })).toBeVisible();
  await assertSelectedClassStillVisible(page);
}

async function openPreparationCopilot(page) {
  const router = await reenterPreparationRouter(page);
  await router.getByRole('button', { name: /^Chiedi supporto/ }).click();

  const composer = page.getByTestId('library-copilot-composer');
  await expect(composer).toBeVisible();
  await expect(composer).toContainText(CLASS_NAME);
  await expect(composer.getByTestId('teacher-first-class-choice')).toHaveCount(0);
  await assertSelectedClassStillVisible(page);
  return composer;
}

test.describe('FLOW-01 desktop qualification', () => {
  test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });

  test('Prepara keeps explicit class context across specialist surfaces and Copilota', async ({ page }) => {
    await configureVault(page, 'flow-01-desktop');
    await createSyntheticClass(page);

    const router = await openPreparationRouter(page);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: evidencePath('flow-01-desktop-router.png'), fullPage: true });
    await router.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(router).toBeHidden();

    await openOggiFromDrawer(page);
    await verifyTabDestinations(page);

    const composer = await openPreparationCopilot(page);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: evidencePath('flow-01-desktop-copilot.png'), fullPage: true });
    await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
    await expect(composer).toBeHidden();
  });
});

test.describe('FLOW-01 mobile qualification', () => {
  test.use({ viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' });

  test('Prepara is touch-safe, non-overflowing and hands the known class to Copilota at 390x844', async ({ page }) => {
    await configureVault(page, 'flow-01-mobile');
    await createSyntheticClass(page);

    const router = await openPreparationRouter(page);
    for (const button of await router.getByRole('button').all()) {
      const box = await button.boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: evidencePath('flow-01-mobile-router.png'), fullPage: true });

    const composer = await openPreparationCopilot(page);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: evidencePath('flow-01-mobile-copilot.png'), fullPage: true });
    await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
    await expect(composer).toBeHidden();
  });
});
