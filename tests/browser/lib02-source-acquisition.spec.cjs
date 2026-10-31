const { test, expect } = require('@playwright/test');
const { selectLibraryUseTarget, libraryUseAction } = require('./library-use-surface-helpers.cjs');
const { expectExistingCopilotBindings } = require('./teacher-first-copilot-helpers.cjs');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lib02-browser-qualification';
const UDA_TITLE = 'UDA Sintetica LIB-02';
const WEB_TITLE = 'Articolo rete elettrica';
const WEB_URL = 'https://example.org/energia/rete';
const CAPTURED_TEXT = 'Una rete elettrica distribuisce energia tra produzione, trasformazione e utilizzo.';

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(180000);

async function setupFreshVault(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
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
  const item = page.getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

async function createSyntheticUda(page) {
  await openDrawerItem(page, 'UDA');
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(UDA_TITLE);
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(UDA_TITLE, { exact: true }).first()).toBeVisible();
}

async function openLibrary(page) {
  await openDrawerItem(page, 'Biblioteca privata');
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
}

async function sourceCard(page, title) {
  const heading = page.getByRole('heading', { name: title, exact: true });
  await expect(heading).toBeVisible();
  return heading.locator('xpath=ancestor::article');
}

async function handoffToComposer(card, page, title) {
  await libraryUseAction(card, 'prepare').click();
  const composer = page.locator('[data-testid="library-copilot-composer"]');
  await expect(composer).toBeVisible();
  await expectExistingCopilotBindings(composer, { sourceTitle: title });
  return composer;
}

async function openPrepareFromIntent(composer) {
  await composer.getByLabel('Che cosa vuoi farne?').fill('crea una proposta didattica a partire da questo materiale');
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  const disclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  await expect(disclosure).toBeVisible();
  return disclosure;
}

test('LIB-02 URL incompleta resta fail-closed finché il docente non acquisisce il testo — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const pageErrors = [];
  const proposalRequests = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('request', request => {
    const url = request.url();
    if (
      request.method() === 'POST' &&
      url.includes('/api/copilot/library-proposal') &&
      !url.includes('/provider')
    ) {
      proposalRequests.push(url);
    }
  });

  await setupFreshVault(page);
  await createSyntheticUda(page);
  await openLibrary(page);

  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'URL', exact: true }).click();
  await page.getByLabel('Titolo').fill(WEB_TITLE);
  await page.getByLabel('URL').fill(WEB_URL);
  await expect(page.getByLabel('Testo o estratto della pagina')).toBeVisible();
  await expect(page.getByText("Se non lo aggiungi ora, conserveremo l'URL come fonte da completare.", { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Salva URL', exact: true }).click();

  let card = await sourceCard(page, WEB_TITLE);
  await expect(card.getByText('Da rivedere', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Usa', exact: true }).click();

  const udaChooser = await selectLibraryUseTarget(card, { udaTitle: UDA_TITLE });
  await expect(udaChooser).toBeVisible();

  await expect(card.getByText('Contenuto web non ancora acquisito', { exact: true })).toBeVisible();
  await expect(card.getByText('Prepara una proposta didattica', { exact: true })).toHaveCount(0);
  await expect(libraryUseAction(card, 'prepare')).toBeVisible();

  let composer = await handoffToComposer(card, page, WEB_TITLE);
  const incompleteDisclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  await expect(incompleteDisclosure).toBeVisible();
  await expect(incompleteDisclosure.getByText('Prima verifica la natura della fonte', { exact: true })).toBeVisible();
  await expect(incompleteDisclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true })).toHaveCount(0);
  expect(proposalRequests).toEqual([]);
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  await card.getByRole('button', { name: 'Aggiungi testo della pagina', exact: true }).click();
  await card.getByLabel('Testo della pagina').fill(CAPTURED_TEXT);
  await card.getByRole('button', { name: 'Salva contenuto', exact: true }).click();

  await expect(card.getByText('Pronta', { exact: true })).toBeVisible();
  await expect(card.getByText('Contenuto web non ancora acquisito', { exact: true })).toHaveCount(0);
  await expect(card.getByText(CAPTURED_TEXT, { exact: true })).toBeVisible();

  await reloadAndUnlock(page);
  await openLibrary(page);
  card = await sourceCard(page, WEB_TITLE);
  await expect(card.getByText('Pronta', { exact: true })).toBeVisible();
  await expect(card.getByText(CAPTURED_TEXT, { exact: true })).toBeVisible();

  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  await selectLibraryUseTarget(card, { udaTitle: UDA_TITLE });
  await expect(libraryUseAction(card, 'prepare')).toBeVisible();

  composer = await handoffToComposer(card, page, WEB_TITLE);
  const completeDisclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  await expect(completeDisclosure).toBeVisible();
  await expect(composer.getByRole('region', { name: 'Proposta didattica' })).toHaveCount(0);
  await expect(composer.getByRole('button', { name: 'Chiudi Copilota', exact: true })).toBeVisible();

  await page.screenshot({
    path: path.join(evidenceDir, 'lib02-source-acquisition-desktop.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib02-source-acquisition-desktop.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 1280, height: 900 },
      checks: [
        'url-form-offers-optional-captured-text',
        'url-only-needs-review',
        'incomplete-source-blocks-remote-preparation',
        'incomplete-source-handoff-remains-fail-closed-before-consent',
        'explicit-local-text-completion',
        'durable-ready-after-reload',
        'captured-source-handoff-binds-same-source',
        'no-proposal-generation'
      ],
      proposalRequests,
      pageErrors
    }, null, 2) + '\n'
  );

  expect(proposalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});