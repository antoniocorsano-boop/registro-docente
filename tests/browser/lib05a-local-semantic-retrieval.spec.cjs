const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lib05a-browser-qualification';
const CLASS_NAME = 'Classe Sintetica LIB-05A';
const UDA_TITLE = 'UDA Sintetica LIB-05A';
const WIND_TITLE = 'Energia dal vento LIB-05A';
const DRAWING_TITLE = 'Disegno tecnico LIB-05A';

const WIND_TEXT = 'Turbina e generatore trasformano il vento in energia elettrica.';
const DRAWING_TEXT = 'Proiezioni ortogonali e rappresentazione geometrica di un oggetto tecnico.';

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

async function addSyntheticSource(page, title, content) {
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(title);
  await page.getByLabel('Contenuto').fill(content);
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function sourceCard(page, title) {
  const heading = page.getByRole('heading', { name: title, exact: true });
  await expect(heading).toBeVisible();
  return heading.locator('xpath=ancestor::article');
}

async function classifyProfessional(page, title) {
  const card = await sourceCard(page, title);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  const udaSelect = card.getByLabel('UDA corrente');
  if (!(await udaSelect.isVisible().catch(() => false))) {
    const changeContext = card.getByRole('button', { name: 'Cambia', exact: true });
    await expect(changeContext).toBeVisible();
    await changeContext.click();
  }
  await expect(udaSelect).toBeVisible();
  await udaSelect.selectOption({ label: UDA_TITLE });
  const classify = card.getByRole('button', { name: 'Classifica come materiale professionale', exact: true });
  await expect(classify).toBeVisible();
  await classify.click();
  await expect(classify).toHaveCount(0);
  await expect(card.getByText('Prepara una proposta didattica', { exact: true })).toBeVisible();
}

async function assertAtLeast44(locator, label) {
  await expect(locator, `${label} visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} bounding box`).not.toBeNull();
  expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44);
  expect(box.width, `${label} width`).toBeGreaterThanOrEqual(44);
}

function semanticVectorFor(text) {
  const value = String(text || '').toLowerCase();
  if (value.includes('rappresentazione geometrica')) return [0, 1];
  if (value.includes('disegno tecnico') || value.includes('proiezioni ortogonali')) return [0.02, 0.98];
  if (value.includes('trasformazione energia elettrica')) return [1, 0];
  if (value.includes('energia dal vento') || value.includes('turbina') || value.includes('generatore')) return [0.98, 0.02];
  return [0.2, 0.2];
}

async function installLocalEmbeddingRoute(page, requests) {
  await page.route('http://127.0.0.1:8080/**', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'content-type,authorization',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        }
      });
      return;
    }

    const url = new URL(request.url());
    if (url.pathname !== '/v1/embeddings') {
      await route.fulfill({
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: 'not found'
      });
      return;
    }

    const body = request.postDataJSON();
    requests.push({ url: request.url(), input: body.input, model: body.model });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        data: [{ embedding: semanticVectorFor(body.input) }],
        model: 'browser-local-lib05a'
      })
    });
  });
}

async function installProviderMetadataRoute(page) {
  await page.route('**/api/copilot/library-proposal/provider', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ available: false })
    });
  });
}

test('LIB-05A semantic search is explicit, local-only, ranked and stale-safe — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const localEmbeddingRequests = [];
  const proxyEmbeddingRequests = [];
  const remoteEmbeddingRequests = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('request', request => {
    if (request.url().includes('generativelanguage.googleapis.com')) remoteEmbeddingRequests.push(request.url());
  });

  await installLocalEmbeddingRoute(page, localEmbeddingRequests);
  await page.route('**/api/embeddings/generate', async route => {
    proxyEmbeddingRequests.push(route.request().url());
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'proxy should not be used' }) });
  });
  await installProviderMetadataRoute(page);

  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createActiveSyntheticUda(page);
  await openLibrary(page);
  await addSyntheticSource(page, WIND_TITLE, WIND_TEXT);
  await addSyntheticSource(page, DRAWING_TITLE, DRAWING_TEXT);
  await classifyProfessional(page, WIND_TITLE);
  await classifyProfessional(page, DRAWING_TITLE);

  const disclosure = page.getByTestId('library-semantic-search-disclosure');
  await expect(disclosure).toBeVisible();
  await expect(disclosure).not.toHaveAttribute('open', '');

  const search = page.locator('#library-search');
  await search.fill('proiezioni ortogonali');
  await expect(page.getByRole('heading', { name: DRAWING_TITLE, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: WIND_TITLE, exact: true })).toHaveCount(0);
  expect(localEmbeddingRequests).toHaveLength(0);
  expect(proxyEmbeddingRequests).toHaveLength(0);
  expect(remoteEmbeddingRequests).toHaveLength(0);

  await search.fill('trasformazione energia elettrica');
  expect(localEmbeddingRequests).toHaveLength(0);
  await disclosure.locator('summary').click();
  const run = page.getByTestId('library-semantic-search-run');
  await expect(run).toBeVisible();
  await run.click();

  const results = page.getByTestId('library-semantic-results');
  await expect(results).toBeVisible();
  await expect(results.getByRole('heading', { name: WIND_TITLE, exact: true })).toBeVisible();
  await expect(results.getByText('Pertinenza semantica', { exact: true })).toHaveCount(1);
  await expect(results.getByRole('heading', { name: DRAWING_TITLE, exact: true })).toHaveCount(0);
  expect(localEmbeddingRequests).toHaveLength(3);
  expect(proxyEmbeddingRequests).toHaveLength(0);
  expect(remoteEmbeddingRequests).toHaveLength(0);

  await search.fill('rappresentazione geometrica');
  await expect(results).toHaveCount(0);
  expect(localEmbeddingRequests).toHaveLength(3);

  // Make the local engine unavailable only after a successful query. A new query must fail retryably
  // without falling back to Gemini, and the ordinary textual search must remain usable.
  await page.unroute('http://127.0.0.1:8080/**');
  await page.route('http://127.0.0.1:8080/**', async route => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'content-type,authorization',
          'Access-Control-Allow-Methods': 'POST,OPTIONS'
        }
      });
      return;
    }
    await route.fulfill({ status: 503, headers: { 'Access-Control-Allow-Origin': '*' }, body: 'unavailable' });
  });
  await page.unroute('**/api/embeddings/generate');
  await page.route('**/api/embeddings/generate', async route => {
    proxyEmbeddingRequests.push(route.request().url());
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'local proxy unavailable' }) });
  });

  await run.click();
  await expect(page.getByRole('alert')).toHaveText('Il motore locale non risponde. Puoi riprovare; la ricerca normale resta disponibile.');
  expect(remoteEmbeddingRequests).toHaveLength(0);
  await expect(page.getByRole('heading', { name: DRAWING_TITLE, exact: true })).toBeVisible();

  await page.screenshot({
    path: path.join(evidenceDir, 'lib05a-local-semantic-retrieval-desktop.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib05a-local-semantic-retrieval-desktop.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 1280, height: 900 },
      directLocalEmbeddingRequests: localEmbeddingRequests.length,
      localProxyRequestsAfterForcedFailure: proxyEmbeddingRequests.length,
      remoteEmbeddingRequests: remoteEmbeddingRequests.length,
      pageErrors,
      checks: [
        'semantic-disclosure-closed-by-default',
        'text-search-does-not-call-embedding',
        'semantic-run-is-explicit',
        'professional-source-ranked-by-local-vector',
        'no-gemini-fallback',
        'query-change-invalidates-stale-result',
        'local-engine-failure-is-retryable',
        'text-search-remains-usable-after-semantic-failure'
      ]
    }, null, 2) + '\n'
  );

  expect(pageErrors).toEqual([]);
});

test('LIB-05A semantic disclosure stays touch-safe and overflow-free — mobile 390x844', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const localEmbeddingRequests = [];
  await installLocalEmbeddingRoute(page, localEmbeddingRequests);

  await setupFreshVault(page);
  await openLibrary(page);
  const search = page.locator('#library-search');
  await search.fill('energia');

  const disclosure = page.getByTestId('library-semantic-search-disclosure');
  await assertAtLeast44(disclosure.locator('summary'), 'semantic disclosure');
  await disclosure.locator('summary').click();
  const run = page.getByTestId('library-semantic-search-run');
  await assertAtLeast44(run, 'semantic search button');
  expect(localEmbeddingRequests).toHaveLength(0);

  await run.click();
  await expect(disclosure.getByText('Non ci sono ancora fonti professionali con testo utilizzabile per questa ricerca.', { exact: true })).toBeVisible();
  expect(localEmbeddingRequests).toHaveLength(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.screenshot({
    path: path.join(evidenceDir, 'lib05a-local-semantic-retrieval-mobile.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib05a-local-semantic-retrieval-mobile.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 390, height: 844 },
      localEmbeddingRequests: localEmbeddingRequests.length,
      horizontalOverflowPx: overflow,
      checks: [
        'semantic-disclosure-touch-safe',
        'semantic-run-touch-safe',
        'empty-library-fails-before-embedding',
        'no-horizontal-overflow'
      ]
    }, null, 2) + '\n'
  );
});
