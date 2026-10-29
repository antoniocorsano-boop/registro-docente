const { test, expect } = require('@playwright/test');
const { revealMaterialSourceSelect } = require('./teacher-first-copilot-helpers.cjs');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lib01e-disclosure-review';
const CLASS_NAME = 'Classe Sintetica LIB-01E';
const UDA_TITLE = 'UDA Disclosure LIB-01E';
const SOURCE_TITLE = 'Fonte Disclosure LIB-01E';

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

async function createSyntheticClass(page) {
  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);
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

async function openDrawerItem(page, label) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const item = page.getByRole('complementary').getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

async function createActiveSyntheticUda(page) {
  await openDrawerItem(page, 'UDA');
  await page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'UDA', exact: true }).click();
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(UDA_TITLE);
  await dialog.getByRole('combobox', { name: 'Classe', exact: true }).selectOption({ label: CLASS_NAME });
  await dialog.getByLabel('Mese Inizio').selectOption('0');
  await dialog.getByLabel('Durata Mesi').fill('10');
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(UDA_TITLE, { exact: true }).first()).toBeVisible();
}

async function selectSyntheticClass(page) {
  const classButton = page.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true });
  await expect(classButton).toBeVisible();
  await classButton.click();
  await expect(page.getByRole('heading', { name: `Panoramica Sezione: ${CLASS_NAME}` })).toBeVisible();
}

async function openLibrary(page) {
  await openDrawerItem(page, 'Biblioteca privata');
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
}

async function addSyntheticSource(page) {
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(SOURCE_TITLE);
  await page.getByLabel('Contenuto').fill('Fonte professionale sintetica per verificare la disclosure del destinatario remoto.');
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();
}

async function openComposer(page) {
  const trigger = page.locator('[data-testid="library-copilot-trigger"]');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByTestId('copilot-deck')).toBeVisible();
  await page.getByRole('button', { name: 'Parla con il Copilota', exact: true }).click();
  const composer = page.locator('[data-testid="library-copilot-composer"]');
  await expect(composer).toBeVisible();
  return composer;
}

async function selectComposerSource(composer) {
  const sourceSelect = await revealMaterialSourceSelect(composer);
  await sourceSelect.selectOption({ label: SOURCE_TITLE });
  await expect(sourceSelect.locator('option:checked')).toHaveText(SOURCE_TITLE);
}

async function openPrepareFromIntent(composer) {
  await composer.getByLabel('Che cosa vuoi farne?').fill('crea una proposta didattica a partire da questo materiale');
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  const disclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  await expect(disclosure).toBeVisible();
  return disclosure;
}

test('LIB-01E keeps one-shot consent fail-closed until provider disclosure succeeds and allows explicit metadata retry', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  let metadataAttempts = 0;
  let markFirstStarted;
  const firstStarted = new Promise(resolve => {
    markFirstStarted = resolve;
  });
  let releaseFirst;
  const firstGate = new Promise(resolve => {
    releaseFirst = resolve;
  });

  let proposalAttempts = 0;
  await page.route('**/api/copilot/library-proposal/provider', async route => {
    metadataAttempts += 1;
    if (metadataAttempts === 1) {
      markFirstStarted();
      await firstGate;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'synthetic metadata failure' })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        available: true,
        provider: 'Browser Provider LIB-01E',
        model: 'browser-fixture-v1'
      })
    });
  });
  await page.route('**/api/copilot/library-proposal', async route => {
    proposalAttempts += 1;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unexpected proposal request before explicit preparation' })
    });
  });

  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createActiveSyntheticUda(page);
  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  await openLibrary(page);
  await addSyntheticSource(page);

  const composer = await openComposer(page);
  await selectComposerSource(composer);
  const disclosure = await openPrepareFromIntent(composer);

  const classify = disclosure.getByRole('button', { name: 'Classifica come materiale professionale', exact: true });
  await classify.click();

  await firstStarted;
  const consent = disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true });
  await expect(consent).toBeVisible();
  await expect(consent).toBeDisabled();
  await expect(disclosure.getByText('Browser Provider LIB-01E', { exact: true })).toHaveCount(0);
  expect(proposalAttempts).toBe(0);

  releaseFirst();
  await expect(disclosure.getByText('Non è stato possibile verificare il servizio remoto configurato.', { exact: true })).toBeVisible();
  await expect(consent).toBeDisabled();

  const retry = disclosure.getByRole('button', { name: 'Riprova verifica servizio', exact: true });
  await expect(retry).toBeVisible();
  await retry.click();

  await expect(disclosure.getByText('Browser Provider LIB-01E', { exact: true })).toBeVisible();
  await expect(disclosure).toContainText('browser-fixture-v1');
  await expect(consent).toBeEnabled();
  expect(metadataAttempts).toBe(2);
  expect(proposalAttempts).toBe(0);

  await consent.click();
  await expect(disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true })).toHaveCount(0);
  await expect(disclosure.getByRole('button', { name: 'Prepara attività', exact: true })).toBeVisible();
  expect(proposalAttempts).toBe(0);

  const unexpectedConsoleErrors = consoleErrors.filter(message =>
    !/^Failed to load resource: the server responded with a status of 503 \(/.test(message)
  );

  await page.screenshot({
    path: path.join(evidenceDir, 'lib01e-provider-disclosure-review.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib01e-provider-disclosure-review.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      metadataAttempts,
      proposalAttempts,
      pageErrors,
      expectedSyntheticConsoleErrors: consoleErrors.filter(message => !unexpectedConsoleErrors.includes(message)),
      unexpectedConsoleErrors
    }, null, 2) + '\n'
  );

  expect(pageErrors).toEqual([]);
  expect(unexpectedConsoleErrors).toEqual([]);
});