const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lib01d-browser-qualification';
const CLASS_NAME = 'Classe Sintetica LIB-01D';
const STUDENT_NAME = 'Studente Segreto Sintetico LIB-01D';
const UDA_TITLE = 'UDA Sintetica LIB-01D';
const ALT_UDA_TITLE = 'UDA Alternativa LIB-01D';
const SOURCE_TITLE = 'Fonte professionale sintetica LIB-01D';
const SECOND_SOURCE_TITLE = 'Fonte alternativa sintetica LIB-01D';
const PROPOSAL_TITLE = 'Proposta sintetica LIB-01D';
const ADAPTED_TITLE = 'Proposta adattata dal docente LIB-01D';
const ADAPTED_TASK = 'Costruisci una mappa delle trasformazioni e giustifica due passaggi.';

const proposalContent = {
  title: PROPOSAL_TITLE,
  objective: 'Riconoscere e rappresentare una trasformazione tecnologica.',
  teacherSetup: 'Presentare la fonte sintetica e richiamare il lessico essenziale.',
  studentTask: 'Ricostruire il processo descritto dalla fonte e motivare i passaggi.',
  steps: ['Osserva la fonte', 'Ricostruisci il processo', 'Confronta le scelte'],
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
  const drawer = page.getByRole('complementary');
  const item = drawer.getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

async function createSyntheticClassAndStudent(page) {
  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);

  const shield = page.locator('button[title^="Privacy Shield"]').first();
  if (await shield.isVisible().catch(() => false)) await shield.click();

  const studentInput = page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)');
  await studentInput.fill(STUDENT_NAME);
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(page.getByText(STUDENT_NAME, { exact: true })).toBeVisible();
}

async function selectSyntheticClass(page) {
  const classButton = page.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true });
  await expect(classButton).toBeVisible();
  await classButton.click();
  await expect(page.getByRole('heading', { name: `Panoramica Sezione: ${CLASS_NAME}` })).toBeVisible();
}

async function createSyntheticUda(page, title, className = null, { activeForSchoolYear = false } = {}) {
  await openDrawerItem(page, 'UDA');
  const udaViewToggle = page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'UDA', exact: true });
  if (await udaViewToggle.isVisible().catch(() => false)) await udaViewToggle.click();
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

async function openLibrary(page) {
  await openDrawerItem(page, 'Biblioteca privata');
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
}

async function addSyntheticSource(page, title) {
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(title);
  await page.getByLabel('Contenuto').fill('Fonte sintetica professionale sulle trasformazioni di energia e materia.');
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

async function selectComposerSource(composer, title) {
  const sourceSelect = composer.getByLabel('Fonte della Biblioteca');
  await sourceSelect.selectOption({ label: title });
  await expect(sourceSelect.locator('option:checked')).toHaveText(title);
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
      generatedAt: '2026-10-25T06:30:00.000Z'
    }
  };
}

function receiptForRequest(index) {
  return {
    requestId: `browser-lib01d-${index}`,
    provider: 'browser-fixture',
    model: 'browser-fixture-v1',
    durationMs: 10,
    promptTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    attemptCount: 1
  };
}

async function installProposalRoute(page, capturedBodies) {
  await page.route('**/api/copilot/library-proposal/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        available: true,
        provider: 'Browser Provider',
        model: 'browser-fixture-v1'
      })
    });
  });
  await page.route('**/api/copilot/library-proposal', async route => {
    const request = route.request();
    const body = request.postDataJSON();
    capturedBodies.push(body);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(STUDENT_NAME);
    expect(serialized).not.toMatch(/studentId|students|roster|grades|behavior/i);
    expect(body.classification).toBe('TEACHER_PROFESSIONAL');
    expect(body.explicitTeacherOptIn).toBe(true);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        proposal: proposalForRequest(body),
        receipt: receiptForRequest(capturedBodies.length)
      })
    });
  });
}

async function openPrepareFromIntent(composer) {
  await composer.getByLabel('Che cosa vuoi farne?').fill('crea una proposta didattica a partire da questo materiale');
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  const disclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  await expect(disclosure).toBeVisible();
  return disclosure;
}

test('LIB-01D source → governed proposal → leave/adapt/adopt → durable reload — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const pageErrors = [];
  const consoleErrors = [];
  const externalRequests = [];
  const proposalBodies = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith(baseURL) || url.startsWith('data:') || url.startsWith('blob:')) return;
    const hostname = new URL(url).hostname;
    const shellAssetHost = hostname === 'fonts.googleapis.com'
      || hostname === 'fonts.gstatic.com'
      || hostname === 'cdnjs.cloudflare.com';
    if (!shellAssetHost) externalRequests.push(url);
  });
  await installProposalRoute(page, proposalBodies);

  await setupFreshVault(page);
  await createSyntheticClassAndStudent(page);
  await createSyntheticUda(page, UDA_TITLE, CLASS_NAME, { activeForSchoolYear: true });
  await createSyntheticUda(page, ALT_UDA_TITLE, CLASS_NAME, { activeForSchoolYear: true });
  await openLibrary(page);
  await addSyntheticSource(page, SOURCE_TITLE);
  await addSyntheticSource(page, SECOND_SOURCE_TITLE);
  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  await openLibrary(page);

  const card = await sourceCard(page, SOURCE_TITLE);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  await card.getByLabel('UDA corrente').selectOption({ label: UDA_TITLE });

  expect(proposalBodies).toHaveLength(0);
  await card.getByRole('button', { name: 'Usa con Copilota', exact: true }).click();
  let composer = page.locator('[data-testid=\"library-copilot-composer\"]');
  await expect(composer).toBeVisible();
  await expect(composer.getByLabel('Fonte della Biblioteca').locator('option:checked')).toHaveText(SOURCE_TITLE);
  expect(proposalBodies).toHaveLength(0);
  let disclosure = await openPrepareFromIntent(composer);
  await expect(disclosure.getByText('Prima verifica la natura della fonte', { exact: true })).toBeVisible();
  await expect(disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true })).toHaveCount(0);
  expect(proposalBodies).toHaveLength(0);

  await selectComposerSource(composer, SECOND_SOURCE_TITLE);
  await expect(disclosure).toHaveCount(0);
  await expect(disclosure.getByText('Prima verifica la natura della fonte', { exact: true })).toHaveCount(0);
  expect(proposalBodies).toHaveLength(0);

  await selectComposerSource(composer, SOURCE_TITLE);
  await openPrepareFromIntent(composer);
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
  await expect(disclosure.getByText(proposalContent.studentTask, { exact: true })).toBeVisible();
  expect(proposalBodies).toHaveLength(1);

  await disclosure.getByRole('button', { name: 'Lascia', exact: true }).click();
  await expect(disclosure.getByRole('region', { name: 'Proposta didattica' })).toHaveCount(0);
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
  await openLibrary(page);
  await expect(page.getByRole('heading', { name: PROPOSAL_TITLE, exact: true })).toHaveCount(0);

  composer = await openComposer(page);
  await selectComposerSource(composer, SOURCE_TITLE);
  const disclosureAgain = await openPrepareFromIntent(composer);
  await expect(disclosureAgain.getByRole('button', { name: 'Consenti per questa richiesta', exact: true })).toBeVisible();
  await disclosureAgain.getByRole('button', { name: 'Consenti per questa richiesta', exact: true }).click();
  await disclosureAgain.getByRole('button', { name: 'Prepara attività', exact: true }).click();
  await expect(disclosureAgain.getByRole('region', { name: 'Proposta didattica' })).toBeVisible();
  await expect(disclosureAgain.getByRole('heading', { name: PROPOSAL_TITLE, exact: true })).toBeVisible();
  expect(proposalBodies).toHaveLength(2);

  await disclosureAgain.getByRole('button', { name: 'Adatta', exact: true }).click();
  const editor = disclosureAgain.getByRole('region', { name: 'Adatta proposta didattica' });
  await expect(editor).toBeVisible();
  await editor.getByLabel('Titolo').fill(ADAPTED_TITLE);
  await editor.getByLabel('Consegna agli studenti').fill(ADAPTED_TASK);
  expect(proposalBodies).toHaveLength(2);
  await editor.getByRole('button', { name: 'Adotta in Biblioteca', exact: true }).click();
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  const adopted = await sourceCard(page, ADAPTED_TITLE);
  await expect(adopted.getByText('Materiale interno', { exact: true })).toBeVisible();
  await expect(adopted.getByText('Proposta didattica adottata dal docente', { exact: true })).toBeVisible();
  await expect(adopted).toContainText(ADAPTED_TASK);
  await adopted.getByText('Gestisci', { exact: true }).click();
  const linkedRow = adopted.getByRole('button', { name: 'Scollega', exact: true }).locator('xpath=..');
  await expect(linkedRow.getByText(UDA_TITLE, { exact: true })).toBeVisible();

  await reloadAndUnlock(page);
  await openLibrary(page);
  const reloaded = await sourceCard(page, ADAPTED_TITLE);
  await expect(reloaded.getByText('Materiale interno', { exact: true })).toBeVisible();
  await expect(reloaded.getByText('Proposta didattica adottata dal docente', { exact: true })).toBeVisible();
  await expect(reloaded).toContainText(ADAPTED_TASK);
  await reloaded.getByText('Gestisci', { exact: true }).click();
  const reloadedLinkedRow = reloaded.getByRole('button', { name: 'Scollega', exact: true }).locator('xpath=..');
  await expect(reloadedLinkedRow.getByText(UDA_TITLE, { exact: true })).toBeVisible();

  await page.screenshot({ path: path.join(evidenceDir, 'lib01d-governed-proposal-desktop.png'), fullPage: true });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib01d-governed-proposal-desktop.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 1280, height: 900 },
      proposalRequestCount: proposalBodies.length,
      checks: [
        'no-request-before-classification-and-consent',
        'prepare-resolved-after-one-shot-consent',
        'student-data-excluded',
        'structured-proposal-rendered',
        'leave-does-not-persist',
        'adapt-is-local',
        'adopt-uses-existing-library-persistence',
        'adopted-material-survives-reload',
        'derived-origin-and-teaching-link-survive-reload',
        'no-external-network'
      ],
      externalRequests,
      pageErrors,
      consoleErrors
    }, null, 2) + '\n'
  );

  expect(externalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('LIB-01D proposal disclosure is touch-safe and context changes revoke consent/proposal — mobile 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const proposalBodies = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await installProposalRoute(page, proposalBodies);

  await setupFreshVault(page);
  await createSyntheticClassAndStudent(page);
  await createSyntheticUda(page, UDA_TITLE, CLASS_NAME, { activeForSchoolYear: true });
  await createSyntheticUda(page, ALT_UDA_TITLE, CLASS_NAME, { activeForSchoolYear: true });
  await openLibrary(page);
  await addSyntheticSource(page, SOURCE_TITLE);
  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  await openLibrary(page);

  const card = await sourceCard(page, SOURCE_TITLE);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  const contextSelect = card.getByLabel('UDA corrente');
  await contextSelect.selectOption({ label: UDA_TITLE });

  await card.getByRole('button', { name: 'Usa con Copilota', exact: true }).click();
  const composer = page.locator('[data-testid=\"library-copilot-composer\"]');
  await expect(composer).toBeVisible();
  await expect(composer.getByLabel('Fonte della Biblioteca').locator('option:checked')).toHaveText(SOURCE_TITLE);
  await assertAtLeast44(composer.getByLabel('Che cosa vuoi farne?'), 'mobile prepare request');
  await assertAtLeast44(composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }), 'mobile prepare submit');
  const disclosure = await openPrepareFromIntent(composer);

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
  await assertAtLeast44(disclosure.getByRole('button', { name: 'Adotta in Biblioteca', exact: true }), 'mobile Library-only adopt');
  await assertAtLeast44(disclosure.getByRole('button', { name: "Adotta e aggiungi all'UDA", exact: true }), 'mobile compound adopt');
  await assertAtLeast44(disclosure.getByRole('button', { name: 'Adatta', exact: true }), 'mobile adapt');
  await assertAtLeast44(disclosure.getByRole('button', { name: 'Lascia', exact: true }), 'mobile leave');

  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
  await contextSelect.selectOption({ label: ALT_UDA_TITLE });
  await card.getByRole('button', { name: 'Usa con Copilota', exact: true }).click();
  await expect(composer).toBeVisible();
  await expect(disclosure).toHaveCount(0);
  await openPrepareFromIntent(composer);
  await expect(disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true })).toBeVisible();
  expect(proposalBodies).toHaveLength(1);

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

  await page.screenshot({ path: path.join(evidenceDir, 'lib01d-governed-proposal-mobile.png'), fullPage: true });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib01d-governed-proposal-mobile.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 390, height: 844 },
      proposalRequestCount: proposalBodies.length,
      overflow,
      pageErrors,
      consoleErrors
    }, null, 2) + '\n'
  );

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await context.close();
});