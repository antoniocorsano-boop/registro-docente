const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lsm01c-browser-qualification';
const tokenSentinel = 'lsm01c-session-token-sentinel';
const SOURCE_TITLE = 'Fonte sintetica LSM-01C';
const SOURCE_TEXT = 'Materiale professionale sintetico per verificare la continuità della ricerca testuale.';

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(120000);

async function setupFreshVault(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function openLibrary(page) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const item = page.getByRole('complementary').getByRole('button', { name: 'Biblioteca privata', exact: true });
  await expect(item).toBeVisible();
  await item.click();
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
}

async function addSyntheticSource(page) {
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(SOURCE_TITLE);
  await page.getByLabel('Contenuto').fill(SOURCE_TEXT);
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();
}

test('LSM-01C connection is explicit, session-only and fails safely without device loopback', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const loopbackRequests = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await page.route('http://127.0.0.1:8765/**', async route => {
    loopbackRequests.push({
      method: route.request().method(),
      url: route.request().url(),
    });
    await route.abort('connectionrefused');
  });

  await setupFreshVault(page);
  await openLibrary(page);

  const disclosure = page.getByTestId('library-semantic-search-disclosure');
  await expect(disclosure).toBeVisible();
  await expect(disclosure).not.toHaveAttribute('open', '');
  expect(loopbackRequests).toHaveLength(0);

  await disclosure.locator('summary').click();
  const settings = page.getByTestId('semantic-memory-settings');
  await expect(settings).toBeVisible();
  await expect(settings.getByLabel('Endpoint locale')).toHaveValue('http://127.0.0.1:8765');
  const tokenInput = settings.getByLabel('Token di sessione');
  await expect(tokenInput).toHaveAttribute('type', 'password');
  await tokenInput.fill(tokenSentinel);
  expect(loopbackRequests).toHaveLength(0);

  const syncButton = settings.getByRole('button', { name: 'Sincronizza', exact: true });
  await expect(syncButton).toBeDisabled();
  await settings.getByRole('button', { name: 'Connetti memoria locale', exact: true }).click();

  await expect(settings.getByText('Connessione locale non disponibile. Controlla Termux e riprova.', { exact: true })).toBeVisible();
  expect(loopbackRequests.length).toBeGreaterThan(0);
  await expect(syncButton).toBeDisabled();

  const localStorageSnapshot = await page.evaluate(() => JSON.stringify({ ...window.localStorage }));
  expect(localStorageSnapshot).not.toContain(tokenSentinel);

  await addSyntheticSource(page);
  const search = page.locator('#library-search');
  await search.fill('continuità della ricerca testuale');
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();

  await page.screenshot({
    path: path.join(evidenceDir, 'lsm-01c-consumer-explicit-loopback.png'),
    fullPage: true,
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lsm-01c-consumer-explicit-loopback.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      loopbackRequestsBeforeGesture: 0,
      loopbackRequestsAfterGesture: loopbackRequests.length,
      loopbackMethods: loopbackRequests.map(request => request.method),
      tokenPersistedToLocalStorage: localStorageSnapshot.includes(tokenSentinel),
      textualLibraryContinuity: true,
      pageErrors,
    }, null, 2),
  );

  expect(pageErrors).toEqual([]);
});
