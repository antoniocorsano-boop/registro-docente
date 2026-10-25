const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lib04c-browser-qualification';
const CLASS_NAME = 'Classe Sintetica LIB-04C';
const UDA_TITLE = 'UDA Sintetica LIB-04C';
const OVERRIDE_UDA_TITLE = 'UDA Alternativa LIB-04C';
const LESSON_TOPIC = 'Laboratorio sintetico LIB-04C';
const SOURCE_TITLE = 'Fonte Copilot LINK LIB-04C';
const MANUAL_SOURCE_TITLE = 'Fonte Copilot mobile LIB-04C';

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

async function selectSyntheticClass(page) {
  const classButton = page.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true });
  await expect(classButton).toBeVisible();
  await classButton.click();
  await expect(page.getByRole('heading', { name: `Panoramica Sezione: ${CLASS_NAME}` })).toBeVisible();
}

async function createSyntheticUda(page, title, className = null, { activeForSchoolYear = false } = {}) {
  await openDrawerItem(page, 'UDA');
  await page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'UDA', exact: true }).click();
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(title);
  if (className) {
    const classSelect = page.getByRole('dialog').getByRole('combobox', { name: 'Classe', exact: true });
    await expect(classSelect).toBeVisible();
    await classSelect.selectOption({ label: className });
  }
  if (activeForSchoolYear) {
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Mese Inizio').selectOption('0');
    await dialog.getByLabel('Durata Mesi').fill('10');
  }
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
}

async function addSyntheticLesson(page) {
  await page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'Analisi', exact: true }).click();
  await page.getByRole('button', { name: /Gap Analysis Competenze/ }).click();
  await expect(page.getByRole('heading', { name: /Gap Analysis Competenze & Verifiche Oggettive/ })).toBeVisible();

  const udaCard = page
    .getByText(UDA_TITLE, { exact: true })
    .last()
    .locator('xpath=ancestor::div[contains(@class,"rounded-xl") and contains(@class,"border")][1]');
  const dossierButton = udaCard.getByRole('button', { name: 'Dossier & Rubrica', exact: true });
  await expect(dossierButton).toBeVisible();
  await dossierButton.click();

  const topicInput = page.getByPlaceholder('Argomento o fase operativa svolta...');
  await expect(topicInput).toBeVisible();
  const form = topicInput.locator('xpath=ancestor::form');
  await topicInput.fill(LESSON_TOPIC);
  await form.locator('select').selectOption('laboratorio');
  await form.locator('button[type="submit"]').click();

  await expect(page.getByText('Attività registrata nel diario', { exact: true })).toBeVisible();
  await expect(page.getByText(LESSON_TOPIC, { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi Fascicolo', exact: true }).click();
}

async function openLibrary(page) {
  await openDrawerItem(page, 'Biblioteca privata');
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
}

async function addSyntheticSource(page, title) {
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(title);
  await page.getByLabel('Contenuto').fill(`Contenuto sintetico locale per ${title}.`);
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function sourceCard(page, title) {
  const heading = page.getByRole('heading', { name: title, exact: true });
  await expect(heading).toBeVisible();
  return heading.locator('xpath=ancestor::article');
}

async function assertAtLeast44(locator, label) {
  await expect(locator, `${label} visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} bounding box`).not.toBeNull();
  expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44);
  expect(box.width, `${label} width`).toBeGreaterThanOrEqual(44);
}

async function openComposer(page) {
  const trigger = page.locator('[data-testid="library-copilot-trigger"]');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const composer = page.locator('[data-testid="library-copilot-composer"]');
  await expect(composer).toBeVisible();
  return composer;
}

async function addTextSourceFromComposer(composer, title) {
  await composer.getByText('Aggiungi una nuova fonte', { exact: true }).click();
  await composer.getByRole('button', { name: 'Testo/idea', exact: true }).click();
  await composer.getByPlaceholder('Titolo della fonte').fill(title);
  await composer.getByPlaceholder('Incolla un testo, un appunto o descrivi un’idea…').fill(
    `Contenuto sintetico locale per ${title}: leve, meccanismi e attività didattica.`
  );
  await composer.getByRole('button', { name: 'Salva nella Biblioteca', exact: true }).click();
  const sourceSelect = composer.getByLabel('Fonte della Biblioteca');
  await expect(sourceSelect.locator('option:checked')).toHaveText(title);
}

async function resolveCopilotPossibilities(composer) {
  await composer.getByLabel('Che cosa vuoi farne?').fill('Collega questa fonte al lavoro didattico corrente.');
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  await expect(composer.getByText('Possibilità autorizzate', { exact: true })).toBeVisible();
  await expect(composer.getByRole('button', { name: 'Rivedi nel contesto', exact: true })).toHaveCount(0);
  await expect(composer.getByRole('button', { name: 'Collega a una UDA', exact: true })).toHaveCount(1);
  await expect(composer.getByText('Prepara attività', { exact: true })).toHaveCount(0);
  await expect(composer.getByText('Sintetizza la fonte', { exact: true })).toHaveCount(0);
}


test('LIB-04C LINK requires explicit confirmation then persists the current lesson — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const pageErrors = [];
  const externalRequests = [];
  let trackRequests = false;
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('request', request => {
    if (!trackRequests) return;
    const url = request.url();
    if (!url.startsWith(baseURL) && !url.startsWith('data:') && !url.startsWith('blob:')) externalRequests.push(url);
  });

  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createSyntheticUda(page, UDA_TITLE, CLASS_NAME);
  await addSyntheticLesson(page);
  await reloadAndUnlock(page);
  await selectSyntheticClass(page);

  let composer = await openComposer(page);
  await addTextSourceFromComposer(composer, SOURCE_TITLE);
  trackRequests = true;
  await resolveCopilotPossibilities(composer);

  const linkAction = composer.getByTestId('library-copilot-link-action');
  await expect(linkAction).toBeVisible();
  await linkAction.click();
  const confirmation = composer.getByTestId('library-copilot-link-confirmation');
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByText(`Destinazione: Lezione · ${LESSON_TOPIC}`, { exact: true })).toBeVisible();

  // First click must not mutate the Library.
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
  await openLibrary(page);
  let card = await sourceCard(page, SOURCE_TITLE);
  await card.getByText('Gestisci', { exact: true }).click();
  await expect(card.getByRole('button', { name: 'Scollega', exact: true })).toHaveCount(0);

  // Re-open the still-pending proposal and confirm explicitly.
  composer = await openComposer(page);
  await expect(composer.getByTestId('library-copilot-link-confirmation')).toBeVisible();
  await composer.getByRole('button', { name: 'Conferma collegamento', exact: true }).click();
  await expect(composer.getByText('Il collegamento è stato salvato nella Biblioteca.', { exact: true })).toBeVisible();
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  card = await sourceCard(page, SOURCE_TITLE);
  const linkedRow = card.getByRole('button', { name: 'Scollega', exact: true }).locator('xpath=..');
  await expect(linkedRow.getByText(LESSON_TOPIC, { exact: true })).toBeVisible();

  trackRequests = false;
  await reloadAndUnlock(page);
  await openLibrary(page);
  const reloadedCard = await sourceCard(page, SOURCE_TITLE);
  await reloadedCard.getByText('Gestisci', { exact: true }).click();
  const reloadedRow = reloadedCard.getByRole('button', { name: 'Scollega', exact: true }).locator('xpath=..');
  await expect(reloadedRow.getByText(LESSON_TOPIC, { exact: true })).toBeVisible();

  await page.screenshot({ path: path.join(evidenceDir, 'lib04c-copilot-link-desktop.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'lib04c-copilot-link-desktop.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 1280, height: 900 },
    checks: [
      'link-only-operational-action',
      'no-write-before-explicit-confirmation',
      'lesson-target-from-teaching-context',
      'durable-link-after-confirmation',
      'link-persists-after-reload',
      'no-external-network'
    ],
    externalRequests,
    pageErrors
  }, null, 2) + '\n');

  expect(externalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('LIB-04C LINK confirmation is touch-safe and cancel remains non-mutating — mobile 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createSyntheticUda(page, UDA_TITLE, CLASS_NAME, { activeForSchoolYear: true });
  await reloadAndUnlock(page);
  await selectSyntheticClass(page);

  const composer = await openComposer(page);
  await addTextSourceFromComposer(composer, MANUAL_SOURCE_TITLE);
  await resolveCopilotPossibilities(composer);

  const linkAction = composer.getByTestId('library-copilot-link-action');
  await assertAtLeast44(linkAction, 'mobile Copilot LINK action');
  await linkAction.click();
  const confirmation = composer.getByTestId('library-copilot-link-confirmation');
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByText(`Destinazione: UDA · ${UDA_TITLE}`, { exact: true })).toBeVisible();

  const confirmButton = confirmation.getByRole('button', { name: 'Conferma collegamento', exact: true });
  const cancelButton = confirmation.getByRole('button', { name: 'Annulla', exact: true });
  await assertAtLeast44(confirmButton, 'mobile confirm LINK');
  await assertAtLeast44(cancelButton, 'mobile cancel LINK');

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

  await cancelButton.click();
  await expect(confirmation).toBeHidden();
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
  await openLibrary(page);
  const card = await sourceCard(page, MANUAL_SOURCE_TITLE);
  await card.getByText('Gestisci', { exact: true }).click();
  await expect(card.getByRole('button', { name: 'Scollega', exact: true })).toHaveCount(0);

  await page.screenshot({ path: path.join(evidenceDir, 'lib04c-copilot-link-mobile.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'lib04c-copilot-link-mobile.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 390, height: 844 },
    overflow,
    pageErrors
  }, null, 2) + '\n');

  expect(pageErrors).toEqual([]);
  await context.close();
});
