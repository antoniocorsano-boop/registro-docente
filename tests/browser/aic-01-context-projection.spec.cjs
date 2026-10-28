const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'aic-01-context-browser';
const CLASS_NAME = '3ª A Sintetica AIC-01';
const STUDENT_NAME = 'Persona Sintetica Segreta AIC';
const GRADE_VALUE = '9.25';
const UDA_TITLE = 'Energia AIC-01';
const SOURCE_TITLE = 'Fonte professionale AIC-01';
const SOURCE_TEXT = 'Materiale professionale sintetico sulla trasformazione dell energia.';
const REAL_PHRASE = 'Preparazione Attività per fare comprendere il funzionamento della centrale elettrica';

test.setTimeout(120000);

function envelope(intent, overrides = {}) {
  return {
    schema: 'registro.agent-intent/v1',
    intent,
    goal: 'obiettivo didattico sintetico AIC-01',
    contextTarget: 'current',
    confidence: 'high',
    needsClarification: false,
    ...overrides
  };
}

function installConsoleGuards(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  return { pageErrors, consoleErrors };
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

async function createSyntheticClassAndStudent(page) {
  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);

  const studentInput = page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)');
  await studentInput.fill(STUDENT_NAME);
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(studentInput).toHaveValue('');
}

async function createSyntheticGrade(page) {
  await page.getByRole('button', { name: 'Valutazioni', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();
  await page.getByPlaceholder('es. 7.5').fill(GRADE_VALUE);
  await page.getByPlaceholder('es. Verifica su Fonti Rinnovabili').fill('Prova sintetica AIC-01');
  await page.getByRole('button', { name: 'Salva Valutazioni di Classe', exact: true }).click();
  await closePersistenceConfirmation(page);
}

async function createSyntheticUda(page) {
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

async function addSyntheticSource(page) {
  await openDrawerItem(page, 'Biblioteca privata');
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(SOURCE_TITLE);
  await page.getByLabel('Contenuto').fill(SOURCE_TEXT);
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();
}

async function openComposerWithSource(page) {
  const composer = page.getByTestId('library-copilot-composer');
  if (!(await composer.isVisible().catch(() => false))) {
    await page.getByTestId('library-copilot-trigger').click();
    await expect(page.getByTestId('copilot-deck')).toBeVisible();
    await page.getByRole('button', { name: 'Parla con il Copilota', exact: true }).click();
  }
  await expect(composer).toBeVisible();
  const sourceSelect = composer.getByLabel('Fonte della Biblioteca');
  if (!(await sourceSelect.isVisible().catch(() => false))) {
    await composer.getByRole('button', { name: 'Lavorare su un materiale', exact: true }).click();
  }
  await expect(sourceSelect).toBeVisible();
  const selected = await sourceSelect.locator('option:checked').textContent();
  if (selected !== SOURCE_TITLE) {
    await sourceSelect.selectOption({ label: SOURCE_TITLE });
  }
  await expect(sourceSelect.locator('option:checked')).toHaveText(SOURCE_TITLE);
  return composer;
}

async function closeComposer(page) {
  const composer = page.getByTestId('library-copilot-composer');
  if (await composer.isVisible().catch(() => false)) {
    await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
    await expect(composer).toBeHidden();
  }
}

async function submitIntent(page, message, intentRequests) {
  const composer = await openComposerWithSource(page);
  const previousCount = intentRequests.length;
  await composer.getByLabel('Che cosa vuoi farne?').fill(message);
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  await expect.poll(() => intentRequests.length).toBe(previousCount + 1);
  return { composer, body: intentRequests.at(-1) };
}

function assertMinimizedRequest(body, expectedSurface) {
  expect(body.schema).toBe('registro.agent-routing-request/v1');
  expect(body.explicitTeacherSubmission).toBe(true);
  expect(body.context.surface).toBe(expectedSurface);
  expect(Object.keys(body.context).sort()).toEqual([
    'hasCurrentClass',
    'hasCurrentUda',
    'hasSelectedSource',
    'surface'
  ]);

  const serialized = JSON.stringify(body);
  for (const forbidden of [
    STUDENT_NAME,
    GRADE_VALUE,
    'Prova sintetica AIC-01',
    SOURCE_TITLE,
    SOURCE_TEXT,
    'students',
    'studentId',
    'grades',
    'behaviors',
    'submissions',
    'answers',
    'planningProfileId',
    'assessmentId',
    'udaContent',
    'payload',
    'extractedText'
  ]) {
    expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }
}

async function installIntentRoutes(page, intentRequests, options = {}) {
  const { delayedFirst = false } = options;
  let releaseFirstResponse = null;
  let firstRequestSeen = null;
  let firstResolve = null;
  let releaseResolve = null;
  let callCount = 0;

  if (delayedFirst) {
    firstRequestSeen = new Promise(resolve => { firstResolve = resolve; });
    releaseFirstResponse = new Promise(resolve => { releaseResolve = resolve; });
  }

  await page.route('**/api/copilot/intent/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'aic-01-fixture' })
    });
  });

  await page.route('**/api/copilot/intent', async route => {
    callCount += 1;
    const body = route.request().postDataJSON();
    intentRequests.push(body);
    if (delayedFirst && callCount === 1) {
      firstResolve();
      await releaseFirstResponse;
    }

    const response = body.message === REAL_PHRASE
      ? envelope('PREPARE', {
          goal: 'preparare una attività sulla centrale elettrica',
          requestedArtifact: 'attività didattica',
          classReference: 'current',
          udaReference: 'current',
          sourceReference: 'current'
        })
      : envelope('UNSUPPORTED', { goal: 'richiesta di verifica contesto AIC-01' });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ intent: response })
    });
  });

  await page.route('**/api/copilot/library-proposal/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'aic-01-fixture' })
    });
  });

  return {
    firstRequestSeen,
    releaseFirst: () => releaseResolve?.()
  };
}

async function bootstrapProfessionalFixture(page) {
  await setupFreshVault(page);
  await createSyntheticClassAndStudent(page);
  await createSyntheticGrade(page);
  await createSyntheticUda(page);
  await addSyntheticSource(page);
}

test('AIC-01 routes cross-surface teacher context without leaking individual student data — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const guards = installConsoleGuards(page);
  const intentRequests = [];
  const proposalRequests = [];
  await installIntentRoutes(page, intentRequests);
  await page.route('**/api/copilot/library-proposal', async route => {
    proposalRequests.push(route.request().postDataJSON());
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'not expected before consent' }) });
  });

  await bootstrapProfessionalFixture(page);

  await openDrawerItem(page, 'Programmazione didattica');
  let submitted = await submitIntent(page, 'Controlla il contesto di programmazione', intentRequests);
  assertMinimizedRequest(submitted.body, 'planning');
  await expect(submitted.composer.getByTestId('library-copilot-agent-guidance')).toContainText('questa capacità non è ancora disponibile');
  await closeComposer(page);

  await openDrawerItem(page, 'Verifiche online');
  submitted = await submitIntent(page, 'Controlla il contesto delle verifiche online', intentRequests);
  assertMinimizedRequest(submitted.body, 'other-teacher-surface');
  await closeComposer(page);

  await page.getByRole('button', { name: 'Valutazioni', exact: true }).click();
  submitted = await submitIntent(page, 'Controlla il contesto delle valutazioni', intentRequests);
  assertMinimizedRequest(submitted.body, 'other-teacher-surface');
  await closeComposer(page);

  await openDrawerItem(page, 'UDA');
  submitted = await submitIntent(page, 'Controlla questa superficie UDA senza selezionare una UDA esplicita', intentRequests);
  assertMinimizedRequest(submitted.body, 'other-teacher-surface');
  await closeComposer(page);

  await openDrawerItem(page, 'Biblioteca privata');
  submitted = await submitIntent(page, REAL_PHRASE, intentRequests);
  assertMinimizedRequest(submitted.body, 'library');
  await expect(submitted.composer.getByTestId('library-copilot-prepare-disclosure')).toBeVisible();
  expect(proposalRequests).toHaveLength(0);

  await page.screenshot({ path: path.join(evidenceDir, 'aic-01-context-desktop.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'aic-01-context-desktop.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 1280, height: 900 },
    surfaces: intentRequests.map(request => request.context.surface),
    requestCount: intentRequests.length,
    forbiddenStudentName: STUDENT_NAME,
    forbiddenGrade: GRADE_VALUE,
    proposalRequestCountBeforeConsent: proposalRequests.length,
    ...guards
  }, null, 2) + '\n');

  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
});

test('AIC-01 discards a delayed result after navigation changes the context — mobile 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const guards = installConsoleGuards(page);
  const intentRequests = [];
  const control = await installIntentRoutes(page, intentRequests, { delayedFirst: true });

  await setupFreshVault(page);
  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);
  await createSyntheticUda(page);
  await addSyntheticSource(page);

  const composer = await openComposerWithSource(page);
  await composer.getByLabel('Che cosa vuoi farne?').fill(REAL_PHRASE);
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  await control.firstRequestSeen;
  expect(intentRequests).toHaveLength(1);
  expect(intentRequests[0].context.surface).toBe('library');

  await closeComposer(page);
  await openDrawerItem(page, 'Programmazione didattica');
  const planningComposer = await openComposerWithSource(page);
  control.releaseFirst();
  await page.waitForTimeout(250);
  await expect(planningComposer.getByTestId('library-copilot-prepare-disclosure')).toHaveCount(0);

  const second = await submitIntent(page, 'Controlla il nuovo contesto dopo la navigazione', intentRequests);
  assertMinimizedRequest(second.body, 'planning');
  await expect(second.composer.getByTestId('library-copilot-prepare-disclosure')).toHaveCount(0);

  const composerBox = await second.composer.boundingBox();
  expect(composerBox).not.toBeNull();
  expect(composerBox.x).toBeGreaterThanOrEqual(0);
  expect(composerBox.x + composerBox.width).toBeLessThanOrEqual(391);

  await page.screenshot({ path: path.join(evidenceDir, 'aic-01-context-mobile.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'aic-01-context-mobile.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 390, height: 844 },
    firstSurface: intentRequests[0]?.context?.surface ?? null,
    secondSurface: intentRequests[1]?.context?.surface ?? null,
    stalePrepareVisible: false,
    ...guards
  }, null, 2) + '\n');

  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
  await context.close();
});
