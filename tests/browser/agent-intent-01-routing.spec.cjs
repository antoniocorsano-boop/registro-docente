const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'agent-intent-01-browser';
const CLASS_NAME = '3ª A Sintetica AGENT-INTENT-01';
const UDA_TITLE = 'Energia e centrale elettrica AGENT-INTENT-01';
const SOURCE_TITLE = 'Fonte centrale elettrica AGENT-INTENT-01';
const REAL_PHRASE = 'Preparazione Attività per fare comprendere il funzionamento della centrale elettrica';

test.setTimeout(120000);

function envelope(intent, overrides = {}) {
  return {
    schema: 'registro.agent-intent/v1',
    intent,
    goal: 'obiettivo didattico sintetico',
    contextTarget: 'current',
    confidence: 'high',
    needsClarification: false,
    ...overrides
  };
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

async function openLibrary(page) {
  await openDrawerItem(page, 'Biblioteca privata');
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
}

async function addSource(page) {
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(SOURCE_TITLE);
  await page.getByLabel('Contenuto').fill('Materiale professionale sintetico sul funzionamento di una centrale elettrica.');
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();
}

async function sourceCard(page) {
  const heading = page.getByRole('heading', { name: SOURCE_TITLE, exact: true });
  await expect(heading).toBeVisible();
  return heading.locator('xpath=ancestor::article');
}

async function launchComposer(page) {
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
  await expect(composer.getByLabel('Fonte della Biblioteca').locator('option:checked')).toHaveText(SOURCE_TITLE);
  await expect(composer).toContainText(CLASS_NAME);
  return composer;
}

async function bootstrap(page) {
  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createSyntheticUda(page);
  await openLibrary(page);
  await addSource(page);
  return launchComposer(page);
}

async function submit(composer, message) {
  await composer.getByLabel('Che cosa vuoi farne?').fill(message);
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
}

async function assertNoOverflow(page) {
  const metrics = await page.evaluate(() => ({
    width: window.innerWidth,
    root: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(metrics.root).toBeLessThanOrEqual(metrics.width + 1);
  expect(metrics.body).toBeLessThanOrEqual(metrics.width + 1);
  return metrics;
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

test('AGENT-INTENT-01 routes the real teacher phrase agent-first without leaking source content — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const guards = installConsoleGuards(page);
  const intentRequests = [];
  const proposalRequests = [];

  await page.route('**/api/copilot/intent/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'browser-fixture-v1' })
    });
  });
  await page.route('**/api/copilot/intent', async route => {
    const body = route.request().postDataJSON();
    intentRequests.push(body);
    const message = body?.message || '';
    let response;
    if (message === REAL_PHRASE) {
      response = envelope('PREPARE', {
        goal: 'far comprendere il funzionamento della centrale elettrica',
        requestedArtifact: 'attività didattica',
        classReference: 'current',
        udaReference: 'current',
        sourceReference: 'current'
      });
    } else if (message.includes('collega')) {
      response = envelope('LINK', { goal: 'collegare la fonte alla UDA corrente' });
    } else if (message.includes('ambigua')) {
      response = envelope('CLARIFY', {
        goal: 'capire se collegare o preparare',
        confidence: 'low',
        needsClarification: true,
        clarificationQuestion: 'Vuoi collegare la fonte oppure preparare una nuova attività?'
      });
    } else {
      response = envelope('UNSUPPORTED', { goal: 'creare una presentazione' });
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ intent: response }) });
  });
  await page.route('**/api/copilot/library-proposal/provider', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'browser-fixture-v1' }) });
  });
  await page.route('**/api/copilot/library-proposal', async route => {
    proposalRequests.push(route.request().postDataJSON());
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Generation not expected before explicit proposal consent.' }) });
  });

  const composer = await bootstrap(page);
  await submit(composer, REAL_PHRASE);
  await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toBeVisible();
  expect(proposalRequests).toHaveLength(0);
  expect(intentRequests).toHaveLength(1);

  const body = intentRequests[0];
  expect(body).toEqual({
    schema: 'registro.agent-routing-request/v1',
    message: REAL_PHRASE,
    context: {
      surface: 'library',
      hasCurrentClass: true,
      hasCurrentUda: true,
      hasSelectedSource: true
    },
    explicitTeacherSubmission: true
  });
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain(SOURCE_TITLE);
  expect(serialized).not.toContain('Materiale professionale sintetico');
  for (const forbidden of ['extractedText', 'payload', 'dataBase64', 'student', 'grade', 'attachment', 'udaContent']) {
    expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
  }

  await submit(composer, 'collega questa fonte alla UDA');
  const linkAction = composer.getByTestId('library-copilot-link-action');
  await expect(linkAction).toBeVisible();
  await expect(composer.getByText('Il collegamento è stato salvato nella Biblioteca.')).toHaveCount(0);
  await linkAction.click();
  const confirmation = composer.getByTestId('library-copilot-link-confirmation');
  await expect(confirmation).toBeVisible();
  await expect(composer.getByText('Il collegamento è stato salvato nella Biblioteca.')).toHaveCount(0);
  await confirmation.getByRole('button', { name: 'Annulla', exact: true }).click();
  await expect(confirmation).toHaveCount(0);

  await submit(composer, 'richiesta ambigua');
  await expect(composer.getByTestId('library-copilot-agent-guidance')).toHaveText('Vuoi collegare la fonte oppure preparare una nuova attività?');
  await expect(composer.getByTestId('library-copilot-link-action')).toHaveCount(0);
  await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toHaveCount(0);

  await submit(composer, 'crea una presentazione con questa fonte');
  await expect(composer.getByTestId('library-copilot-agent-guidance')).toContainText('questa capacità non è ancora disponibile');
  await expect(composer.getByTestId('library-copilot-link-action')).toHaveCount(0);
  await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toHaveCount(0);

  const overflow = await assertNoOverflow(page);
  await page.screenshot({ path: path.join(evidenceDir, 'agent-intent-01-desktop.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'agent-intent-01-desktop.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 1280, height: 900 },
    realPhrase: REAL_PHRASE,
    intentRequest: body,
    proposalRequestCountBeforeConsent: proposalRequests.length,
    overflow,
    ...guards
  }, null, 2) + '\n');
  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
});

test('AGENT-INTENT-01 keeps exact 390x844 mobile usable and ignores stale agent responses', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const guards = installConsoleGuards(page);
  let releaseFirstResponse;
  let firstRequestSeen;
  const firstRequestPromise = new Promise(resolve => { firstRequestSeen = resolve; });
  const delayedResponse = new Promise(resolve => { releaseFirstResponse = resolve; });
  let intentCallCount = 0;

  await page.route('**/api/copilot/intent/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'browser-fixture-v1' })
    });
  });
  await page.route('**/api/copilot/intent', async route => {
    intentCallCount += 1;
    const body = route.request().postDataJSON();
    if (intentCallCount === 1) {
      firstRequestSeen();
      await delayedResponse;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        intent: envelope('PREPARE', {
          goal: 'far comprendere il funzionamento della centrale elettrica',
          requestedArtifact: 'attività didattica'
        })
      })
    });
  });
  await page.route('**/api/copilot/library-proposal/provider', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'browser-fixture-v1' }) });
  });

  const composer = await bootstrap(page);
  const textarea = composer.getByLabel('Che cosa vuoi farne?');
  const submitButton = composer.getByRole('button', { name: 'Mostra le possibilità', exact: true });
  const textareaBox = await textarea.boundingBox();
  const submitBox = await submitButton.boundingBox();
  expect(textareaBox).not.toBeNull();
  expect(submitBox).not.toBeNull();
  expect(textareaBox.height).toBeGreaterThanOrEqual(44);
  expect(submitBox.height).toBeGreaterThanOrEqual(44);

  await textarea.fill(REAL_PHRASE);
  await submitButton.click();
  await firstRequestPromise;
  await textarea.fill('Ho cambiato richiesta mentre stavi interpretando');
  releaseFirstResponse();
  await page.waitForTimeout(250);
  await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toHaveCount(0);

  await textarea.fill(REAL_PHRASE);
  await submitButton.click();
  await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toBeVisible();

  const overflow = await assertNoOverflow(page);
  await page.screenshot({ path: path.join(evidenceDir, 'agent-intent-01-mobile.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'agent-intent-01-mobile.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 390, height: 844 },
    realPhrase: REAL_PHRASE,
    staleResponseIgnored: true,
    intentCallCount,
    textareaBox,
    submitBox,
    overflow,
    ...guards
  }, null, 2) + '\n');
  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
  await context.close();
});

test('AGENT-INTENT-01 falls back locally and remains fail-closed when the agent route is unavailable', async ({ page }) => {
  const guards = installConsoleGuards(page);
  let unexpectedIntentPostCount = 0;
  await page.route('**/api/copilot/intent/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: false, provider: 'Browser Provider', model: 'browser-fixture-v1' })
    });
  });
  await page.route('**/api/copilot/intent', async route => {
    unexpectedIntentPostCount += 1;
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'UNEXPECTED_POST' } }) });
  });

  const composer = await bootstrap(page);
  await submit(composer, REAL_PHRASE);
  await expect(composer.getByText('Non ho riconosciuto una richiesta tra revisione, collegamento e preparazione.', { exact: false })).toBeVisible();
  await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toHaveCount(0);
  await expect(composer.getByTestId('library-copilot-link-action')).toHaveCount(0);
  await expect(composer.getByTestId('library-copilot-review-panel')).toHaveCount(0);
  expect(unexpectedIntentPostCount).toBe(0);
  expect(guards.pageErrors).toEqual([]);
  expect(guards.consoleErrors).toEqual([]);
});
