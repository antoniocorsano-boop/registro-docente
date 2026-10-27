const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'aic-02-browser-red';
const CLASS_NAME = '3ª A Sintetica AIC-02';
const UDA_TITLE = 'Energia e centrale elettrica AIC-02';
const SOURCE_TITLE = 'Fonte centrale elettrica AIC-02';
const PROPOSAL_TITLE = 'Attività sulla centrale elettrica AIC-02';
const REAL_PHRASE = 'Prepara una attività per comprendere il funzionamento della centrale elettrica';

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
    title: PROPOSAL_TITLE,
    objective: 'Comprendere la catena delle trasformazioni energetiche.',
    teacherSetup: 'Predisporre uno schema sintetico della centrale.',
    studentTask: 'Ricostruire il percorso dell’energia e motivare i passaggi.',
    steps: ['Osserva lo schema', 'Ordina le trasformazioni', 'Confronta le conclusioni'],
    questions: ['Dove avviene la trasformazione principale?'],
    adaptationHint: 'Usare parole chiave e uno schema guidato.',
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

async function bootstrap(page) {
  await setupFreshVault(page);

  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);

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

  await openDrawerItem(page, 'Biblioteca privata');
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(SOURCE_TITLE);
  await page.getByLabel('Contenuto').fill('Materiale professionale sintetico sul funzionamento di una centrale elettrica.');
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();

  const heading = page.getByRole('heading', { name: SOURCE_TITLE, exact: true });
  await expect(heading).toBeVisible();
  const card = heading.locator('xpath=ancestor::article');
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

async function installRoutes(page) {
  await page.route('**/api/copilot/intent/provider', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'browser-fixture-v1' }) });
  });
  await page.route('**/api/copilot/intent', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ intent: intentEnvelope() }) });
  });
  await page.route('**/api/copilot/library-proposal/provider', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ available: true, provider: 'Browser Provider', model: 'browser-fixture-v1' }) });
  });
  await page.route('**/api/copilot/library-proposal', async route => {
    const body = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        proposal: proposalForRequest(body),
        receipt: {
          requestId: 'aic-02-red',
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

test('AIC-02 causal RED — compound PREPARE outcome is an explicit teacher choice', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  await installRoutes(page);
  const composer = await bootstrap(page);

  await composer.getByLabel('Che cosa vuoi farne?').fill(REAL_PHRASE);
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  const disclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  await expect(disclosure).toBeVisible();
  await disclosure.getByRole('button', { name: 'Classifica come materiale professionale', exact: true }).click();
  await disclosure.getByRole('button', { name: 'Consenti per questa richiesta', exact: true }).click();
  await disclosure.getByRole('button', { name: 'Prepara attività', exact: true }).click();

  const proposal = disclosure.getByRole('region', { name: 'Proposta didattica' });
  await expect(proposal).toBeVisible();
  await expect(proposal.getByRole('heading', { name: PROPOSAL_TITLE, exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(evidenceDir, 'aic-02-red-before-compound-choice.png'), fullPage: true });

  // This is the causal RED against main@21251b4c: the pre-AIC-02 product has no explicit compound outcome.
  await expect(proposal.getByRole('button', { name: "Adotta e aggiungi all'UDA", exact: true })).toBeVisible();
});
