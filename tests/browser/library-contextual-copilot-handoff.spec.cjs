const { test, expect } = require('@playwright/test');
const { selectLibraryUseTarget, libraryUseAction } = require('./library-use-surface-helpers.cjs');
const { revealMaterialSourceSelect, expectExistingCopilotBindings } = require('./teacher-first-copilot-helpers.cjs');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'library-contextual-copilot-handoff';
const CLASS_NAME = 'Classe Sintetica COPILOT-HANDOFF';
const UDA_TITLE = 'UDA Sintetica COPILOT-HANDOFF';
const SECOND_UDA_TITLE = 'Seconda UDA Sintetica COPILOT-HANDOFF';
const SOURCE_TITLE = 'Fonte contestuale COPILOT-HANDOFF';
const SECOND_SOURCE_TITLE = 'Seconda fonte COPILOT-HANDOFF';

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
  const item = page.getByRole('complementary').getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

async function createSyntheticClass(page) {
  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);
}

async function createSyntheticUda(page, title) {
  await openDrawerItem(page, 'UDA');
  await page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'UDA', exact: true }).click();
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(title);
  await dialog.getByRole('combobox', { name: 'Classe', exact: true }).selectOption({ label: CLASS_NAME });
  await dialog.getByLabel('Mese Inizio').selectOption('0');
  await dialog.getByLabel('Durata Mesi').fill('10');
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
}

async function openLibrary(page) {
  await openDrawerItem(page, 'Biblioteca privata');
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
}

async function addSource(page, title, text) {
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(title);
  await page.getByLabel('Contenuto').fill(text);
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function sourceCard(page, title) {
  const heading = page.getByRole('heading', { name: title, exact: true });
  await expect(heading).toBeVisible();
  return heading.locator('xpath=ancestor::article');
}

async function launchFromCard(page, title) {
  const card = await sourceCard(page, title);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  const udaSelect = await selectLibraryUseTarget(card, { udaTitle: UDA_TITLE });
  await expect(udaSelect).toBeVisible();
  await libraryUseAction(card, 'review').click();
  const composer = page.getByTestId('library-copilot-composer');
  await expect(composer).toBeVisible();
  await expectExistingCopilotBindings(composer, { sourceTitle: title });
  await expect(composer).toContainText(CLASS_NAME);
  await expect(composer).toContainText('UDA corrente');
  return composer;
}

async function submitIntent(composer, message) {
  await composer.getByLabel('Che cosa vuoi farne?').fill(message);
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
}

async function assertAtLeast44(locator, label) {
  await expect(locator, `${label} visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} bounding box`).not.toBeNull();
  expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44);
  expect(box.width, `${label} width`).toBeGreaterThanOrEqual(44);
}

test('contextual Copilot handoff makes disclosure intent-owned and keeps provider calls gated — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const pageErrors = [];
  const proposalRequests = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.route('**/api/copilot/library-proposal/provider', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'browser-fixture-v1' }) });
  });
  await page.route('**/api/copilot/library-proposal', async route => {
    proposalRequests.push(route.request().postDataJSON());
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Generation is outside this disclosure test.' }) });
  });

  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createSyntheticUda(page, UDA_TITLE);
  await createSyntheticUda(page, SECOND_UDA_TITLE);
  await openLibrary(page);
  await addSource(page, SOURCE_TITLE, 'Una fonte sulle trasformazioni energetiche per la didattica.');
  await addSource(page, SECOND_SOURCE_TITLE, 'Una seconda fonte per verificare la cancellazione dello stato.');
  const composer = await launchFromCard(page, SOURCE_TITLE);
  const prepareDisclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  const reviewPanel = composer.getByTestId('library-copilot-review-panel');
  const linkAction = composer.getByTestId('library-copilot-link-action');

  await expect(prepareDisclosure).toHaveCount(0);
  expect(proposalRequests).toHaveLength(0);

  await submitIntent(composer, 'rivedi questa fonte nel contesto della programmazione');
  await expect(reviewPanel).toBeVisible();
  await expect(reviewPanel.getByText('Revisione nel contesto', { exact: true })).toBeVisible();
  await expect(linkAction).toHaveCount(0);
  await expect(prepareDisclosure).toHaveCount(0);

  await submitIntent(composer, 'collega questa fonte alla UDA');
  await expect(linkAction).toBeVisible();
  await expect(reviewPanel).toHaveCount(0);
  await expect(prepareDisclosure).toHaveCount(0);

  await submitIntent(composer, 'crea una proposta didattica a partire da questo materiale');
  await expect(prepareDisclosure).toBeVisible();
  await expect(reviewPanel).toHaveCount(0);
  await expect(linkAction).toHaveCount(0);
  expect(proposalRequests).toHaveLength(0);

  const sourceSelect = await revealMaterialSourceSelect(composer);
  await sourceSelect.selectOption({ label: SECOND_SOURCE_TITLE });
  await expect(prepareDisclosure).toHaveCount(0);
  await sourceSelect.selectOption({ label: SOURCE_TITLE });
  await expect(prepareDisclosure).toHaveCount(0);

  await composer.getByLabel('Che cosa vuoi farne?').fill('riassumi questa fonte');
  await expect(prepareDisclosure).toHaveCount(0);
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  await expect(composer.getByText('Dimmi cosa vuoi ottenere: per esempio preparare un’attività, rivedere un materiale o collegarlo a una UDA.', { exact: false })).toBeVisible();
  await expect(reviewPanel).toHaveCount(0);
  await expect(linkAction).toHaveCount(0);
  await expect(prepareDisclosure).toHaveCount(0);
  expect(proposalRequests).toHaveLength(0);

  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
  const relaunchedCard = await sourceCard(page, SOURCE_TITLE);
  const contextSelect = await selectLibraryUseTarget(relaunchedCard, { udaTitle: SECOND_UDA_TITLE });
  await expect(contextSelect).toBeVisible();
  await libraryUseAction(relaunchedCard, 'review').click();
  await expect(composer).toBeVisible();
  await expect(reviewPanel).toBeVisible();
  await expect(linkAction).toHaveCount(0);
  await expect(prepareDisclosure).toHaveCount(0);

  await page.screenshot({ path: path.join(evidenceDir, 'library-contextual-copilot-handoff-desktop.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'library-contextual-copilot-handoff-desktop.json'), JSON.stringify({ candidateSha: process.env.CANDIDATE_SHA || null, viewport: { width: 1280, height: 900 }, proposalRequestCount: proposalRequests.length, pageErrors }, null, 2) + '\n');
  expect(pageErrors).toEqual([]);
});

test('contextual Copilot handoff stays touch-safe and intent-owned — mobile 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createSyntheticUda(page, UDA_TITLE);
  await openLibrary(page);
  await addSource(page, SOURCE_TITLE, 'Fonte mobile sulle trasformazioni energetiche.');
  const composer = await launchFromCard(page, SOURCE_TITLE);
  await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toHaveCount(0);
  const message = composer.getByLabel('Che cosa vuoi farne?');
  const submit = composer.getByRole('button', { name: 'Mostra le possibilità', exact: true });
  await assertAtLeast44(message, 'Copilot message');
  await assertAtLeast44(submit, 'Copilot submit');
  await submitIntent(composer, 'rivedi questa fonte nel contesto della programmazione');
  await expect(composer.getByTestId('library-copilot-review-panel')).toBeVisible();
  await assertAtLeast44(composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }), 'Copilot close');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(evidenceDir, 'library-contextual-copilot-handoff-mobile.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'library-contextual-copilot-handoff-mobile.json'), JSON.stringify({ candidateSha: process.env.CANDIDATE_SHA || null, viewport: { width: 390, height: 844 }, horizontalOverflowPx: overflow, pageErrors }, null, 2) + '\n');
  expect(pageErrors).toEqual([]);
  await context.close();
});
