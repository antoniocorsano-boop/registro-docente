const { test, expect } = require('@playwright/test');
const { revealMaterialSourceSelect, expectExistingCopilotBindings } = require('./teacher-first-copilot-helpers.cjs');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lib01e-browser-qualification';

const CLASS_NAME = 'Classe Sintetica LIB-01E';
const STUDENT_NAME = 'Studente Segreto Sintetico LIB-01E';
const UDA_TITLE = 'UDA Sintetica LIB-01E';
const ALT_UDA_TITLE = 'UDA Alternativa LIB-01E';
const SOURCE_TITLE = 'Fonte professionale sintetica LIB-01E';
const PROPOSAL_TITLE = 'Proposta sintetica LIB-01E';
const ADAPTED_TITLE = 'Proposta adattata dal docente LIB-01E';
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

async function createSyntheticUda(page, title, className = null) {
  await openDrawerItem(page, 'UDA');
  const udaViewToggle = page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'UDA', exact: true });
  if (await udaViewToggle.isVisible().catch(() => false)) await udaViewToggle.click();
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(title);
  const dialog = page.getByRole('dialog');
  if (className) {
    const classSelect = dialog.getByRole('combobox', { name: 'Classe', exact: true });
    await expect(classSelect).toBeVisible();
    await classSelect.selectOption({ label: className });
  }
  await dialog.getByLabel('Mese Inizio').selectOption('0');
  await dialog.getByLabel('Durata Mesi').fill('10');
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
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
  await page.getByLabel('Contenuto').fill('Fonte sintetica professionale sulle trasformazioni di energia e materia.');
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();
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
  await expect(page.getByTestId('copilot-deck')).toBeVisible();
  await page.getByRole('button', { name: 'Parla con il Copilota', exact: true }).click();
  const composer = page.locator('[data-testid="library-copilot-composer"]');
  await expect(composer).toBeVisible();
  return composer;
}

async function selectComposerSource(composer, title) {
  const sourceSelect = await revealMaterialSourceSelect(composer);
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
      generatedAt: '2026-10-25T08:30:00.000Z'
    }
  };
}

function receiptForRequest(index) {
  return {
    requestId: `browser-lib01e-${index}`,
    provider: 'browser-fixture',
    model: 'browser-fixture-v1',
    durationMs: 12,
    promptTokens: 120,
    outputTokens: 60,
    totalTokens: 180,
    attemptCount: 1
  };
}

function errorEnvelope(code, retriable, index) {
  return {
    error: {
      code,
      message: `RAW_VENDOR_DIAGNOSTIC_${code}`,
      retriable,
      requestId: `browser-lib01e-error-${index}`
    }
  };
}

function isExpectedSyntheticHttpFailureConsoleError(message) {
  return /^Failed to load resource: the server responded with a status of (429|503|504) \(/.test(message);
}

function assertGovernedRequest(body) {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toContain(STUDENT_NAME);
  expect(serialized).not.toMatch(/studentId|students|roster|grades|behavior/i);
  expect(Object.prototype.hasOwnProperty.call(body, 'provider')).toBe(false);
  expect(Object.prototype.hasOwnProperty.call(body, 'model')).toBe(false);
  expect(body.classification).toBe('TEACHER_PROFESSIONAL');
  expect(body.explicitTeacherOptIn).toBe(true);
}

async function installQueuedProposalRoute(page, capturedBodies, responses) {
  await page.route('**/api/copilot/library-proposal/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        available: true,
        provider: 'Browser Provider LIB-01E',
        model: 'browser-fixture-v1'
      })
    });
  });

  await page.route('**/api/copilot/library-proposal', async route => {
    const body = route.request().postDataJSON();
    capturedBodies.push(body);
    assertGovernedRequest(body);

    const next = responses.shift();
    expect(next, 'deterministic LIB-01E response fixture').toBeTruthy();
    if (next.kind === 'success') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          proposal: proposalForRequest(body),
          receipt: receiptForRequest(capturedBodies.length)
        })
      });
      return;
    }

    await route.fulfill({
      status: next.status,
      contentType: 'application/json',
      body: JSON.stringify(errorEnvelope(next.code, next.retriable, capturedBodies.length))
    });
  });
}

async function consentAndPrepare(disclosure) {
  const consent = disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true });
  await expect(consent).toBeVisible();
  await consent.click();
  const prepare = disclosure.getByRole('button', { name: 'Prepara attività', exact: true });
  await expect(prepare).toBeVisible();
  await prepare.click();
}

async function assertFailureConsumedConsent({
  page,
  disclosure,
  requests,
  beforeCount,
  message
}) {
  await expect(disclosure.getByRole('alert')).toHaveText(message);
  await expect(disclosure.getByRole('region', { name: 'Proposta didattica' })).toHaveCount(0);
  await expect(disclosure.getByText(/RAW_VENDOR_DIAGNOSTIC_/)).toHaveCount(0);
  await expect(disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true })).toBeVisible();
  await expect(disclosure.getByRole('button', { name: 'Prepara attività', exact: true })).toHaveCount(0);
  expect(requests).toHaveLength(beforeCount + 1);
  await page.waitForTimeout(250);
  expect(requests).toHaveLength(beforeCount + 1);
}

async function openPrepareFromIntent(composer) {
  await composer.getByLabel('Che cosa vuoi farne?').fill('crea una proposta didattica a partire da questo materiale');
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  const disclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  await expect(disclosure).toBeVisible();
  return disclosure;
}

test('LIB-01E 429/504/503 consume one-shot consent, never auto-retry, then manual recovery persists — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const pageErrors = [];
  const consoleErrors = [];
  const proposalBodies = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  const responses = [
    { kind: 'error', status: 429, code: 'PROVIDER_RATE_LIMITED', retriable: true },
    { kind: 'error', status: 504, code: 'PROVIDER_TIMEOUT', retriable: true },
    { kind: 'error', status: 503, code: 'PROVIDER_UNAVAILABLE', retriable: true },
    { kind: 'success' }
  ];
  await installQueuedProposalRoute(page, proposalBodies, responses);

  await setupFreshVault(page);
  await createSyntheticClassAndStudent(page);
  await createSyntheticUda(page, UDA_TITLE, CLASS_NAME);
  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  await openLibrary(page);
  await addSyntheticSource(page);

  const card = await sourceCard(page, SOURCE_TITLE);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  const udaSelect = card.getByLabel('UDA corrente');
  if (!(await udaSelect.isVisible().catch(() => false))) {
    await card.getByRole('button', { name: 'Cambia', exact: true }).click();
  }
  await udaSelect.selectOption({ label: UDA_TITLE });
  await card.getByRole('button', { name: 'Usa con Copilota', exact: true }).click();
  const composer = page.locator('[data-testid="library-copilot-composer"]');
  await expect(composer).toBeVisible();
  await expectExistingCopilotBindings(composer, { sourceTitle: SOURCE_TITLE });
  const disclosure = await openPrepareFromIntent(composer);
  await disclosure.getByRole('button', { name: 'Classifica come materiale professionale', exact: true }).click();

  await expect(disclosure.getByText('Browser Provider LIB-01E', { exact: true })).toBeVisible();
  await expect(disclosure).toContainText('browser-fixture-v1');
  expect(proposalBodies).toHaveLength(0);

  let before = proposalBodies.length;
  await consentAndPrepare(disclosure);
  await assertFailureConsumedConsent({
    page,
    disclosure,
    requests: proposalBodies,
    beforeCount: before,
    message: 'Il servizio remoto ha raggiunto temporaneamente il proprio limite. Puoi riprovare più tardi.'
  });

  before = proposalBodies.length;
  await consentAndPrepare(disclosure);
  await assertFailureConsumedConsent({
    page,
    disclosure,
    requests: proposalBodies,
    beforeCount: before,
    message: 'Il servizio remoto non ha risposto entro il tempo previsto. Puoi riprovare con una nuova richiesta.'
  });

  before = proposalBodies.length;
  await consentAndPrepare(disclosure);
  await assertFailureConsumedConsent({
    page,
    disclosure,
    requests: proposalBodies,
    beforeCount: before,
    message: 'Il servizio remoto è temporaneamente non disponibile. Puoi riprovare più tardi.'
  });

  await consentAndPrepare(disclosure);
  await expect(disclosure.getByRole('region', { name: 'Proposta didattica' })).toBeVisible();
  await expect(disclosure.getByRole('heading', { name: PROPOSAL_TITLE, exact: true })).toBeVisible();
  expect(proposalBodies).toHaveLength(4);
  expect(responses).toHaveLength(0);

  await disclosure.getByRole('button', { name: 'Adatta', exact: true }).click();
  const editor = disclosure.getByRole('region', { name: 'Adatta proposta didattica' });
  await expect(editor).toBeVisible();
  await editor.getByLabel('Titolo').fill(ADAPTED_TITLE);
  await editor.getByLabel('Consegna agli studenti').fill(ADAPTED_TASK);
  await editor.getByRole('button', { name: 'Adotta in Biblioteca', exact: true }).click();

  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
  const adopted = await sourceCard(page, ADAPTED_TITLE);
  await expect(adopted.getByText('Materiale interno', { exact: true })).toBeVisible();
  await expect(adopted.getByText('Proposta didattica adottata dal docente', { exact: true })).toBeVisible();
  await expect(adopted).toContainText(ADAPTED_TASK);

  await reloadAndUnlock(page);
  await openLibrary(page);
  const reloaded = await sourceCard(page, ADAPTED_TITLE);
  await expect(reloaded.getByText('Materiale interno', { exact: true })).toBeVisible();
  await expect(reloaded.getByText('Proposta didattica adottata dal docente', { exact: true })).toBeVisible();
  await expect(reloaded).toContainText(ADAPTED_TASK);

  await page.screenshot({
    path: path.join(evidenceDir, 'lib01e-governed-provider-runtime-desktop.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib01e-governed-provider-runtime-desktop.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 1280, height: 900 },
      proposalRequestCount: proposalBodies.length,
      checks: [
        'provider-recipient-visible-before-consent',
        '429-one-request-no-auto-retry',
        '504-one-request-no-auto-retry',
        '503-readable-no-false-success',
        'new-consent-required-before-every-manual-retry',
        'provider-model-student-fields-excluded-from-request',
        'raw-provider-message-not-rendered',
        'manual-recovery-success',
        'adapted-adoption-survives-reload'
      ],
      pageErrors,
      expectedSyntheticHttpConsoleErrors: consoleErrors.filter(isExpectedSyntheticHttpFailureConsoleError),
      unexpectedConsoleErrors: consoleErrors.filter(message => !isExpectedSyntheticHttpFailureConsoleError(message))
    }, null, 2) + '\n'
  );

  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter(message => !isExpectedSyntheticHttpFailureConsoleError(message))).toEqual([]);
});

test('LIB-01E pending result is discarded after teaching-context change — mobile 390x844', async ({ browser }) => {
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

  let releaseResponse;
  const releaseGate = new Promise(resolve => {
    releaseResponse = resolve;
  });
  let markRequestStarted;
  const requestStarted = new Promise(resolve => {
    markRequestStarted = resolve;
  });

  await page.route('**/api/copilot/library-proposal/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        available: true,
        provider: 'Browser Provider LIB-01E',
        model: 'browser-fixture-v1'
      })
    });
  });

  await page.route('**/api/copilot/library-proposal', async route => {
    const body = route.request().postDataJSON();
    proposalBodies.push(body);
    assertGovernedRequest(body);
    markRequestStarted();
    await releaseGate;
    try {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          proposal: proposalForRequest(body),
          receipt: receiptForRequest(proposalBodies.length)
        })
      });
    } catch {
      // Expected when the context change aborts the in-flight fetch before fixture release.
    }
  });

  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createSyntheticUda(page, UDA_TITLE, CLASS_NAME);
  await createSyntheticUda(page, ALT_UDA_TITLE, CLASS_NAME);
  await reloadAndUnlock(page);
  await selectSyntheticClass(page);
  await openLibrary(page);
  await addSyntheticSource(page);

  const card = await sourceCard(page, SOURCE_TITLE);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  const contextSelect = card.getByLabel('UDA corrente');
  if (!(await contextSelect.isVisible().catch(() => false))) {
    await card.getByRole('button', { name: 'Cambia', exact: true }).click();
  }
  await contextSelect.selectOption({ label: UDA_TITLE });
  await card.getByRole('button', { name: 'Usa con Copilota', exact: true }).click();
  let composer = page.locator('[data-testid="library-copilot-composer"]');
  await expect(composer).toBeVisible();
  await expectExistingCopilotBindings(composer, { sourceTitle: SOURCE_TITLE });
  const disclosure = await openPrepareFromIntent(composer);
  await disclosure.getByRole('button', { name: 'Classifica come materiale professionale', exact: true }).click();

  await expect(disclosure.getByText('Browser Provider LIB-01E', { exact: true })).toBeVisible();
  const consent = disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true });
  await assertAtLeast44(consent, 'mobile one-shot consent');
  await consent.click();
  const prepare = disclosure.getByRole('button', { name: 'Prepara attività', exact: true });
  await assertAtLeast44(prepare, 'mobile prepare action');
  await prepare.click();

  await requestStarted;
  expect(proposalBodies).toHaveLength(1);

  // A new explicit launch context must dispose the old request/result rather than accepting it late.
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
  await contextSelect.selectOption({ label: ALT_UDA_TITLE });
  await expect(contextSelect).toHaveValue(/.+/);
  await card.getByRole('button', { name: 'Usa con Copilota', exact: true }).click();
  composer = page.locator('[data-testid="library-copilot-composer"]');
  await expect(composer).toBeVisible();
  const relaunchedDisclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  await expect(relaunchedDisclosure).toHaveCount(0);

  releaseResponse();
  await page.waitForTimeout(350);

  await expect(relaunchedDisclosure.getByRole('region', { name: 'Proposta didattica' })).toHaveCount(0);
  await expect(relaunchedDisclosure.getByRole('heading', { name: PROPOSAL_TITLE, exact: true })).toHaveCount(0);
  expect(proposalBodies).toHaveLength(1);

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

  await page.screenshot({
    path: path.join(evidenceDir, 'lib01e-governed-provider-runtime-mobile.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib01e-governed-provider-runtime-mobile.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 390, height: 844 },
      proposalRequestCount: proposalBodies.length,
      checks: [
        'provider-recipient-visible-before-consent',
        'request-started-under-first-context',
        'context-change-aborts-pending-generation',
        'stale-result-not-rendered',
        'new-consent-required-after-context-change',
        'provider-model-student-fields-excluded-from-request',
        'mobile-touch-targets-and-horizontal-overflow'
      ],
      overflow,
      pageErrors,
      consoleErrors
    }, null, 2) + '\n'
  );

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await context.close();
});