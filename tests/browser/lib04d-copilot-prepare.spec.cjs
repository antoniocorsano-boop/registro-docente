const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lib04d-browser-qualification';
const CLASS_NAME = 'Classe Sintetica LIB-04D';
const UDA_TITLE = 'UDA Sintetica LIB-04D';
const SOURCE_TITLE = 'Fonte Copilot PREPARE LIB-04D';
const SECOND_SOURCE_TITLE = 'Fonte alternativa PREPARE LIB-04D';
const MOBILE_SOURCE_TITLE = 'Fonte mobile PREPARE LIB-04D';
const PROPOSAL_TITLE = 'Proposta Copilot PREPARE LIB-04D';

const proposalContent = {
  title: PROPOSAL_TITLE,
  objective: 'Riconoscere una trasformazione tecnologica e collegarla al contesto corrente.',
  teacherSetup: 'Richiamare il lessico essenziale e presentare la fonte selezionata.',
  studentTask: 'Ricostruire il processo e motivare due passaggi della trasformazione.',
  steps: ['Osserva la fonte', 'Ricostruisci il processo', 'Motiva i passaggi'],
  questions: ['Qual è il punto di partenza?', 'Quale trasformazione osservi?'],
  adaptationHint: 'Offrire una tabella guida con parole chiave.'
};

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

async function selectSyntheticClass(page) {
  const classButton = page.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true });
  await expect(classButton).toBeVisible();
  await classButton.click();
  await expect(page.getByRole('heading', { name: `Panoramica Sezione: ${CLASS_NAME}` })).toBeVisible();
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

async function openLibrary(page) {
  await openDrawerItem(page, 'Biblioteca privata');
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
}

async function addSyntheticSource(page, title) {
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(title);
  await page.getByLabel('Contenuto').fill(`Fonte sintetica professionale per ${title}.`);
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function sourceCard(page, title) {
  const heading = page.getByRole('heading', { name: title, exact: true });
  await expect(heading).toBeVisible();
  return heading.locator('xpath=ancestor::article');
}

async function openComposer(page) {
  const trigger = page.locator('[data-testid="library-copilot-trigger"]');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const composer = page.locator('[data-testid="library-copilot-composer"]');
  await expect(composer).toBeVisible();
  return composer;
}

async function selectComposerSource(composer, title) {
  const sourceSelect = composer.getByLabel('Fonte della Biblioteca');
  await sourceSelect.selectOption({ label: title });
  await expect(sourceSelect.locator('option:checked')).toHaveText(title);
}

async function assertAtLeast44(locator, label) {
  await expect(locator, `${label} visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} bounding box`).not.toBeNull();
  expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44);
  expect(box.width, `${label} width`).toBeGreaterThanOrEqual(44);
}

function proposalForRequest(body) {
  return {
    schemaVersion: 1,
    kind: 'activity',
    ...proposalContent,
    sourceId: body.source.id,
    context: {
      udaId: body.context.udaId,
      ...(body.context.lessonId ? { lessonId: body.context.lessonId } : {})
    },
    provenance: {
      mode: 'remote',
      provider: 'browser-fixture',
      model: 'browser-fixture-v1',
      generatedAt: '2026-10-25T12:00:00.000Z'
    }
  };
}

function receiptForRequest(index) {
  return {
    requestId: `browser-lib04d-${index}`,
    provider: 'browser-fixture',
    model: 'browser-fixture-v1',
    durationMs: 10,
    promptTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    attemptCount: 1
  };
}

async function installProposalRoutes(page, capturedBodies) {
  await page.route('**/api/copilot/library-proposal/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'browser-fixture-v1' })
    });
  });
  await page.route('**/api/copilot/library-proposal', async route => {
    const body = route.request().postDataJSON();
    capturedBodies.push(body);
    expect(body.classification).toBe('TEACHER_PROFESSIONAL');
    expect(body.explicitTeacherOptIn).toBe(true);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ proposal: proposalForRequest(body), receipt: receiptForRequest(capturedBodies.length) })
    });
  });
}

test('LIB-04D PREPARE reuses governed proposal flow and persists only after adoption — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const proposalBodies = [];
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await installProposalRoutes(page, proposalBodies);

  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createActiveSyntheticUda(page);
  await openLibrary(page);
  await addSyntheticSource(page, SOURCE_TITLE);
  await addSyntheticSource(page, SECOND_SOURCE_TITLE);
  await reloadAndUnlock(page);
  await selectSyntheticClass(page);

  let composer = await openComposer(page);
  await selectComposerSource(composer, SOURCE_TITLE);
  const disclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  const openPrepare = disclosure.getByRole('button', { name: 'Apri preparazione assistita', exact: true });
  await expect(openPrepare).toBeVisible();
  expect(proposalBodies).toHaveLength(0);

  await openPrepare.click();
  await expect(disclosure.getByText('Prima verifica la natura della fonte', { exact: true })).toBeVisible();
  expect(proposalBodies).toHaveLength(0);

  // Changing source before consent must close the PREPARE disclosure and remain non-mutating.
  await selectComposerSource(composer, SECOND_SOURCE_TITLE);
  await expect(disclosure.getByRole('button', { name: 'Apri preparazione assistita', exact: true })).toBeVisible();
  await expect(disclosure.getByText('Prima verifica la natura della fonte', { exact: true })).toHaveCount(0);
  expect(proposalBodies).toHaveLength(0);

  await selectComposerSource(composer, SOURCE_TITLE);
  await disclosure.getByRole('button', { name: 'Apri preparazione assistita', exact: true }).click();
  await disclosure.getByRole('button', { name: 'Classifica come materiale professionale', exact: true }).click();
  await expect(disclosure.getByText('Prepara una proposta didattica', { exact: true })).toBeVisible();
  expect(proposalBodies).toHaveLength(0);

  await disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true }).click();
  const prepare = disclosure.getByRole('button', { name: 'Prepara attività', exact: true });
  await expect(prepare).toBeVisible();
  expect(proposalBodies).toHaveLength(0);
  await prepare.click();
  await expect(disclosure.getByRole('region', { name: 'Proposta didattica' })).toBeVisible();
  await expect(disclosure.getByRole('heading', { name: PROPOSAL_TITLE, exact: true })).toBeVisible();
  expect(proposalBodies).toHaveLength(1);

  await disclosure.getByRole('button', { name: 'Lascia', exact: true }).click();
  await expect(disclosure.getByRole('region', { name: 'Proposta didattica' })).toHaveCount(0);
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
  await openLibrary(page);
  await expect(page.getByRole('heading', { name: PROPOSAL_TITLE, exact: true })).toHaveCount(0);

  // Reopening starts a fresh request-scoped consent; only explicit adoption persists the generated material.
  composer = await openComposer(page);
  await selectComposerSource(composer, SOURCE_TITLE);
  const disclosureAgain = composer.getByTestId('library-copilot-prepare-disclosure');
  await disclosureAgain.getByRole('button', { name: 'Apri preparazione assistita', exact: true }).click();
  await expect(disclosureAgain.getByRole('button', { name: 'Consenti per questa richiesta', exact: true })).toBeVisible();
  await disclosureAgain.getByRole('button', { name: 'Consenti per questa richiesta', exact: true }).click();
  await disclosureAgain.getByRole('button', { name: 'Prepara attività', exact: true }).click();
  await expect(disclosureAgain.getByRole('region', { name: 'Proposta didattica' })).toBeVisible();
  expect(proposalBodies).toHaveLength(2);
  await disclosureAgain.getByRole('button', { name: 'Adotta', exact: true }).click();
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  const adopted = await sourceCard(page, PROPOSAL_TITLE);
  await expect(adopted.getByText('Materiale interno', { exact: true })).toBeVisible();
  await expect(adopted.getByText('Proposta didattica adottata dal docente', { exact: true })).toBeVisible();

  await reloadAndUnlock(page);
  await openLibrary(page);
  const reloaded = await sourceCard(page, PROPOSAL_TITLE);
  await expect(reloaded.getByText('Materiale interno', { exact: true })).toBeVisible();

  await page.screenshot({ path: path.join(evidenceDir, 'lib04d-copilot-prepare-desktop.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'lib04d-copilot-prepare-desktop.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 1280, height: 900 },
    proposalRequestCount: proposalBodies.length,
    checks: [
      'no-proposal-post-before-consent',
      'source-change-closes-prepare-disclosure',
      'unknown-source-classification-before-remote',
      'one-shot-consent-before-prepare',
      'leave-is-non-mutating',
      'adopt-persists-internal-source',
      'adopted-source-survives-reload'
    ],
    pageErrors,
    consoleErrors
  }, null, 2) + '\n');

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('LIB-04D PREPARE disclosure and governed actions are touch-safe — mobile 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const proposalBodies = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await installProposalRoutes(page, proposalBodies);

  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createActiveSyntheticUda(page);
  await openLibrary(page);
  await addSyntheticSource(page, MOBILE_SOURCE_TITLE);
  await reloadAndUnlock(page);
  await selectSyntheticClass(page);

  const composer = await openComposer(page);
  await selectComposerSource(composer, MOBILE_SOURCE_TITLE);
  const disclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  const openPrepare = disclosure.getByRole('button', { name: 'Apri preparazione assistita', exact: true });
  await assertAtLeast44(openPrepare, 'mobile prepare disclosure');
  await openPrepare.click();

  const classify = disclosure.getByRole('button', { name: 'Classifica come materiale professionale', exact: true });
  await assertAtLeast44(classify, 'mobile professional classification');
  await classify.click();

  const consent = disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true });
  await assertAtLeast44(consent, 'mobile one-shot consent');
  await consent.click();
  const prepare = disclosure.getByRole('button', { name: 'Prepara attività', exact: true });
  await assertAtLeast44(prepare, 'mobile prepare action');
  await prepare.click();
  await expect(disclosure.getByRole('region', { name: 'Proposta didattica' })).toBeVisible();
  await assertAtLeast44(disclosure.getByRole('button', { name: 'Adotta', exact: true }), 'mobile adopt');
  await assertAtLeast44(disclosure.getByRole('button', { name: 'Adatta', exact: true }), 'mobile adapt');
  await assertAtLeast44(disclosure.getByRole('button', { name: 'Lascia', exact: true }), 'mobile leave');

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
  expect(proposalBodies).toHaveLength(1);

  await page.screenshot({ path: path.join(evidenceDir, 'lib04d-copilot-prepare-mobile.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'lib04d-copilot-prepare-mobile.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 390, height: 844 },
    proposalRequestCount: proposalBodies.length,
    overflow,
    pageErrors
  }, null, 2) + '\n');

  expect(pageErrors).toEqual([]);
  await context.close();
});
