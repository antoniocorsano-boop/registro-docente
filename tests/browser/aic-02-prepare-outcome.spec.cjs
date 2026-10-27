const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'aic-02-browser-qualification';
const CLASS_NAME = '3ª A Sintetica AIC-02';
const UDA_TITLE = 'Energia e centrale elettrica AIC-02';
const SOURCE_TITLE = 'Fonte centrale elettrica AIC-02';
const PROPOSAL_TITLE = 'Attività sulla centrale elettrica AIC-02';
const LESSON_TOPIC = 'Trasformazioni energetiche esistenti AIC-02';
const REAL_PHRASE = 'Prepara una attività per comprendere il funzionamento della centrale elettrica';

const proposalContent = {
  title: PROPOSAL_TITLE,
  objective: 'Comprendere la catena delle trasformazioni energetiche.',
  teacherSetup: 'Predisporre uno schema sintetico della centrale.',
  studentTask: 'Ricostruire il percorso dell’energia e motivare i passaggi.',
  steps: ['Osserva lo schema', 'Ordina le trasformazioni', 'Confronta le conclusioni'],
  questions: ['Dove avviene la trasformazione principale?'],
  adaptationHint: 'Usare parole chiave e uno schema guidato.'
};

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(120000);

function intentEnvelope() {
  return {
    schema: 'registro.agent-intent/v1',
    intent: 'PREPARE',
    goal: 'comprendere il funzionamento della centrale elettrica',
    contextTarget: 'current',
    confidence: 'high',
    needsClarification: false,
    requestedArtifact: 'attività didattica',
    classReference: 'current',
    udaReference: 'current',
    sourceReference: 'current'
  };
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
      generatedAt: '2026-10-27T03:00:00.000Z'
    }
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

async function installRoutes(page, proposalBodies = []) {
  await page.route('**/api/copilot/intent/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'browser-fixture-v1' })
    });
  });
  await page.route('**/api/copilot/intent', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ intent: intentEnvelope() })
    });
  });
  await page.route('**/api/copilot/library-proposal/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'browser-fixture-v1' })
    });
  });
  await page.route('**/api/copilot/library-proposal', async route => {
    const body = route.request().postDataJSON();
    proposalBodies.push(body);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/studentId|students|roster|grades|behavior/i);
    expect(body.classification).toBe('TEACHER_PROFESSIONAL');
    expect(body.explicitTeacherOptIn).toBe(true);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        proposal: proposalForRequest(body),
        receipt: {
          requestId: `aic-02-${proposalBodies.length}`,
          provider: 'browser-fixture',
          model: 'browser-fixture-v1',
          durationMs: 10,
          promptTokens: 100,
          outputTokens: 60,
          totalTokens: 160,
          attemptCount: 1
        }
      })
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

async function createSyntheticUda(page) {
  await openDrawerItem(page, 'UDA');
  const udaToggle = page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'UDA', exact: true });
  if (await udaToggle.isVisible().catch(() => false)) await udaToggle.click();
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(UDA_TITLE);
  await dialog.getByRole('combobox', { name: 'Classe', exact: true }).selectOption({ label: CLASS_NAME });
  await dialog.getByLabel('Mese Inizio').selectOption('0');
  await dialog.getByLabel('Durata Mesi').fill('10');
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(UDA_TITLE, { exact: true }).first()).toBeVisible();
}

async function openUdaDossier(page) {
  await openDrawerItem(page, 'UDA');
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
  await expect(page.getByRole('button', { name: 'Chiudi Fascicolo', exact: true })).toBeVisible();
}

async function addSyntheticLesson(page) {
  await openUdaDossier(page);
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

async function addSyntheticSource(page) {
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(SOURCE_TITLE);
  await page.getByLabel('Contenuto').fill('Materiale professionale sintetico sul funzionamento di una centrale elettrica.');
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();
}

async function sourceCard(page, title) {
  const heading = page.getByRole('heading', { name: title, exact: true });
  await expect(heading).toBeVisible();
  return heading.locator('xpath=ancestor::article');
}

async function launchComposer(page, { lesson = false } = {}) {
  const card = await sourceCard(page, SOURCE_TITLE);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  const udaSelect = card.getByLabel('UDA corrente');
  if (!(await udaSelect.isVisible().catch(() => false))) {
    await card.getByRole('button', { name: 'Cambia', exact: true }).click();
  }
  await udaSelect.selectOption({ label: UDA_TITLE });
  await card.getByRole('button', { name: 'Usa con Copilota', exact: true }).click();
  const composer = page.getByTestId('library-copilot-composer');
  await expect(composer).toBeVisible();
  await expect(composer.getByLabel('Fonte della Biblioteca').locator('option:checked')).toHaveText(SOURCE_TITLE);
  if (lesson) {
    await composer.getByLabel('Contesto didattico').selectOption({ label: `${CLASS_NAME} · Lezione · ${LESSON_TOPIC}` });
  }
  return composer;
}

async function generateProposal(composer) {
  await composer.getByLabel('Che cosa vuoi farne?').fill(REAL_PHRASE);
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  const disclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  await expect(disclosure).toBeVisible();
  const classify = disclosure.getByRole('button', { name: 'Classifica come materiale professionale', exact: true });
  if (await classify.isVisible().catch(() => false)) await classify.click();
  await expect(disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true })).toBeVisible();
  await disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true }).click();
  await disclosure.getByRole('button', { name: 'Prepara attività', exact: true }).click();
  const proposal = disclosure.getByRole('region', { name: 'Proposta didattica' });
  await expect(proposal).toBeVisible();
  await expect(proposal.getByRole('heading', { name: PROPOSAL_TITLE, exact: true })).toBeVisible();
  await expect(proposal.getByRole('button', { name: 'Adotta in Biblioteca', exact: true })).toBeVisible();
  await expect(proposal.getByRole('button', { name: "Adotta e aggiungi all'UDA", exact: true })).toBeVisible();
  await expect(proposal.getByRole('button', { name: 'Lascia', exact: true })).toBeVisible();
  await expect(proposal.locator('input[type="checkbox"]')).toHaveCount(0);
  return { disclosure, proposal };
}

async function setupUdaAndSource(page, { lesson = false } = {}) {
  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createSyntheticUda(page);
  if (lesson) await addSyntheticLesson(page);
  await openLibrary(page);
  await addSyntheticSource(page);
}

async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    width: window.innerWidth,
    root: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(metrics.root).toBeLessThanOrEqual(metrics.width + 1);
  expect(metrics.body).toBeLessThanOrEqual(metrics.width + 1);
}

async function assertAtLeast44(locator, label) {
  await expect(locator, `${label} visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} bounding box`).not.toBeNull();
  expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44);
  expect(box.width, `${label} width`).toBeGreaterThanOrEqual(44);
}

async function delayFutureVaultEncryption(page, delayMs) {
  return page.evaluate(delay => {
    const subtle = crypto.subtle;
    const original = subtle.encrypt.bind(subtle);
    try {
      Object.defineProperty(subtle, 'encrypt', {
        configurable: true,
        value: (...args) => new Promise((resolve, reject) => {
          setTimeout(() => original(...args).then(resolve, reject), delay);
        })
      });
      window.__aic02RestoreEncrypt = () => {
        Object.defineProperty(subtle, 'encrypt', { configurable: true, value: original });
      };
      return true;
    } catch {
      return false;
    }
  }, delayMs);
}

async function restoreVaultEncryption(page) {
  await page.evaluate(() => {
    if (typeof window.__aic02RestoreEncrypt === 'function') window.__aic02RestoreEncrypt();
  });
}

test('AIC-02 Library-only adoption persists after reload without changing UDA lessons — desktop', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const guards = installConsoleGuards(page);
  const proposalBodies = [];
  await installRoutes(page, proposalBodies);
  await setupUdaAndSource(page);

  const composer = await launchComposer(page);
  const { proposal } = await generateProposal(composer);
  await proposal.getByRole('button', { name: 'Adotta in Biblioteca', exact: true }).click();
  await expect(proposal).toBeHidden();
  expect(proposalBodies).toHaveLength(1);

  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  await openLibrary(page);
  await expect(page.getByRole('heading', { name: PROPOSAL_TITLE, exact: true })).toHaveCount(1);

  await openUdaDossier(page);
  await expect(page.getByText(PROPOSAL_TITLE, { exact: true })).toHaveCount(0);
  await page.screenshot({ path: path.join(evidenceDir, 'aic-02-library-only-desktop.png'), fullPage: true });

  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
});

test('AIC-02 UDA-only compound adoption persists one source and one new lesson after reload — desktop', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const guards = installConsoleGuards(page);
  await installRoutes(page);
  await setupUdaAndSource(page);

  const composer = await launchComposer(page);
  const { proposal } = await generateProposal(composer);
  await proposal.getByRole('button', { name: "Adotta e aggiungi all'UDA", exact: true }).click();
  await expect(proposal).toBeHidden();
  await expect(page.getByText('Proposta aggiunta all’UDA', { exact: true })).toBeVisible();

  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  await openLibrary(page);
  const adoptedCard = await sourceCard(page, PROPOSAL_TITLE);
  await expect(page.getByRole('heading', { name: PROPOSAL_TITLE, exact: true })).toHaveCount(1);
  await adoptedCard.getByText('Gestisci', { exact: true }).click();
  const linkedUdaRow = adoptedCard.getByRole('button', { name: 'Scollega', exact: true }).locator('xpath=..');
  await expect(linkedUdaRow.getByText(UDA_TITLE, { exact: true })).toBeVisible();

  await openUdaDossier(page);
  await expect(page.getByText(PROPOSAL_TITLE, { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: path.join(evidenceDir, 'aic-02-compound-uda-desktop.png'), fullPage: true });

  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
});

test('AIC-02 explicit-lesson compound adoption preserves lesson identity and links the adopted source — desktop', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const guards = installConsoleGuards(page);
  await installRoutes(page);
  await setupUdaAndSource(page, { lesson: true });

  const composer = await launchComposer(page, { lesson: true });
  const { proposal } = await generateProposal(composer);
  await proposal.getByRole('button', { name: "Adotta e aggiungi all'UDA", exact: true }).click();
  await expect(proposal).toBeHidden();

  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  await openLibrary(page);
  const adoptedCard = await sourceCard(page, PROPOSAL_TITLE);
  await adoptedCard.getByText('Gestisci', { exact: true }).click();
  await expect(adoptedCard.getByText(LESSON_TOPIC, { exact: true })).toBeVisible();

  await openUdaDossier(page);
  await expect(page.getByText(LESSON_TOPIC, { exact: true }).first()).toBeVisible();
  // A new lesson with the proposal title must not have been created in explicit-lesson mode.
  const proposalTopicRows = page.locator('div.rounded-lg.bg-slate-900').filter({ hasText: PROPOSAL_TITLE });
  await expect(proposalTopicRows).toHaveCount(0);
  await page.screenshot({ path: path.join(evidenceDir, 'aic-02-existing-lesson-desktop.png'), fullPage: true });

  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
});

test('AIC-02 choices are touch-safe and compound adoption stays pending until durable resolution — mobile 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const guards = installConsoleGuards(page);
  await installRoutes(page);
  await setupUdaAndSource(page);

  const composer = await launchComposer(page);
  const { proposal } = await generateProposal(composer);
  const libraryOnly = proposal.getByRole('button', { name: 'Adotta in Biblioteca', exact: true });
  const compound = proposal.getByRole('button', { name: "Adotta e aggiungi all'UDA", exact: true });
  const leave = proposal.getByRole('button', { name: 'Lascia', exact: true });
  await assertAtLeast44(libraryOnly, 'AIC-02 mobile Library-only choice');
  await assertAtLeast44(compound, 'AIC-02 mobile compound choice');
  await assertAtLeast44(leave, 'AIC-02 mobile leave choice');
  await assertNoHorizontalOverflow(page);

  const patched = await delayFutureVaultEncryption(page, 5000);
  expect(patched).toBe(true);
  await compound.click();
  const savingButtons = proposal.getByRole('button', { name: 'Salvo…', exact: true });
  await expect(savingButtons).toHaveCount(2, { timeout: 1000 });
  await expect(savingButtons.nth(0)).toBeDisabled();
  await expect(savingButtons.nth(1)).toBeDisabled();
  await expect(leave).toBeDisabled({ timeout: 1000 });
  await expect(page.getByText('Proposta aggiunta all’UDA', { exact: true })).toHaveCount(0);
  await restoreVaultEncryption(page);

  await expect(proposal).toBeHidden({ timeout: 10000 });
  await expect(page.getByText('Proposta aggiunta all’UDA', { exact: true })).toHaveCount(1);
  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  await openLibrary(page);
  await expect(page.getByRole('heading', { name: PROPOSAL_TITLE, exact: true })).toHaveCount(1);

  await page.screenshot({ path: path.join(evidenceDir, 'aic-02-mobile-pending.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'aic-02-prepare-outcome.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 390, height: 844 },
    checks: [
      'explicit-library-only-choice',
      'explicit-compound-choice',
      'no-default-checkbox',
      'touch-safe-controls',
      'pending-controls-disabled',
      'no-premature-success',
      'durable-compound-reload'
    ],
    pageErrors: guards.pageErrors,
    consoleErrors: guards.consoleErrors
  }, null, 2) + '\n');

  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
  await context.close();
});
