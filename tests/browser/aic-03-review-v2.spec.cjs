const { test, expect } = require('@playwright/test');
const { selectLibraryUseTarget, libraryUseAction } = require('./library-use-surface-helpers.cjs');
const { expectExistingCopilotBindings } = require('./teacher-first-copilot-helpers.cjs');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'aic-03-browser-qualification';
const CLASS_NAME = '3C';
const UDA_TITLE = 'Energia eolica e trasformazioni AIC-03';
const LESSON_TOPIC = 'Energia eolica e turbina AIC-03';
const SOURCE_TITLE = 'Energia eolica e turbina AIC-03';
const WEAK_SOURCE_TITLE = 'Ceramica argilla cottura';
const REVIEW_MESSAGE = 'Rivedi questa fonte nel contesto didattico corrente';

function intentEnvelope(intent) {
  return {
    schema: 'registro.agent-intent/v1',
    intent,
    goal: intent === 'REVIEW'
      ? 'valutare la pertinenza della fonte'
      : intent === 'PREPARE'
        ? 'preparare una attività'
        : 'collegare la fonte al contesto corrente',
    contextTarget: 'current',
    confidence: 'high',
    needsClarification: false,
    classReference: 'current',
    udaReference: 'current',
    sourceReference: 'current'
  };
}

function installIntentRoute(page, state) {
  page.route('**/api/copilot/intent/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: true })
    });
  });

  return page.route('**/api/copilot/intent', async route => {
    state.intentRequests += 1;
    if (state.failIntent) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'UNAVAILABLE' })
      });
      return;
    }

    const body = route.request().postDataJSON();
    const message = String(body?.message || '').toLocaleLowerCase('it');
    const intent = message.includes('prepara') ? 'PREPARE' : 'REVIEW';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ intent: intentEnvelope(intent) })
    });
  });
}

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

async function createSyntheticUdaAndLesson(page) {
  await openDrawerItem(page, 'UDA');
  const views = page.getByRole('group', { name: 'Viste UDA' });
  const udaToggle = views.getByRole('button', { name: 'UDA', exact: true });
  if (await udaToggle.isVisible().catch(() => false)) await udaToggle.click();

  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(UDA_TITLE);
  await dialog.getByRole('combobox', { name: 'Classe', exact: true }).selectOption({ label: CLASS_NAME });
  await dialog.getByLabel('Mese Inizio').selectOption('0');
  await dialog.getByLabel('Durata Mesi').fill('10');
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(UDA_TITLE, { exact: true }).first()).toBeVisible();

  await views.getByRole('button', { name: 'Analisi', exact: true }).click();
  await page.getByRole('button', { name: /Gap Analysis Competenze/ }).click();
  const udaCard = page
    .getByText(UDA_TITLE, { exact: true })
    .last()
    .locator('xpath=ancestor::div[contains(@class,"rounded-xl") and contains(@class,"border")][1]');
  await udaCard.getByRole('button', { name: 'Dossier & Rubrica', exact: true }).click();

  const topicInput = page.getByPlaceholder('Argomento o fase operativa svolta...');
  const form = topicInput.locator('xpath=ancestor::form');
  await topicInput.fill(LESSON_TOPIC);
  await form.locator('select').selectOption('teoria');
  await form.locator('button[type="submit"]').click();
  await expect(page.getByText('Attività registrata nel diario', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi Fascicolo', exact: true }).click();
}

async function createAuthoritativePlanning(page) {
  await openDrawerItem(page, 'Programmazione didattica');
  await expect(page.getByRole('heading', { name: 'Programmazione didattica' })).toBeVisible();

  await page.getByLabel('Classe/livello').fill('3');
  await page.getByLabel('Coorte').fill('2026-2027:secondaria:classe-iii');
  await page.getByRole('button', { name: 'Calendario e normativa', exact: true }).click();
  await page.getByLabel('Regime normativo Arena').fill('IN2025');
  await page.getByLabel('Inizio lezioni').fill('2026-09-14');
  await page.getByLabel('Fine lezioni').fill('2027-06-08');
  await page.getByRole('button', { name: 'Organizzazione', exact: true }).click();
  await page.getByRole('button', { name: '+ Aggiungi periodo', exact: true }).click();
  const period = page.locator('[data-field="assessmentPeriods"]');
  await period.locator('input[type="date"]').nth(0).fill('2026-09-14');
  await period.locator('input[type="date"]').nth(1).fill('2027-06-08');
  await page.getByRole('button', { name: 'Salva profilo', exact: true }).click();
  await expect(page.getByLabel('Profilo salvato')).toBeVisible();

  const payload = {
    contract: 'ARENA_REGISTRO_PLANNING_CONTEXT_V1',
    contractVersion: 1,
    sourceProduct: 'ARENA',
    targetProduct: 'REGISTRO_DOCENTE',
    importMode: 'PREVIEW_ONLY',
    acceptanceRequired: true,
    automaticWriteAllowed: false,
    instituteName: 'Istituto sintetico AIC-03',
    schoolYear: '2026/27',
    sourceSchoolYear: '2026-2027',
    schoolOrder: 'secondaria',
    subjectCode: 'tecnologia',
    gradeLevel: 3,
    cohortRef: '2026-2027:secondaria:classe-iii',
    cohortRefKind: 'DERIVED_APPLICABILITY_KEY',
    normativeRegime: 'IN2025',
    applicabilityStatus: 'APPLICABLE',
    authorityState: 'APPROVED',
    vigencyStatus: 'VIGENTE',
    authorityReceiptRef: 'aic-03-browser-authority-receipt',
    masterId: 'AIC-03-MASTER',
    masterVersion: '1.0',
    structuralFingerprint: {
      scope: 'MASTER',
      algorithm: 'fnv1a',
      version: 1,
      hash: 'a1c03e01'
    },
    provenance: {
      repository: 'antoniocorsano-boop/CurManLight_arena',
      sourceCommit: '1234567890abcdef1234567890abcdef12345678',
      sourceDocumentId: 'aic03-curriculum',
      sourceRevisionId: 'aic03-rev-1'
    },
    curricoloItems: [{
      id: 'curr-energy-wind',
      kind: 'ANNUALITA_DISCIPLINARE',
      schoolStage: 'Secondaria di primo grado',
      gradeLabel: 'Classe III',
      sourceSection: 'Energia',
      text: 'Analizzare energia eolica, vento, turbina e trasformazioni per la produzione di energia elettrica.'
    }],
    privacyClass: 'PROFESSIONAL_NON_PERSONAL'
  };

  await page.getByLabel('Handoff Arena (.json)').setInputFiles({
    name: 'arena-aic03.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload), 'utf8')
  });
  await expect(page.getByText('APPROVED', { exact: true })).toBeVisible();
  await expect(page.getByText('VIGENTE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Accetta e collega al profilo', exact: true }).click();
  await expect(page.getByText(/Contesto Arena collegato al profilo dopo conferma del docente/)).toBeVisible();
}

async function openLibrary(page) {
  await openDrawerItem(page, 'Biblioteca privata');
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
}

async function addSource(page, title, content) {
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(title);
  await page.getByLabel('Contenuto').fill(content);
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function launchComposerFor(page, sourceTitle) {
  const card = page.getByRole('heading', { name: sourceTitle, exact: true }).locator('xpath=ancestor::article');
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  await selectLibraryUseTarget(card, { udaTitle: UDA_TITLE, lessonTopic: LESSON_TOPIC });
  await libraryUseAction(card, 'review').click();

  const composer = page.getByTestId('library-copilot-composer');
  await expect(composer).toBeVisible();
  await expectExistingCopilotBindings(composer, { sourceTitle, contextText: CLASS_NAME });
  return composer;
}

async function submit(composer, message) {
  await composer.getByLabel('Che cosa vuoi farne?').fill(message);
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
}

async function classifyProfessional(composer, state) {
  state.failIntent = true;
  await submit(composer, 'crea una proposta didattica a partire da questo materiale');

  const disclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  await expect(disclosure).toBeVisible();
  state.failIntent = false;
  const classify = disclosure.getByRole('button', {
    name: 'Classifica come materiale professionale',
    exact: true
  });
  if (await classify.isVisible().catch(() => false)) await classify.click();

  await composer.getByLabel('Che cosa vuoi farne?').fill('');
  await expect(disclosure).toHaveCount(0);
}

async function expectReviewSections(panel) {
  for (const label of [
    'Quanto è pertinente',
    'Perché',
    'Allineamento alla programmazione',
    'Cosa manca o va verificato',
    'Possibili riusi',
    'Affidabilità e limiti'
  ]) {
    await expect(panel.getByText(label, { exact: true })).toBeVisible();
  }
}

test('AIC-03 REVIEW v2 is structured and local/read-only — desktop', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  const state = {
    intentRequests: 0,
    proposalRequests: 0,
    reviewEndpointRequests: 0,
    failIntent: false
  };

  await installIntentRoute(page, state);
  await page.route('**/api/copilot/library-proposal', async route => {
    state.proposalRequests += 1;
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.startsWith('/api/copilot/review')) state.reviewEndpointRequests += 1;
  });

  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createSyntheticUdaAndLesson(page);
  await createAuthoritativePlanning(page);
  await openLibrary(page);
  await addSource(
    page,
    SOURCE_TITLE,
    'Il vento aziona una turbina e produce energia elettrica attraverso trasformazioni energetiche.'
  );
  const composer = await launchComposerFor(page, SOURCE_TITLE);
  await classifyProfessional(composer, state);

  state.intentRequests = 0;
  state.proposalRequests = 0;
  state.reviewEndpointRequests = 0;
  await submit(composer, REVIEW_MESSAGE);

  const panel = composer.getByTestId('library-copilot-review-panel');
  await expect(panel).toBeVisible();
  await expectReviewSections(panel);
  await expect(panel.getByText('Pertinenza forte', { exact: true })).toBeVisible();
  await expect(panel.getByText('Allineamento supportato', { exact: true })).toBeVisible();
  await expect(panel.getByText('Affidabilità alta', { exact: true })).toBeVisible();
  await expect(panel.getByText(/Energia/).first()).toBeVisible();
  await expect(panel.getByText('Contenuto leggibile:', { exact: false })).toHaveCount(0);
  expect(state.intentRequests).toBe(1);
  expect(state.proposalRequests).toBe(0);
  expect(state.reviewEndpointRequests).toBe(0);

  await composer.getByLabel('Che cosa vuoi farne?').fill('testo cambiato');
  await expect(panel).toHaveCount(0);

  state.failIntent = true;
  await submit(composer, 'rivedi questa fonte nel contesto della programmazione');
  await expect(composer.getByTestId('library-copilot-review-panel')).toBeVisible();
  state.failIntent = false;

  await page.screenshot({
    path: path.join(evidenceDir, 'aic-03-review-v2-desktop.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'aic-03-review-v2-desktop.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 1280, height: 900 },
      intentRequests: state.intentRequests,
      proposalRequests: state.proposalRequests,
      reviewEndpointRequests: state.reviewEndpointRequests,
      structuredReviewReached: true,
      fallbackReviewed: true,
      pageErrors
    }, null, 2) + '\n'
  );
  expect(pageErrors).toEqual([]);
});

test('AIC-03 REVIEW v2 fails closed for unknown source then shows weak/unverified local analysis on mobile 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  const state = {
    intentRequests: 0,
    proposalRequests: 0,
    reviewEndpointRequests: 0,
    failIntent: false
  };
  await installIntentRoute(page, state);

  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createSyntheticUdaAndLesson(page);
  await openLibrary(page);
  await addSource(page, WEAK_SOURCE_TITLE, 'Argilla, ceramica e cottura in forno.');
  const composer = await launchComposerFor(page, WEAK_SOURCE_TITLE);

  await submit(composer, REVIEW_MESSAGE);
  let panel = composer.getByTestId('library-copilot-review-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByText(/classificata come materiale professionale/i)).toBeVisible();
  await expect(panel.getByText('Argilla, ceramica e cottura in forno.', { exact: true })).toHaveCount(0);

  await classifyProfessional(composer, state);
  await submit(composer, REVIEW_MESSAGE);
  panel = composer.getByTestId('library-copilot-review-panel');
  await expectReviewSections(panel);
  await expect(panel.getByText('Pertinenza debole', { exact: true })).toBeVisible();
  await expect(panel.getByText('Allineamento non verificato', { exact: true })).toBeVisible();
  await expect(panel.getByText('Affidabilità bassa', { exact: true })).toBeVisible();

  const close = composer.getByRole('button', { name: 'Chiudi Copilota', exact: true });
  const closeBox = await close.boundingBox();
  expect(closeBox).not.toBeNull();
  expect(closeBox.width).toBeGreaterThanOrEqual(44);
  expect(closeBox.height).toBeGreaterThanOrEqual(44);

  const overflow = await page.evaluate(() => ({
    width: innerWidth,
    root: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(overflow.root).toBeLessThanOrEqual(overflow.width + 1);
  expect(overflow.body).toBeLessThanOrEqual(overflow.width + 1);

  await page.screenshot({
    path: path.join(evidenceDir, 'aic-03-review-v2-mobile.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'aic-03-review-v2-mobile.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 390, height: 844 },
      overflow,
      unknownSourceFailClosed: true,
      weakUnverifiedReview: true,
      pageErrors
    }, null, 2) + '\n'
  );
  expect(pageErrors).toEqual([]);
  await context.close();
});