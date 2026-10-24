const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lib01c-browser-qualification';
const CLASS_NAME = 'Classe Sintetica LIB-01C';
const UDA_TITLE = 'UDA Sintetica LIB-01C';
const OVERRIDE_UDA_TITLE = 'UDA Alternativa LIB-01C';
const LESSON_TOPIC = 'Laboratorio sintetico LIB-01C';
const SOURCE_TITLE = 'Fonte contestuale lezione LIB-01C';
const MANUAL_SOURCE_TITLE = 'Fonte senza proposta LIB-01C';

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
  const item = page.getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

async function createSyntheticUda(page, title) {
  await openDrawerItem(page, 'UDA');
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(title);
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
}

async function addSyntheticLesson(page) {
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

test('LIB-01C proposes deterministic teaching context but persists the teacher override — desktop 1280x900', async ({ page }) => {
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
  await createSyntheticClass(page);
  await createSyntheticUda(page, UDA_TITLE);
  await addSyntheticLesson(page);
  await createSyntheticUda(page, OVERRIDE_UDA_TITLE);
  await openLibrary(page);
  await addSyntheticSource(page, SOURCE_TITLE);

  await reloadAndUnlock(page);
  await openLibrary(page);
  const card = await sourceCard(page, SOURCE_TITLE);
  trackContextualRequests = true;
  await card.getByRole('button', { name: 'Usa', exact: true }).click();

  await expect(card.getByText('Contesto proposto', { exact: true })).toBeVisible();
  await expect(card.getByText(`Lezione · ${LESSON_TOPIC}`, { exact: true })).toBeVisible();
  await expect(card.getByText('Ti propongo questa lezione perché appartiene alla classe corrente ed è prevista oggi.', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Cambia', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Prepara materiale', exact: true })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Sintetizza la fonte', exact: true })).toHaveCount(0);

  await card.getByRole('button', { name: 'Cambia', exact: true }).click();
  await expect(card.getByLabel('UDA corrente')).toHaveValue(/.+/);
  await card.getByLabel('UDA corrente').selectOption({ label: OVERRIDE_UDA_TITLE });
  await expect(card.getByLabel('Lezione corrente')).toHaveCount(0);

  await card.getByRole('button', { name: 'Rivedi nel contesto', exact: true }).click();
  await expect(card.getByText(`UDA: ${OVERRIDE_UDA_TITLE}`, { exact: true })).toBeVisible();

  await card.getByRole('button', { name: 'Collega a una UDA', exact: true }).click();
  await expect(card.getByText(`Destinazione: UDA · ${OVERRIDE_UDA_TITLE}`, { exact: false })).toBeVisible();
  await card.getByRole('button', { name: 'Continua', exact: true }).click();
  await expect(card.getByText('Confermi il collegamento della fonte alla UDA selezionata?', { exact: true })).toBeVisible();

  await card.getByText('Gestisci', { exact: true }).click();
  await expect(card.getByRole('button', { name: 'Scollega', exact: true })).toHaveCount(0);

  await card.getByRole('button', { name: 'Conferma collegamento', exact: true }).click();
  const linkedOverrideRow = card.getByRole('button', { name: 'Scollega', exact: true }).locator('xpath=..');
  await expect(linkedOverrideRow.getByText(OVERRIDE_UDA_TITLE, { exact: true })).toBeVisible();
  await expect(linkedOverrideRow.getByText(LESSON_TOPIC, { exact: true })).toHaveCount(0);

  trackContextualRequests = false;
  await reloadAndUnlock(page);
  await openLibrary(page);
  const reloadedCard = await sourceCard(page, SOURCE_TITLE);
  await reloadedCard.getByText('Gestisci', { exact: true }).click();
  const reloadedOverrideRow = reloadedCard.getByRole('button', { name: 'Scollega', exact: true }).locator('xpath=..');
  await expect(reloadedOverrideRow.getByText(OVERRIDE_UDA_TITLE, { exact: true })).toBeVisible();

  await page.screenshot({ path: path.join(evidenceDir, 'lib01c-teaching-context-desktop.png'), fullPage: true });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib01c-teaching-context-desktop.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 1280, height: 900 },
      checks: [
        'deterministic-context-proposed',
        'proposal-explained',
        'teacher-can-change-context',
        'teacher-override-used-by-review',
        'human-confirmation-before-link',
        'teacher-override-persists-after-reload',
        'generative-actions-unavailable',
        'no-contextual-external-network'
      ],
      contextualExternalRequests,
      pageErrors
    }, null, 2) + '\n'
  );

  expect(contextualExternalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('LIB-01C falls back to manual context when no deterministic suggestion exists and stays touch-safe — mobile 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await setupFreshVault(page);
  await createSyntheticUda(page, UDA_TITLE);
  await openLibrary(page);
  await addSyntheticSource(page, MANUAL_SOURCE_TITLE);

  const card = await sourceCard(page, MANUAL_SOURCE_TITLE);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  await expect(card.getByText('Contesto proposto', { exact: true })).toHaveCount(0);
  await expect(card.getByText('Scegli dove usarla', { exact: true })).toBeVisible();

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

  await page.screenshot({ path: path.join(evidenceDir, 'lib01c-teaching-context-mobile.png'), fullPage: true });
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
