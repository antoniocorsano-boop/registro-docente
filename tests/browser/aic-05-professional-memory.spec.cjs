const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'aic-05-professional-memory-browser';
const CLASS_NAME = 'Classe Sintetica AIC-05';
const UDA_TITLE = 'UDA Sintetica AIC-05';
const SOURCE_A = 'Fonte professionale AIC-05 A';
const SOURCE_B = 'Fonte professionale AIC-05 B';
const MANUAL_MEMORY = 'Riusa la fonte AIC-05 A quando il contesto richiede una lettura tecnica guidata.';
const EDITED_MEMORY = 'Riusa la fonte AIC-05 A con una lettura tecnica guidata e una breve restituzione grafica.';
const STUDENT_NAME = 'Studente Sintetico Riservato AIC-05';
const STUDENT_SOURCE = 'Nota studente riservata AIC-05';
const STUDENT_SOURCE_TEXT = `Nota sintetica relativa a ${STUDENT_NAME}, valutazione 7.25. Materiale non classificato.`;

const proposalContent = {
  title: 'Proposta sintetica AIC-05',
  objective: 'Usare una fonte professionale nel contesto didattico corrente.',
  teacherSetup: 'Presentare la fonte e richiamare il lessico essenziale.',
  studentTask: 'Analizzare il materiale e motivare una scelta.',
  steps: ['Osserva', 'Analizza', 'Motiva'],
  questions: ['Quale elemento è più rilevante?', 'Come lo useresti?'],
  adaptationHint: 'Usare una tabella guida essenziale.'
};

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(150000);

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

async function createSyntheticStudentAndGrade(page) {
  const studentInput = page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)');
  await studentInput.fill(STUDENT_NAME);
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(studentInput).toHaveValue('');
  await page.getByRole('button', { name: 'Valutazioni', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();
  await page.getByPlaceholder('es. 7.5').fill('7.25');
  await page.getByPlaceholder('es. Verifica su Fonti Rinnovabili').fill('Valutazione sintetica riservata AIC-05');
  await page.getByRole('button', { name: 'Salva Valutazioni di Classe', exact: true }).click();
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

async function addSyntheticSource(page, title, text = `Fonte sintetica professionale per ${title}.`) {
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

async function openComposer(page) {
  const composer = page.getByTestId('library-copilot-composer');
  if (!(await composer.isVisible().catch(() => false))) {
    await page.getByTestId('library-copilot-trigger').click();
  }
  await expect(composer).toBeVisible();
  return composer;
}

async function closeComposer(page) {
  const composer = page.getByTestId('library-copilot-composer');
  if (await composer.isVisible().catch(() => false)) {
    await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
    await expect(composer).toBeHidden();
  }
}

async function selectComposerSource(composer, title) {
  const sourceSelect = composer.getByLabel('Fonte della Biblioteca');
  await sourceSelect.selectOption({ label: title });
  await expect(sourceSelect.locator('option:checked')).toHaveText(title);
}

async function openPrepareFromIntent(composer) {
  await composer.getByLabel('Che cosa vuoi farne?').fill('crea una proposta didattica a partire da questo materiale');
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  const disclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  await expect(disclosure).toBeVisible();
  return disclosure;
}

async function classifySourceProfessional(page, title) {
  const composer = await openComposer(page);
  await selectComposerSource(composer, title);
  const disclosure = await openPrepareFromIntent(composer);
  const classify = disclosure.getByRole('button', { name: 'Classifica come materiale professionale', exact: true });
  if (await classify.isVisible().catch(() => false)) {
    await classify.click();
  }
  await expect(composer.getByTestId('copilot-memory-remember-this')).toHaveCount(1);
  await closeComposer(page);
}

async function openMemoryPanel(composer) {
  const panel = composer.getByTestId('copilot-memory-panel');
  await expect(panel).toBeVisible();
  const isOpen = await panel.evaluate(element => element.open === true);
  if (!isOpen) await composer.getByTestId('copilot-memory-trigger').click();
  await expect.poll(() => panel.evaluate(element => element.open === true)).toBe(true);
  return panel;
}

async function rememberCurrentSource(composer, summary = MANUAL_MEMORY) {
  const panel = await openMemoryPanel(composer);
  await panel.getByTestId('copilot-memory-remember-this').click();
  const text = panel.getByLabel('Testo da ricordare');
  await text.fill(summary);
  await panel.getByTestId('copilot-memory-confirm').click();
  await expect(panel.getByRole('status')).toContainText('Ricordo salvato nella memoria professionale.');
  return panel;
}

async function linkSourceToUda(page, title) {
  await openLibrary(page);
  const card = await sourceCard(page, title);
  await card.getByText('Gestisci', { exact: true }).click();
  await card.getByLabel('Collega a UDA').selectOption({ label: UDA_TITLE });
  await card.getByRole('button', { name: 'Collega', exact: true }).click();
  await expect(card.getByText('Collegamenti', { exact: true })).toBeVisible();
  await expect(card.getByText(UDA_TITLE, { exact: true })).toBeVisible();
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
      model: 'aic-05-browser-fixture',
      generatedAt: '2026-10-27T10:00:00.000Z'
    }
  };
}

async function installDelayedProposalRoutes(page, proposalBodies) {
  let releaseResolve;
  let requestSeenResolve;
  const release = new Promise(resolve => { releaseResolve = resolve; });
  const requestSeen = new Promise(resolve => { requestSeenResolve = resolve; });

  await page.route('**/api/copilot/library-proposal/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'aic-05-browser-fixture' })
    });
  });

  await page.route('**/api/copilot/library-proposal', async route => {
    const body = route.request().postDataJSON();
    proposalBodies.push(body);
    requestSeenResolve();
    await release;
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          proposal: proposalForRequest(body),
          receipt: {
            requestId: `aic-05-browser-${proposalBodies.length}`,
            provider: 'browser-fixture',
            model: 'aic-05-browser-fixture',
            durationMs: 10,
            promptTokens: 100,
            outputTokens: 50,
            totalTokens: 150,
            attemptCount: 1
          }
        })
      });
    } catch {
      // A context/source change may abort the request before the delayed fixture is released.
    }
  });

  return {
    requestSeen,
    release: () => releaseResolve()
  };
}

function envelope(intent, overrides = {}) {
  return {
    schema: 'registro.agent-intent/v1',
    intent,
    goal: 'rivedere materiale sintetico in sicurezza',
    contextTarget: 'current',
    confidence: 'high',
    needsClarification: false,
    ...overrides
  };
}

async function installIntentCaptureRoutes(page, intentBodies) {
  await page.route('**/api/copilot/intent/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'aic-05-intent-fixture' })
    });
  });
  await page.route('**/api/copilot/intent', async route => {
    const body = route.request().postDataJSON();
    intentBodies.push(body);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ intent: envelope('REVIEW', { sourceReference: 'current' }) })
    });
  });
}

async function bootstrapProfessionalFixture(page, titles = [SOURCE_A]) {
  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createActiveSyntheticUda(page);
  await openLibrary(page);
  for (const title of titles) await addSyntheticSource(page, title);
  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
}

test('AIC-05 manual professional memory lifecycle survives reload and never mutates canonical Library/UDA data — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const guards = installConsoleGuards(page);
  await bootstrapProfessionalFixture(page, [SOURCE_A]);
  await classifySourceProfessional(page, SOURCE_A);

  let composer = await openComposer(page);
  await selectComposerSource(composer, SOURCE_A);
  let panel = await rememberCurrentSource(composer);
  await expect(panel.getByText(MANUAL_MEMORY, { exact: true })).toBeVisible();
  await expect(panel.getByText('Ricordo confermato dal docente', { exact: true })).toBeVisible();

  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  composer = await openComposer(page);
  await selectComposerSource(composer, SOURCE_A);
  panel = await openMemoryPanel(composer);
  let entry = panel.locator('[data-testid^="copilot-memory-entry-"]').filter({ hasText: MANUAL_MEMORY });
  await expect(entry).toHaveCount(1);
  await expect(entry.getByText('Ricordo confermato dal docente', { exact: true })).toBeVisible();

  await entry.getByRole('button', { name: 'Modifica', exact: true }).click();
  await entry.locator('textarea').fill(EDITED_MEMORY);
  await entry.getByRole('button', { name: 'Salva modifica', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Ricordo aggiornato.');

  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  composer = await openComposer(page);
  await selectComposerSource(composer, SOURCE_A);
  panel = await openMemoryPanel(composer);
  entry = panel.locator('[data-testid^="copilot-memory-entry-"]').filter({ hasText: EDITED_MEMORY });
  await expect(entry).toHaveCount(1);
  await expect(entry.getByText('Ricordo confermato dal docente', { exact: true })).toBeVisible();

  page.once('dialog', dialog => dialog.accept());
  await entry.getByRole('button', { name: 'Rimuovi', exact: true }).click();
  await expect(panel.getByRole('status')).toContainText('Ricordo rimosso dalla memoria professionale.');

  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  composer = await openComposer(page);
  await selectComposerSource(composer, SOURCE_A);
  panel = await openMemoryPanel(composer);
  await expect(panel.getByText('Nessun ricordo professionale salvato.', { exact: true })).toBeVisible();
  await closeComposer(page);

  await openLibrary(page);
  await expect(page.getByRole('heading', { name: SOURCE_A, exact: true })).toBeVisible();
  await openDrawerItem(page, 'UDA');
  await page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'UDA', exact: true }).click();
  await expect(page.getByText(UDA_TITLE, { exact: true }).first()).toBeVisible();

  await page.screenshot({ path: path.join(evidenceDir, 'aic-05-memory-manual-desktop.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'aic-05-memory-manual-desktop.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 1280, height: 900 },
    checks: [
      'explicit-confirm-before-write',
      'reload-preserves-memory',
      'provenance-visible',
      'edit-survives-reload',
      'remove-survives-reload',
      'canonical-library-unchanged',
      'canonical-uda-unchanged'
    ],
    ...guards
  }, null, 2) + '\n');

  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
});

test('AIC-05 automatic material-reuse category is durable, revocable and does not delete prior memory — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const guards = installConsoleGuards(page);
  await bootstrapProfessionalFixture(page, [SOURCE_A, SOURCE_B]);
  await classifySourceProfessional(page, SOURCE_A);
  await classifySourceProfessional(page, SOURCE_B);

  let composer = await openComposer(page);
  await selectComposerSource(composer, SOURCE_A);
  let panel = await openMemoryPanel(composer);
  let category = panel.getByTestId('copilot-memory-category-material-reuse');
  let toggle = category.getByRole('checkbox');
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(panel.getByRole('status')).toContainText('Memoria automatica attivata per questa categoria.');

  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  composer = await openComposer(page);
  await selectComposerSource(composer, SOURCE_A);
  panel = await openMemoryPanel(composer);
  category = panel.getByTestId('copilot-memory-category-material-reuse');
  toggle = category.getByRole('checkbox');
  await expect(toggle).toBeChecked();
  await closeComposer(page);

  await linkSourceToUda(page, SOURCE_A);
  composer = await openComposer(page);
  await selectComposerSource(composer, SOURCE_A);
  panel = await openMemoryPanel(composer);
  const entries = panel.locator('[data-testid^="copilot-memory-entry-"]');
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Fonte professionale collegata al contesto didattico corrente.');
  await expect(entries.first()).toContainText('Sintesi da attività professionali');

  category = panel.getByTestId('copilot-memory-category-material-reuse');
  toggle = category.getByRole('checkbox');
  await toggle.uncheck();
  await expect(panel.getByRole('status')).toContainText('Memoria automatica disattivata per questa categoria.');

  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  composer = await openComposer(page);
  await selectComposerSource(composer, SOURCE_A);
  panel = await openMemoryPanel(composer);
  category = panel.getByTestId('copilot-memory-category-material-reuse');
  await expect(category.getByRole('checkbox')).not.toBeChecked();
  await expect(panel.locator('[data-testid^="copilot-memory-entry-"]')).toHaveCount(1);
  await closeComposer(page);

  await linkSourceToUda(page, SOURCE_B);
  composer = await openComposer(page);
  await selectComposerSource(composer, SOURCE_B);
  panel = await openMemoryPanel(composer);
  await expect(panel.locator('[data-testid^="copilot-memory-entry-"]')).toHaveCount(1);
  await expect(panel.getByText('1 ricordo conservato', { exact: true })).toBeVisible();

  await page.screenshot({ path: path.join(evidenceDir, 'aic-05-memory-auto-category-desktop.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'aic-05-memory-auto-category-desktop.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 1280, height: 900 },
    checks: [
      'auto-category-default-off',
      'enable-survives-reload',
      'derived-memory-after-canonical-link',
      'disable-survives-reload',
      'old-memory-preserved',
      'disabled-category-blocks-next-auto-capture'
    ],
    ...guards
  }, null, 2) + '\n');

  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
});

test('AIC-05 fails closed for ambiguous student-bearing material and does not leak evaluation data into routing — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const guards = installConsoleGuards(page);
  const intentBodies = [];
  await installIntentCaptureRoutes(page, intentBodies);

  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createSyntheticStudentAndGrade(page);
  await openLibrary(page);
  await addSyntheticSource(page, STUDENT_SOURCE, STUDENT_SOURCE_TEXT);
  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  await page.getByRole('button', { name: 'Valutazioni', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();

  let composer = await openComposer(page);
  await selectComposerSource(composer, STUDENT_SOURCE);
  const panel = await openMemoryPanel(composer);
  await expect(panel.getByTestId('copilot-memory-remember-this')).toHaveCount(0);
  await expect(panel.getByText('Nessun ricordo professionale salvato.', { exact: true })).toBeVisible();

  await composer.getByLabel('Che cosa vuoi farne?').fill('rivedi questo materiale nel contesto corrente');
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  await expect.poll(() => intentBodies.length).toBe(1);
  const serialized = JSON.stringify(intentBodies[0]).toLowerCase();
  for (const forbidden of [
    STUDENT_NAME,
    '7.25',
    'Valutazione sintetica riservata AIC-05',
    STUDENT_SOURCE_TEXT,
    'students',
    'grades',
    'behaviors',
    'submissions',
    'answers'
  ]) {
    expect(serialized).not.toContain(forbidden.toLowerCase());
  }

  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  composer = await openComposer(page);
  await selectComposerSource(composer, STUDENT_SOURCE);
  const reloadedPanel = await openMemoryPanel(composer);
  await expect(reloadedPanel.getByText('Nessun ricordo professionale salvato.', { exact: true })).toBeVisible();
  await expect(reloadedPanel.getByTestId('copilot-memory-remember-this')).toHaveCount(0);

  await page.screenshot({ path: path.join(evidenceDir, 'aic-05-memory-privacy-desktop.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'aic-05-memory-privacy-desktop.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 1280, height: 900 },
    intentRequestCount: intentBodies.length,
    checks: [
      'ambiguous-source-has-no-remember-path',
      'evaluation-context-not-copied-to-routing',
      'student-bearing-source-content-not-copied-to-routing',
      'no-memory-write-after-reload'
    ],
    ...guards
  }, null, 2) + '\n');

  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
});

test('AIC-05 memory controls stay touch-safe on 390x844 and a source change rejects a delayed memory-augmented proposal', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const guards = installConsoleGuards(page);
  const proposalBodies = [];
  const delayed = await installDelayedProposalRoutes(page, proposalBodies);

  await bootstrapProfessionalFixture(page, [SOURCE_A, SOURCE_B]);
  await classifySourceProfessional(page, SOURCE_A);
  await classifySourceProfessional(page, SOURCE_B);

  const composer = await openComposer(page);
  await selectComposerSource(composer, SOURCE_A);
  let panel = await openMemoryPanel(composer);
  await assertAtLeast44(composer.getByTestId('copilot-memory-trigger'), 'memory disclosure trigger');
  await assertAtLeast44(panel.getByTestId('copilot-memory-remember-this'), 'remember this');
  await panel.getByTestId('copilot-memory-remember-this').click();
  await assertAtLeast44(panel.getByLabel('Categoria'), 'memory category select');
  await assertAtLeast44(panel.getByTestId('copilot-memory-confirm'), 'memory confirm');
  await panel.getByLabel('Testo da ricordare').fill(MANUAL_MEMORY);
  await panel.getByTestId('copilot-memory-confirm').click();
  await expect(panel.getByRole('status')).toContainText('Ricordo salvato nella memoria professionale.');

  const entry = panel.locator('[data-testid^="copilot-memory-entry-"]').filter({ hasText: MANUAL_MEMORY });
  await assertAtLeast44(entry.getByRole('button', { name: 'Modifica', exact: true }), 'memory edit');
  await assertAtLeast44(entry.getByRole('button', { name: 'Rimuovi', exact: true }), 'memory remove');
  await assertAtLeast44(panel.getByTestId('copilot-memory-category-material-reuse').locator('label'), 'memory category toggle target');

  const composerBox = await composer.boundingBox();
  expect(composerBox).not.toBeNull();
  expect(composerBox.x).toBeGreaterThanOrEqual(0);
  expect(composerBox.x + composerBox.width).toBeLessThanOrEqual(391);
  expect(await composer.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

  await composer.getByTestId('copilot-memory-trigger').click();
  await expect.poll(() => panel.evaluate(element => element.open === true)).toBe(false);
  await composer.getByTestId('copilot-memory-trigger').click();
  await expect.poll(() => panel.evaluate(element => element.open === true)).toBe(true);

  const disclosure = await openPrepareFromIntent(composer);
  await disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true }).click();
  const prepare = disclosure.getByRole('button', { name: 'Prepara attività', exact: true });
  await expect(prepare).toBeVisible();
  await prepare.click();
  await delayed.requestSeen;
  expect(proposalBodies).toHaveLength(1);
  expect(proposalBodies[0].professionalMemory.items).toContainEqual({
    category: 'material-reuse',
    summary: MANUAL_MEMORY
  });
  const serializedProposal = JSON.stringify(proposalBodies[0].professionalMemory);
  expect(serializedProposal).not.toContain('sourceEventIds');
  expect(serializedProposal).not.toContain('provenance');
  expect(serializedProposal).not.toContain('events');

  await selectComposerSource(composer, SOURCE_B);
  await delayed.release();
  await page.waitForTimeout(300);
  await expect(composer.getByRole('region', { name: 'Proposta didattica' })).toHaveCount(0);

  await page.screenshot({ path: path.join(evidenceDir, 'aic-05-memory-mobile.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'aic-05-memory-mobile.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 390, height: 844 },
    proposalRequestCount: proposalBodies.length,
    checks: [
      'progressive-disclosure-closable',
      'touch-targets-at-least-44',
      'no-horizontal-overflow',
      'remote-memory-projection-minimized',
      'source-change-rejects-delayed-result'
    ],
    ...guards
  }, null, 2) + '\n');

  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
  await context.close();
});
