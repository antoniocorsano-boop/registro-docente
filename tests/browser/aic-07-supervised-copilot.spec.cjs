const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'aic-07-supervised-copilot-browser';
const CLASS_NAME = '2C Sintetica AIC-07';
const UDA_TITLE = 'Agricoltura come sistema tecnologico AIC-07';
const LESSON_TOPIC = 'Ciclo integrato agricoltura AIC-07';
const SOURCE_TITLE = 'Ciclo integrato agricoltura AIC-07 fonte';
const RENAMED_SOURCE_TITLE = 'Ciclo integrato agricoltura AIC-07 fonte aggiornata';
const PROPOSAL_TITLE = 'Attività ciclo integrato AIC-07';
const MANUAL_MEMORY = 'Riusa la fonte AIC-07 per attività sul ciclo integrato e sulla sostenibilità.';

const proposalContent = {
  title: PROPOSAL_TITLE,
  objective: 'Comprendere il ciclo integrato come sistema tecnologico.',
  teacherSetup: 'Richiamare risorse, trasformazioni e relazioni fra le fasi del sistema.',
  studentTask: 'Ricostruire il ciclo integrato e motivare le connessioni tra le fasi.',
  steps: ['Osserva', 'Ricostruisci', 'Motiva'],
  questions: ['Quali risorse entrano nel sistema?', 'Quali relazioni rendono il ciclo integrato?'],
  adaptationHint: 'Usare una mappa essenziale con parole chiave.'
};

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(180000);

function installConsoleGuards(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  return { pageErrors, consoleErrors };
}

function intentEnvelope() {
  return {
    schema: 'registro.agent-intent/v1',
    intent: 'PREPARE',
    goal: 'preparare la lezione sul ciclo integrato',
    contextTarget: 'current',
    confidence: 'high',
    needsClarification: false,
    requestedArtifact: 'attività didattica',
    classReference: 'current',
    udaReference: 'current',
    sourceReference: 'current'
  };
}

function proposalFor(body) {
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
      generatedAt: new Date().toISOString()
    }
  };
}

async function installRoutes(page) {
  const calls = {
    intentProvider: 0,
    intent: 0,
    proposalProvider: 0,
    proposal: 0,
    proposalBodies: []
  };

  await page.route('**/api/copilot/intent/provider', async route => {
    calls.intentProvider += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'browser-fixture-v1' })
    });
  });
  await page.route('**/api/copilot/intent', async route => {
    calls.intent += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ intent: intentEnvelope() })
    });
  });
  await page.route('**/api/copilot/library-proposal/provider', async route => {
    calls.proposalProvider += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'browser-fixture-v1' })
    });
  });
  await page.route('**/api/copilot/library-proposal', async route => {
    calls.proposal += 1;
    const body = route.request().postDataJSON();
    calls.proposalBodies.push(body);
    expect(JSON.stringify(body)).not.toMatch(/studentId|students|roster|grades|behavior/i);
    expect(body.classification).toBe('TEACHER_PROFESSIONAL');
    expect(body.explicitTeacherOptIn).toBe(true);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        proposal: proposalFor(body),
        receipt: {
          requestId: `aic-07-${calls.proposal}`,
          provider: 'browser-fixture',
          model: 'browser-fixture-v1',
          durationMs: 10,
          attemptCount: 1,
          budget: { tier: 'remote-low', profile: body.budget?.profile || 'balanced', escalated: false }
        }
      })
    });
  });

  return calls;
}

function resetCalls(calls) {
  calls.intentProvider = 0;
  calls.intent = 0;
  calls.proposalProvider = 0;
  calls.proposal = 0;
  calls.proposalBodies.length = 0;
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
  const unlock = page.getByRole('heading', { name: 'Sblocca Registro' });
  if (await unlock.isVisible().catch(() => false)) {
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
  const button = page.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true });
  await expect(button).toBeVisible();
  await button.click();
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
  await page.getByLabel('Contenuto').fill('Ciclo integrato agricoltura risorse sostenibilità sistema tecnologico AIC-07.');
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();
}

async function sourceCard(page, title = SOURCE_TITLE) {
  const heading = page.getByRole('heading', { name: title, exact: true });
  await expect(heading).toBeVisible();
  return heading.locator('xpath=ancestor::article');
}

async function launchComposerFromSource(page) {
  const card = await sourceCard(page);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  const udaSelect = card.getByLabel('UDA corrente');
  if (!(await udaSelect.isVisible().catch(() => false))) {
    await card.getByRole('button', { name: 'Cambia', exact: true }).click();
  }
  await udaSelect.selectOption({ label: UDA_TITLE });
  await card.getByRole('button', { name: 'Usa con Copilota', exact: true }).click();
  const composer = page.getByTestId('library-copilot-composer');
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

async function openTeacherFirstPrepareForSource(page) {
  const trigger = page.getByTestId('library-copilot-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const deck = page.getByTestId('copilot-deck');
  await expect(deck).toBeVisible();
  await deck.getByRole('button', { name: 'Parla con il Copilota', exact: true }).click();

  const composer = page.getByTestId('library-copilot-composer');
  await expect(composer).toBeVisible();
  await composer.getByRole('button', { name: 'Preparare un’attività', exact: true }).click();

  const classChoice = composer.getByTestId('teacher-first-class-choice');
  await expect(classChoice).toBeVisible();
  await classChoice.getByRole('button', { name: CLASS_NAME, exact: true }).click();

  const contextSelect = composer.getByTestId('library-copilot-context-select');
  await expect(contextSelect).toBeVisible();
  const udaOption = contextSelect.locator('option').filter({ hasText: UDA_TITLE }).first();
  const udaValue = await udaOption.getAttribute('value');
  expect(udaValue).toBeTruthy();
  await contextSelect.selectOption(udaValue);

  const sourceSelect = composer.getByLabel('Fonte della Biblioteca');
  await expect(sourceSelect).toBeVisible();
  await sourceSelect.selectOption({ label: SOURCE_TITLE });
  await expect(composer.getByTestId('teacher-first-preview')).toBeVisible();
  return composer;
}

async function classifySourceProfessional(page) {
  const composer = await openTeacherFirstPrepareForSource(page);
  await composer.getByTestId('teacher-first-preview').getByRole('button', { name: '▶ Continua', exact: true }).click();
  const disclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  await expect(disclosure).toBeVisible();
  const classify = disclosure.getByRole('button', { name: 'Classifica come materiale professionale', exact: true });
  if (await classify.isVisible().catch(() => false)) await classify.click();
  await expect(disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true })).toBeVisible();
  await closeComposer(page);
}

async function setupOpportunityFixture(page, calls, { withMemory = false } = {}) {
  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createSyntheticUda(page);
  await addSyntheticLesson(page);
  await openLibrary(page);
  await addSyntheticSource(page);
  await classifySourceProfessional(page);

  if (withMemory) {
    const composer = await openTeacherFirstPrepareForSource(page);
    const panel = composer.getByTestId('copilot-memory-panel');
    if (!(await panel.evaluate(element => element.open === true))) {
      await composer.getByTestId('copilot-memory-trigger').click();
    }
    await panel.getByTestId('copilot-memory-remember-this').click();
    await panel.getByLabel('Testo da ricordare').fill(MANUAL_MEMORY);
    await panel.getByTestId('copilot-memory-confirm').click();
    await expect(panel.getByRole('status')).toContainText('Ricordo salvato nella memoria professionale.');
    await closeComposer(page);
  }

  await page.waitForTimeout(100);
  resetCalls(calls);
  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  resetCalls(calls);
}

async function openDeck(page) {
  const trigger = page.getByTestId('library-copilot-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const deck = page.getByTestId('copilot-deck');
  await expect(deck).toBeVisible();
  return deck;
}

function todaySection(deck) {
  return deck.locator('section[aria-labelledby="copilot-group-today"]');
}

function laterSection(deck) {
  return deck.locator('section[aria-labelledby="copilot-group-later"]');
}

function opportunityCard(section) {
  return section.locator('[data-testid^="copilot-opportunity-"]').filter({ hasText: LESSON_TOPIC }).first();
}

async function assertAtLeast44(locator, label) {
  await expect(locator, `${label} visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} bounding box`).not.toBeNull();
  expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44);
  expect(box.width, `${label} width`).toBeGreaterThanOrEqual(44);
}

async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    width: window.innerWidth,
    root: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(metrics.root).toBeLessThanOrEqual(metrics.width + 1);
  expect(metrics.body).toBeLessThanOrEqual(metrics.width + 1);
  return metrics;
}

async function startMissionFromTodayOpportunity(page) {
  const deck = await openDeck(page);
  const card = opportunityCard(todaySection(deck));
  await expect(card).toBeVisible();
  await expect(card.getByRole('button', { name: '▶ Avvia incarico', exact: true })).toHaveCount(0);
  await card.getByRole('button', { name: 'Anteprima', exact: true }).click();
  const preview = card.getByTestId('copilot-mission-preview');
  await expect(preview).toBeVisible();
  await preview.getByRole('button', { name: '▶ Avvia incarico', exact: true }).click();
  const composer = page.getByTestId('library-copilot-composer');
  await expect(composer).toBeVisible();
  const disclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  await expect(disclosure).toBeVisible();
  return { deck, composer, disclosure };
}

async function renameSource(page) {
  await openLibrary(page);
  const card = await sourceCard(page);
  page.once('dialog', dialog => dialog.accept(RENAMED_SOURCE_TITLE));
  await card.getByText('Gestisci', { exact: true }).click();
  await card.getByRole('button', { name: 'Rinomina', exact: true }).click();
  await expect(page.getByRole('heading', { name: RENAMED_SOURCE_TITLE, exact: true })).toBeVisible();
}

test('AIC-07 Deck is evidence-backed, grouped and silent before Play — desktop', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const guards = installConsoleGuards(page);
  const calls = await installRoutes(page);
  await setupOpportunityFixture(page, calls);

  const deck = await openDeck(page);
  await expect(deck.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
  await expect(deck.getByRole('heading', { name: 'Qui', exact: true })).toHaveCount(0);
  await expect(deck.getByRole('heading', { name: 'Più tardi', exact: true })).toHaveCount(0);
  const card = opportunityCard(todaySection(deck));
  await expect(card).toBeVisible();
  await expect(card.getByText('Perché:', { exact: true })).toBeVisible();
  await expect(card).not.toContainText('AI consiglia');
  await expect(card.getByRole('button', { name: '▶ Avvia incarico', exact: true })).toHaveCount(0);
  expect(calls.intentProvider + calls.intent + calls.proposalProvider + calls.proposal).toBe(0);

  await card.getByRole('button', { name: 'Anteprima', exact: true }).click();
  const preview = card.getByTestId('copilot-mission-preview');
  await expect(preview).toBeVisible();
  for (const label of ['Obiettivo', 'Contesto', 'Userà', 'Produrrà', 'Non farà']) {
    await expect(preview.getByText(label, { exact: true })).toBeVisible();
  }
  expect(calls.intentProvider + calls.intent + calls.proposalProvider + calls.proposal).toBe(0);

  await page.screenshot({ path: path.join(evidenceDir, 'aic-07-deck-desktop.png'), fullPage: true });
  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
});

test('AIC-07 Put Aside moves the opportunity to Più tardi without AI execution', async ({ page }) => {
  const calls = await installRoutes(page);
  await setupOpportunityFixture(page, calls);
  const deck = await openDeck(page);
  const before = opportunityCard(todaySection(deck));
  await expect(before).toBeVisible();
  await before.getByRole('button', { name: 'Metti da parte', exact: true }).click();

  await expect(opportunityCard(laterSection(deck))).toBeVisible();
  await expect(opportunityCard(todaySection(deck))).toHaveCount(0);
  expect(calls.intentProvider + calls.intent + calls.proposalProvider + calls.proposal).toBe(0);
});

test('AIC-07 Ignore suppresses the same fingerprint and a changed surface may surface it again', async ({ page }) => {
  const calls = await installRoutes(page);
  await setupOpportunityFixture(page, calls);
  let deck = await openDeck(page);
  const card = opportunityCard(todaySection(deck));
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Ignora', exact: true }).click();
  await expect(opportunityCard(todaySection(deck))).toHaveCount(0);
  expect(calls.intentProvider + calls.intent + calls.proposalProvider + calls.proposal).toBe(0);

  await deck.getByRole('button', { name: 'Chiudi opportunità del Copilota' }).click();
  await openDrawerItem(page, 'Impostazioni');
  deck = await openDeck(page);
  await expect(opportunityCard(todaySection(deck))).toBeVisible();
  expect(calls.intentProvider + calls.intent + calls.proposalProvider + calls.proposal).toBe(0);
});

test('AIC-07 Play reuses governed PREPARE, ready survives reload, and output is not adopted implicitly', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const guards = installConsoleGuards(page);
  const calls = await installRoutes(page);
  await setupOpportunityFixture(page, calls);

  const { composer, disclosure } = await startMissionFromTodayOpportunity(page);
  expect(calls.proposal).toBe(0);
  const consent = disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true });
  await expect(consent).toBeVisible();
  await consent.click();
  const prepare = disclosure.getByRole('button', { name: 'Prepara attività', exact: true });
  await expect(prepare).toBeVisible();
  await prepare.click();
  const proposal = disclosure.getByRole('region', { name: 'Proposta didattica' });
  await expect(proposal).toBeVisible();
  await expect(proposal.getByRole('heading', { name: PROPOSAL_TITLE, exact: true })).toBeVisible();
  expect(calls.proposal).toBe(1);
  await closeComposer(page);

  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  const deck = await openDeck(page);
  await expect(deck.getByText('Pronta da controllare', { exact: true })).toBeVisible();
  await deck.getByRole('button', { name: 'Chiudi opportunità del Copilota' }).click();

  await openLibrary(page);
  await expect(page.getByRole('heading', { name: PROPOSAL_TITLE, exact: true })).toHaveCount(0);
  await openUdaDossier(page);
  await expect(page.getByText(PROPOSAL_TITLE, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Chiudi Fascicolo', exact: true }).click();

  await page.screenshot({ path: path.join(evidenceDir, 'aic-07-ready-not-adopted.png'), fullPage: true });
  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
});

test('AIC-07 suspended mission resumes unchanged and material source change forces refreshed preview', async ({ page }) => {
  const calls = await installRoutes(page);
  await setupOpportunityFixture(page, calls);
  const started = await startMissionFromTodayOpportunity(page);
  await closeComposer(page);

  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  let deck = await openDeck(page);
  let resume = deck.getByRole('button', { name: '▶ Riprendi', exact: true });
  await expect(resume).toBeVisible();
  await expect(resume).toBeEnabled();
  await resume.click();
  await expect(page.getByTestId('library-copilot-composer')).toBeVisible();
  await expect(page.getByTestId('copilot-mission-preview')).toHaveCount(0);
  if (await deck.isVisible().catch(() => false)) {
    await deck.getByRole('button', { name: 'Chiudi opportunità del Copilota' }).click();
  }
  await closeComposer(page);

  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  await renameSource(page);
  deck = await openDeck(page);
  resume = deck.getByRole('button', { name: '▶ Riprendi', exact: true });
  await expect(resume).toBeVisible();
  await expect(resume).toBeEnabled();
  await resume.click();
  await expect(deck.getByTestId('copilot-mission-preview')).toBeVisible();
  await expect(page.getByTestId('library-copilot-composer')).toHaveCount(0);
  expect(calls.proposal).toBe(0);
});

test('AIC-07 proactivity persists independently and preference reset preserves Biblioteca, Memory and UDA', async ({ page }) => {
  const calls = await installRoutes(page);
  await setupOpportunityFixture(page, calls, { withMemory: true });

  await openDrawerItem(page, 'Impostazioni');
  const present = page.getByRole('radio', { name: /Presente/ });
  await present.click();
  await expect(present).toHaveAttribute('aria-checked', 'true');
  const quality = page.getByRole('button', { name: /^Qualità/ });
  await quality.click();
  await expect(quality).toHaveAttribute('aria-pressed', 'true');

  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  await openDrawerItem(page, 'Impostazioni');
  await expect(page.getByRole('radio', { name: /Presente/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: /^Qualità/ })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Reimposta preferenze del Copilota', exact: true }).click();
  await expect(page.getByText('Biblioteca, Memoria professionale, UDA e Registro non vengono cancellati.', { exact: true })).toBeVisible();

  await openLibrary(page);
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();
  const composer = await openTeacherFirstPrepareForSource(page);
  const panel = composer.getByTestId('copilot-memory-panel');
  if (!(await panel.evaluate(element => element.open === true))) await composer.getByTestId('copilot-memory-trigger').click();
  await expect(panel.getByText(MANUAL_MEMORY, { exact: true })).toBeVisible();
  await closeComposer(page);

  await openUdaDossier(page);
  await expect(page.getByText(UDA_TITLE, { exact: true }).last()).toBeVisible();
});

test('AIC-07 Deck stays touch-safe and navigation-safe at 390×844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const guards = installConsoleGuards(page);
  const calls = await installRoutes(page);
  await setupOpportunityFixture(page, calls);

  const trigger = page.getByTestId('library-copilot-trigger');
  await assertAtLeast44(trigger, 'Copilot trigger');
  const deck = await openDeck(page);
  const card = opportunityCard(todaySection(deck));
  await expect(card).toBeVisible();
  for (const button of [
    card.getByRole('button', { name: 'Anteprima', exact: true }),
    card.getByRole('button', { name: 'Metti da parte', exact: true }),
    card.getByRole('button', { name: 'Ignora', exact: true }),
    deck.getByRole('button', { name: 'Parla con il Copilota', exact: true }),
    deck.getByRole('button', { name: 'Chiudi opportunità del Copilota' })
  ]) {
    await assertAtLeast44(button, 'Deck touch target');
  }
  const box = await deck.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390 + 1);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(844 + 1);
  const overflow = await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: path.join(evidenceDir, 'aic-07-deck-mobile-390x844.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'aic-07-browser-evidence.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 390, height: 844 },
    overflow,
    remoteCallsBeforePlay: {
      intentProvider: calls.intentProvider,
      intent: calls.intent,
      proposalProvider: calls.proposalProvider,
      proposal: calls.proposal
    },
    ...guards
  }, null, 2) + '\n');
  expect(calls.intentProvider + calls.intent + calls.proposalProvider + calls.proposal).toBe(0);
  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
  await context.close();
});
