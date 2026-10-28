const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'aic-04-cross-surface-browser';
const CLASS_NAME = '3ª A Sintetica AIC-04';
const STUDENT_NAME = 'Persona Sintetica Segreta AIC-04';
const GRADE_VALUE = '8.75';
const UDA_TITLE = 'Energia AIC-04';
const SOURCE_TITLE = 'Fonte professionale AIC-04';
const SOURCE_TEXT = 'Materiale professionale sintetico sulla trasformazione dell energia AIC-04.';
const SOURCELESS_GOAL = 'Prepara una attività usando il contesto corrente';

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(120000);

function envelope(intent, overrides = {}) {
  return {
    schema: 'registro.agent-intent/v1',
    intent,
    goal: 'obiettivo didattico sintetico AIC-04',
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
  const item = page.locator('aside').getByRole('button', { name: label, exact: true });
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
  await page.getByPlaceholder('es. Verifica su Fonti Rinnovabili').fill('Prova sintetica AIC-04');
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

async function returnHome(page) {
  await openDrawerItem(page, 'Classi');
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function openClassDashboard(page) {
  await returnHome(page);
  const main = page.locator('main');
  const openButton = main.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true });
  if (await openButton.isVisible().catch(() => false)) {
    await openButton.click();
  } else {
    await main.getByText(CLASS_NAME, { exact: true }).last().click();
  }
  await expect(page.getByRole('heading', { name: `Panoramica Sezione: ${CLASS_NAME}` })).toBeVisible();
}

async function openComposerWithoutSource(page) {
  const composer = page.getByTestId('library-copilot-composer');
  if (!(await composer.isVisible().catch(() => false))) {
    await page.getByTestId('library-copilot-trigger').click();
    await expect(page.getByTestId('copilot-deck')).toBeVisible();
    await page.getByRole('button', { name: 'Parla con il Copilota', exact: true }).click();
  }
  await expect(composer).toBeVisible();
  const sourceSelect = composer.getByLabel('Fonte della Biblioteca');
  await sourceSelect.selectOption('');
  await expect(sourceSelect).toHaveValue('');
  return composer;
}

async function closeComposer(page) {
  const composer = page.getByTestId('library-copilot-composer');
  if (await composer.isVisible().catch(() => false)) {
    await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
    await expect(composer).toBeHidden();
  }
}

function assertMinimizedSourceLessRequest(body, expectedSurface) {
  expect(body.schema).toBe('registro.agent-routing-request/v1');
  expect(body.explicitTeacherSubmission).toBe(true);
  expect(body.context.surface).toBe(expectedSurface);
  expect(body.context.hasSelectedSource).toBe(false);
  expect(Object.keys(body.context).sort()).toEqual([
    'hasCurrentClass',
    'hasCurrentUda',
    'hasSelectedSource',
    'surface'
  ]);

  const serialized = JSON.stringify(body).toLowerCase();
  for (const forbidden of [
    STUDENT_NAME,
    GRADE_VALUE,
    'Prova sintetica AIC-04',
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
    expect(serialized).not.toContain(forbidden.toLowerCase());
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
      body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'aic-04-fixture' })
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

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        intent: envelope('PREPARE', {
          goal: 'preparare una attività usando il contesto corrente',
          requestedArtifact: 'attività didattica',
          classReference: 'current',
          udaReference: 'current',
          sourceReference: 'current'
        })
      })
    });
  });

  await page.route('**/api/copilot/library-proposal/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'aic-04-fixture' })
    });
  });

  return {
    firstRequestSeen,
    releaseFirst: () => releaseResolve?.()
  };
}

async function submitSourceLessGoal(page, intentRequests, expectedSurface, message = SOURCELESS_GOAL) {
  const composer = await openComposerWithoutSource(page);
  const previousCount = intentRequests.length;
  await composer.getByLabel('Che cosa vuoi farne?').fill(message);
  const submit = composer.getByRole('button', { name: 'Mostra le possibilità', exact: true });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect.poll(() => intentRequests.length).toBe(previousCount + 1);
  const body = intentRequests.at(-1);
  assertMinimizedSourceLessRequest(body, expectedSurface);
  await expect(composer.getByTestId('library-copilot-agent-guidance')).toContainText('seleziona o aggiungi una fonte');
  await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toHaveCount(0);
  return { composer, body };
}

async function bootstrapProfessionalFixture(page) {
  await setupFreshVault(page);
  await createSyntheticClassAndStudent(page);
  await createSyntheticGrade(page);
  await createSyntheticUda(page);
  await addSyntheticSource(page);
}

test('AIC-04 starts from the current teacher surface without a source and asks for one only when required — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const guards = installConsoleGuards(page);
  const intentRequests = [];
  await installIntentRoutes(page, intentRequests);
  await bootstrapProfessionalFixture(page);

  await openClassDashboard(page);
  const first = await submitSourceLessGoal(page, intentRequests, 'class-dashboard');
  expect(first.body.context.hasCurrentClass).toBe(true);

  const beforeSelection = intentRequests.length;
  await first.composer.getByLabel('Fonte della Biblioteca').selectOption({ label: SOURCE_TITLE });
  await page.waitForTimeout(250);
  expect(intentRequests).toHaveLength(beforeSelection);
  await expect(first.composer.getByTestId('library-copilot-agent-guidance')).toHaveCount(0);

  await first.composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  await expect.poll(() => intentRequests.length).toBe(beforeSelection + 1);
  expect(intentRequests.at(-1).context.hasSelectedSource).toBe(true);
  await expect(first.composer.getByTestId('library-copilot-prepare-disclosure')).toBeVisible();
  await closeComposer(page);

  await openDrawerItem(page, 'Programmazione didattica');
  const planning = await submitSourceLessGoal(page, intentRequests, 'planning', 'Prepara dal contesto di programmazione');
  await closeComposer(page);

  await openDrawerItem(page, 'Verifiche online');
  const tests = await submitSourceLessGoal(page, intentRequests, 'other-teacher-surface', 'Prepara dal contesto delle verifiche online');
  await closeComposer(page);

  await page.getByRole('button', { name: 'Valutazioni', exact: true }).click();
  const evaluations = await submitSourceLessGoal(page, intentRequests, 'other-teacher-surface', 'Prepara dal contesto delle valutazioni');

  const composerBox = await evaluations.composer.boundingBox();
  expect(composerBox).not.toBeNull();
  expect(composerBox.x).toBeGreaterThanOrEqual(0);
  expect(composerBox.x + composerBox.width).toBeLessThanOrEqual(1281);

  await page.screenshot({ path: path.join(evidenceDir, 'aic-04-cross-surface-desktop.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'aic-04-cross-surface-desktop.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 1280, height: 900 },
    surfaces: intentRequests.map(request => request.context.surface),
    selectedSourceFlags: intentRequests.map(request => request.context.hasSelectedSource),
    requestCountAfterSourceSelection: beforeSelection,
    requestCountAfterExplicitResubmit: beforeSelection + 1,
    planningHasSelectedSource: planning.body.context.hasSelectedSource,
    onlineTestsHasSelectedSource: tests.body.context.hasSelectedSource,
    evaluationsHasSelectedSource: evaluations.body.context.hasSelectedSource,
    ...guards
  }, null, 2) + '\n');

  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
});

test('AIC-04 discards delayed source-less guidance after the teacher changes surface — mobile 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const guards = installConsoleGuards(page);
  const intentRequests = [];
  const control = await installIntentRoutes(page, intentRequests, { delayedFirst: true });

  await setupFreshVault(page);
  await createSyntheticClassAndStudent(page);
  await createSyntheticUda(page);
  await openDrawerItem(page, 'Programmazione didattica');

  const composer = await openComposerWithoutSource(page);
  await composer.getByLabel('Che cosa vuoi farne?').fill(SOURCELESS_GOAL);
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  await control.firstRequestSeen;
  expect(intentRequests).toHaveLength(1);
  assertMinimizedSourceLessRequest(intentRequests[0], 'planning');

  await closeComposer(page);
  await openDrawerItem(page, 'Verifiche online');
  const nextComposer = await openComposerWithoutSource(page);
  control.releaseFirst();
  await expect.poll(async () => nextComposer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).isEnabled()).toBe(true);
  await expect(nextComposer.getByTestId('library-copilot-agent-guidance')).toHaveCount(0);
  await expect(nextComposer.getByTestId('library-copilot-prepare-disclosure')).toHaveCount(0);

  const second = await submitSourceLessGoal(page, intentRequests, 'other-teacher-surface', 'Prepara nel nuovo contesto delle verifiche');
  expect(intentRequests).toHaveLength(2);

  const composerBox = await second.composer.boundingBox();
  expect(composerBox).not.toBeNull();
  expect(composerBox.x).toBeGreaterThanOrEqual(0);
  expect(composerBox.x + composerBox.width).toBeLessThanOrEqual(391);

  await page.screenshot({ path: path.join(evidenceDir, 'aic-04-cross-surface-mobile.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'aic-04-cross-surface-mobile.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 390, height: 844 },
    firstSurface: intentRequests[0]?.context?.surface ?? null,
    secondSurface: intentRequests[1]?.context?.surface ?? null,
    firstHasSelectedSource: intentRequests[0]?.context?.hasSelectedSource ?? null,
    secondHasSelectedSource: intentRequests[1]?.context?.hasSelectedSource ?? null,
    staleGuidanceVisible: false,
    ...guards
  }, null, 2) + '\n');

  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
  await context.close();
});
