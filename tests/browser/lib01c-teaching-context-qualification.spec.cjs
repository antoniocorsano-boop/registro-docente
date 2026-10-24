const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lib01c-browser-qualification';
const UDA_TITLE = 'UDA Sintetica LIB-01C';
const LESSON_TOPIC = 'Laboratorio sintetico LIB-01C';
const SOURCE_TITLE = 'Fonte contestuale lezione LIB-01C';
const UDA_ONLY_SOURCE_TITLE = 'Fonte contestuale UDA LIB-01C';

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(120000);

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

async function addSyntheticLesson(page) {
  await page.getByRole('button', { name: 'Gap Analysis Competenze', exact: true }).click();
  const dossierButton = page.getByRole('button', { name: 'Dossier & Rubrica', exact: true }).first();
  await expect(dossierButton).toBeVisible();
  await dossierButton.click();
  const topicInput = page.getByPlaceholder('Argomento o fase operativa svolta...');
  await expect(topicInput).toBeVisible();
  const form = topicInput.locator('xpath=ancestor::form');
  await topicInput.fill(LESSON_TOPIC);
  await form.locator('select').selectOption('laboratorio');
  await form.locator('button[type="submit"]').click();
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

test('LIB-01C binds a private source to explicit UDA/lesson context and persists only after Core confirmation — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const pageErrors = [];
  const contextualExternalRequests = [];
  let trackContextualRequests = false;
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('request', request => {
    if (!trackContextualRequests) return;
    const url = request.url();
    if (!url.startsWith(baseURL) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      contextualExternalRequests.push(url);
    }
  });

  await setupFreshVault(page);
  await createSyntheticUda(page);
  await addSyntheticLesson(page);
  await openLibrary(page);
  await addSyntheticSource(page, SOURCE_TITLE);

  // Context selection is intentionally ephemeral: reload must return to the compact source card.
  await reloadAndUnlock(page);
  await openLibrary(page);
  await expect(page.getByText('Contesto di lavoro', { exact: true })).toHaveCount(0);

  const card = await sourceCard(page, SOURCE_TITLE);
  trackContextualRequests = true;
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  await expect(card.getByText('Contesto di lavoro', { exact: true })).toBeVisible();
  await expect(card.getByText('Seleziona un’UDA per usare la fonte nel contesto didattico.', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Prepara materiale', exact: true })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Sintetizza la fonte', exact: true })).toHaveCount(0);

  await card.getByLabel('UDA corrente').selectOption({ label: UDA_TITLE });
  await expect(card.getByLabel('Lezione corrente')).toBeVisible();
  await card.getByLabel('Lezione corrente').selectOption({ label: LESSON_TOPIC });
  await expect(card.getByText('Tipo di attività:', { exact: false })).toContainText('Laboratorio');

  await card.getByRole('button', { name: 'Rivedi nel contesto', exact: true }).click();
  await expect(card.getByText(`UDA: ${UDA_TITLE}`, { exact: true })).toBeVisible();
  await expect(card.getByText(`Lezione: ${LESSON_TOPIC}`, { exact: true })).toBeVisible();
  await expect(card.getByText('Privacy da verificare', { exact: true })).toBeVisible();

  await card.getByRole('button', { name: 'Collega a una UDA', exact: true }).click();
  await expect(card.getByText(`Destinazione: Lezione · ${LESSON_TOPIC}`, { exact: false })).toBeVisible();
  await card.getByRole('button', { name: 'Continua', exact: true }).click();
  await expect(card.getByText('Confermi il collegamento della fonte alla lezione selezionata?', { exact: true })).toBeVisible();

  // First shared-Core dispatch is a gate only: vertical state is still untouched.
  await card.getByText('Gestisci', { exact: true }).click();
  await expect(card.getByRole('button', { name: 'Scollega', exact: true })).toHaveCount(0);

  await card.getByRole('button', { name: 'Conferma collegamento', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Scollega', exact: true })).toBeVisible();
  await expect(card.getByText(LESSON_TOPIC, { exact: true })).toBeVisible();

  // Shell reload is outside the contextual Core network boundary.
  trackContextualRequests = false;

  // Durable link survives lock/unlock while the transient teaching-context selection does not.
  await reloadAndUnlock(page);
  await openLibrary(page);
  const reloadedCard = await sourceCard(page, SOURCE_TITLE);
  await expect(reloadedCard.getByText('Contesto di lavoro', { exact: true })).toHaveCount(0);
  await reloadedCard.getByText('Gestisci', { exact: true }).click();
  await expect(reloadedCard.getByText(LESSON_TOPIC, { exact: true })).toBeVisible();
  await expect(reloadedCard.getByRole('button', { name: 'Scollega', exact: true })).toBeVisible();

  // A second source proves the UDA-only fallback without fabricating a lesson target.
  await addSyntheticSource(page, UDA_ONLY_SOURCE_TITLE);
  const udaOnlyCard = await sourceCard(page, UDA_ONLY_SOURCE_TITLE);
  trackContextualRequests = true;
  await udaOnlyCard.getByRole('button', { name: 'Usa', exact: true }).click();
  await udaOnlyCard.getByLabel('UDA corrente').selectOption({ label: UDA_TITLE });
  await expect(udaOnlyCard.getByLabel('Lezione corrente')).toBeVisible();
  await expect(udaOnlyCard.getByLabel('Lezione corrente')).toHaveValue('');
  await udaOnlyCard.getByRole('button', { name: 'Collega a una UDA', exact: true }).click();
  await expect(udaOnlyCard.getByText(`Destinazione: UDA · ${UDA_TITLE}`, { exact: false })).toBeVisible();
  await udaOnlyCard.getByRole('button', { name: 'Continua', exact: true }).click();
  await expect(udaOnlyCard.getByText('Confermi il collegamento della fonte alla UDA selezionata?', { exact: true })).toBeVisible();
  await udaOnlyCard.getByRole('button', { name: 'Conferma collegamento', exact: true }).click();
  await udaOnlyCard.getByText('Gestisci', { exact: true }).click();
  await expect(udaOnlyCard.getByText(UDA_TITLE, { exact: true })).toBeVisible();
  await expect(udaOnlyCard.getByRole('button', { name: 'Scollega', exact: true })).toBeVisible();

  await page.screenshot({
    path: path.join(evidenceDir, 'lib01c-teaching-context-desktop.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib01c-teaching-context-desktop.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 1280, height: 900 },
      checks: [
        'context-hidden-before-use',
        'explicit-uda-and-lesson-context',
        'activity-type-visible',
        'review-context-visible',
        'generative-actions-unavailable',
        'human-confirmation-before-lesson-link',
        'lesson-link-survives-reload',
        'uda-only-fallback',
        'no-contextual-external-network'
      ],
      contextualExternalRequests,
      pageErrors
    }, null, 2) + '\n'
  );

  expect(contextualExternalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('LIB-01C teaching-context controls remain touch-safe and overflow-free — mobile 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await setupFreshVault(page);
  await createSyntheticUda(page);
  await openLibrary(page);
  await addSyntheticSource(page, SOURCE_TITLE);

  const card = await sourceCard(page, SOURCE_TITLE);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  const udaSelect = card.getByLabel('UDA corrente');
  await assertAtLeast44(udaSelect, 'mobile UDA context select');
  await udaSelect.selectOption({ label: UDA_TITLE });
  await assertAtLeast44(card.getByRole('button', { name: 'Rivedi nel contesto', exact: true }), 'mobile review action');
  await assertAtLeast44(card.getByRole('button', { name: 'Collega a una UDA', exact: true }), 'mobile link action');
  await expect(card.getByRole('button', { name: 'Prepara materiale', exact: true })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Sintetizza la fonte', exact: true })).toHaveCount(0);

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

  await page.screenshot({
    path: path.join(evidenceDir, 'lib01c-teaching-context-mobile.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib01c-teaching-context-mobile.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 390, height: 844 },
      overflow,
      pageErrors
    }, null, 2) + '\n'
  );

  expect(pageErrors).toEqual([]);
  await context.close();
});
