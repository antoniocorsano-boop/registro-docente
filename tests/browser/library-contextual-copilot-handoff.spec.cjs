const { test, expect } = require('@playwright/test');
const { selectLibraryUseTarget, libraryUseAction } = require('./library-use-surface-helpers.cjs');
const { expectDirectCopilotLaunch } = require('./teacher-first-copilot-helpers.cjs');
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

async function launchFromCard(page, title, { targetTitle = UDA_TITLE, intent = 'review' } = {}) {
  const card = await sourceCard(page, title);
  const useSurface = card.getByTestId('library-source-use-surface');
  if (!(await useSurface.isVisible().catch(() => false))) {
    await card.getByRole('button', { name: 'Usa', exact: true }).click();
  }
  await expect(useSurface).toBeVisible();
  await selectLibraryUseTarget(card, { udaTitle: targetTitle });
  await libraryUseAction(card, intent).click();
  const classificationGate = card.getByTestId('library-professional-classification-gate');
  if (await classificationGate.isVisible().catch(() => false)) {
    page.once('dialog', dialog => dialog.accept());
    await classificationGate.getByRole('button', { name: 'Classifica come materiale professionale', exact: true }).click();
  }
  const composer = page.getByTestId('library-copilot-composer');
  await expectDirectCopilotLaunch(composer, { intent, contextText: CLASS_NAME, sourceCard: card });
  return { card, composer };
}

async function assertAtLeast44(locator, label) {
  await expect(locator, `${label} visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} bounding box`).not.toBeNull();
  expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44);
  expect(box.width, `${label} width`).toBeGreaterThanOrEqual(44);
}

test('contextual Copilot direct Library actions are intent-owned and keep provider calls gated — desktop 1280x900', async ({ page }) => {
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

  let { composer } = await launchFromCard(page, SOURCE_TITLE, { intent: 'review' });
  const reviewPanel = composer.getByTestId('library-copilot-review-panel');
  await expect(reviewPanel).toBeVisible();
  await expect(reviewPanel.getByText('Revisione nel contesto', { exact: true })).toBeVisible();
  await expect(composer.getByTestId('library-copilot-link-action')).toHaveCount(0);
  await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toHaveCount(0);
  expect(proposalRequests).toHaveLength(0);
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  ({ composer } = await launchFromCard(page, SOURCE_TITLE, { intent: 'link' }));
  await expect(composer.getByTestId('library-copilot-link-action')).toBeVisible();
  await expect(composer.getByTestId('library-copilot-review-panel')).toHaveCount(0);
  await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toHaveCount(0);
  expect(proposalRequests).toHaveLength(0);
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  ({ composer } = await launchFromCard(page, SOURCE_TITLE, { intent: 'prepare' }));
  await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toBeVisible();
  await expect(composer.getByTestId('library-copilot-review-panel')).toHaveCount(0);
  await expect(composer.getByTestId('library-copilot-link-action')).toHaveCount(0);
  expect(proposalRequests).toHaveLength(0);
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  ({ composer } = await launchFromCard(page, SOURCE_TITLE, { targetTitle: SECOND_UDA_TITLE, intent: 'review' }));
  await expect(composer.getByTestId('library-copilot-review-panel')).toBeVisible();
  expect(proposalRequests).toHaveLength(0);

  await page.screenshot({ path: path.join(evidenceDir, 'library-contextual-copilot-handoff-desktop.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'library-contextual-copilot-handoff-desktop.json'), JSON.stringify({ candidateSha: process.env.CANDIDATE_SHA || null, viewport: { width: 1280, height: 900 }, proposalRequestCount: proposalRequests.length, pageErrors }, null, 2) + '\n');
  expect(pageErrors).toEqual([]);
});

test('contextual Copilot direct REVIEW gates professional classification before handoff — mobile 390x844', async ({ browser }) => {
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

  const card = await sourceCard(page, SOURCE_TITLE);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  await selectLibraryUseTarget(card, { udaTitle: UDA_TITLE });
  const reviewAction = libraryUseAction(card, 'review');
  await assertAtLeast44(reviewAction, 'Library REVIEW action');
  await reviewAction.click();

  const composer = page.getByTestId('library-copilot-composer');
  const classificationGate = card.getByTestId('library-professional-classification-gate');
  await expect(classificationGate).toBeVisible();
  await expect(classificationGate.getByText('Prima di continuare', { exact: true })).toBeVisible();
  await expect(composer).toHaveCount(0);

  page.once('dialog', async dialog => {
    expect(dialog.message()).toContain('Confermo che è materiale professionale del docente');
    await dialog.accept();
  });
  await classificationGate.getByRole('button', { name: 'Classifica come materiale professionale', exact: true }).click();

  await expectDirectCopilotLaunch(composer, { intent: 'review', contextText: CLASS_NAME, sourceCard: card });
  await expect(composer.getByTestId('library-copilot-review-panel')).toBeVisible();
  await assertAtLeast44(composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }), 'Copilot close');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(evidenceDir, 'library-contextual-copilot-handoff-mobile.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'library-contextual-copilot-handoff-mobile.json'), JSON.stringify({ candidateSha: process.env.CANDIDATE_SHA || null, viewport: { width: 390, height: 844 }, horizontalOverflowPx: overflow, pageErrors }, null, 2) + '\n');
  expect(pageErrors).toEqual([]);
  await context.close();
});
