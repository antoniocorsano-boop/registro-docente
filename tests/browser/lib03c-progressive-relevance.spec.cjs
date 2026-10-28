const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lib03c-browser-qualification';
const CLASS_NAME = '3C LIB-03C';
const SOURCE_TITLE = 'Energia eolica turbina vento';
const UDA_TITLES = [
  'Energia eolica turbina vento',
  'Energia eolica turbina',
  'Energia eolica',
  'Energia'
];

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

async function openDrawerItem(page, label) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const item = page.getByRole('complementary').getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

async function createSyntheticUda(page, title) {
  await openDrawerItem(page, 'UDA');
  await page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'UDA', exact: true }).click();
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(title);
  const classSelect = page.getByRole('dialog').getByRole('combobox', { name: 'Classe', exact: true });
  await expect(classSelect).toBeVisible();
  await classSelect.selectOption({ label: CLASS_NAME });
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
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
  await page.getByLabel('Contenuto').fill('Energia eolica: il vento muove una turbina per produrre elettricità.');
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();
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

async function sourceCard(page) {
  const heading = page.getByRole('heading', { name: SOURCE_TITLE, exact: true });
  await expect(heading).toBeVisible();
  return heading.locator('xpath=ancestor::article');
}

async function buildFixture(page) {
  await setupFreshVault(page);
  await createSyntheticClass(page);
  for (const title of UDA_TITLES) await createSyntheticUda(page, title);
  await openLibrary(page);
  await addSyntheticSource(page);
  await reloadAndUnlock(page);
  await openLibrary(page);
}

function exactUdaCandidate(page, relevanceRegion, title) {
  return relevanceRegion
    .locator('[data-relevance-candidate="true"]')
    .filter({ has: page.getByText(title, { exact: true }) });
}

test('LIB-03C reveals ranked destinations progressively and keeps linking human-governed — desktop', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await buildFixture(page);
  const card = await sourceCard(page);

  await expect(card.getByRole('button', { name: 'Trova dove può servire', exact: true })).toHaveCount(0);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  const findButton = card.getByRole('button', { name: 'Trova dove può servire', exact: true });
  await expect(findButton).toBeVisible();
  await findButton.click();

  const relevanceRegion = card.getByRole('region', { name: 'Dove può servire questa fonte' });
  await expect(relevanceRegion).toBeVisible();
  const candidates = relevanceRegion.locator('[data-relevance-candidate="true"]');
  await expect(candidates).toHaveCount(3);
  await expect(candidates.nth(0).getByText(UDA_TITLES[0], { exact: true })).toBeVisible();
  await expect(candidates.nth(1).getByText(UDA_TITLES[1], { exact: true })).toBeVisible();
  await expect(candidates.nth(2).getByText(UDA_TITLES[2], { exact: true })).toBeVisible();
  await expect(relevanceRegion.getByText(UDA_TITLES[3], { exact: true })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Scollega', exact: true })).toHaveCount(0);

  await relevanceRegion.getByRole('button', { name: 'Mostra altri risultati', exact: true }).click();
  await expect(relevanceRegion.getByText(UDA_TITLES[3], { exact: true })).toBeVisible();
  expect(await relevanceRegion.locator('[data-relevance-candidate="true"]').count()).toBeGreaterThan(3);

  const secondCandidate = exactUdaCandidate(page, relevanceRegion, UDA_TITLES[1]);
  await secondCandidate.getByRole('button', { name: 'Ignora', exact: true }).click();
  await expect(relevanceRegion.getByText(UDA_TITLES[1], { exact: true })).toHaveCount(0);

  const prepareCandidate = exactUdaCandidate(page, relevanceRegion, UDA_TITLES[2]);
  await prepareCandidate.getByRole('button', { name: 'Usa per preparare', exact: true }).click();
  await expect(card.getByText(`UDA · ${UDA_TITLES[2]}`, { exact: true })).toBeVisible();

  await card.getByRole('button', { name: 'Usa con Copilota', exact: true }).click();
  const composer = page.getByTestId('library-copilot-composer');
  await expect(composer).toBeVisible();
  await expect(composer.getByTestId('teacher-first-existing-bindings')).toContainText(`Materiale già disponibile: ${SOURCE_TITLE}`);
  await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toHaveCount(0);
  await expect(card.getByText(`UDA · ${UDA_TITLES[2]}`, { exact: true })).toBeVisible();
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  const reopenSuggestions = card.getByRole('button', { name: 'Trova dove può servire', exact: true });
  await expect(reopenSuggestions).toBeVisible();
  await reopenSuggestions.click();
  await expect(relevanceRegion).toBeVisible();
  await relevanceRegion.getByRole('button', { name: 'Aggiorna suggerimenti', exact: true }).click();

  const topCandidate = exactUdaCandidate(page, relevanceRegion, UDA_TITLES[0]);
  await topCandidate.getByRole('button', { name: 'Collega', exact: true }).click();
  await expect(topCandidate.getByText('Confermi il collegamento a questa destinazione?', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Scollega', exact: true })).toHaveCount(0);
  await topCandidate.getByRole('button', { name: 'Conferma collegamento', exact: true }).click();

  await card.getByText('Gestisci', { exact: true }).click();
  const linkedRow = card.getByRole('button', { name: 'Scollega', exact: true }).locator('xpath=..');
  await expect(linkedRow.getByText(UDA_TITLES[0], { exact: true })).toBeVisible();

  await relevanceRegion.getByRole('button', { name: 'Aggiorna suggerimenti', exact: true }).click();
  await expect(relevanceRegion.getByText(UDA_TITLES[0], { exact: true })).toHaveCount(0);

  await page.screenshot({ path: path.join(evidenceDir, 'lib03c-progressive-relevance-desktop.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'lib03c-progressive-relevance-desktop.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 1280, height: 900 },
    pageErrors
  }, null, 2) + '\n');

  expect(pageErrors).toEqual([]);
});

test('LIB-03C relevance panel stays progressive and readable at 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await buildFixture(page);
  const card = await sourceCard(page);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  await card.getByRole('button', { name: 'Trova dove può servire', exact: true }).click();

  const relevanceRegion = card.getByRole('region', { name: 'Dove può servire questa fonte' });
  await expect(relevanceRegion.locator('[data-relevance-candidate="true"]')).toHaveCount(3);
  await expect(relevanceRegion.getByRole('button', { name: 'Mostra altri risultati', exact: true })).toBeVisible();

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

  await page.screenshot({ path: path.join(evidenceDir, 'lib03c-progressive-relevance-mobile.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'lib03c-progressive-relevance-mobile.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 390, height: 844 },
    overflow,
    pageErrors
  }, null, 2) + '\n');

  expect(pageErrors).toEqual([]);
  await context.close();
});