const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lsm01c-browser-qualification';
const tokenSentinel = 'lsm01c-session-token-sentinel';
const SOURCE_TITLE = 'Fonte sintetica LSM-01C';
const SOURCE_TEXT = 'Materiale professionale sintetico per verificare la continuità della ricerca testuale.';
const MOBILE_CLASS_NAME = 'Classe Sintetica LSM-01C-B';
const MOBILE_UDA_TITLE = 'UDA Sintetica LSM-01C-B';

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

async function openSettings(page) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const item = page.getByRole('complementary').getByRole('button', { name: 'Impostazioni', exact: true });
  await expect(item).toBeVisible();
  await item.click();
  await expect(page.getByTestId('semantic-memory-settings')).toBeVisible();
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

async function createMobileSyntheticClass(page) {
  page.once('dialog', dialog => dialog.accept(MOBILE_CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${MOBILE_CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);
}

async function createMobileSyntheticUda(page) {
  await openDrawerItem(page, 'UDA');
  await page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'UDA', exact: true }).click();
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(MOBILE_UDA_TITLE);
  await dialog.getByRole('combobox', { name: 'Classe', exact: true }).selectOption({ label: MOBILE_CLASS_NAME });
  await dialog.getByLabel('Mese Inizio').selectOption('0');
  await dialog.getByLabel('Durata Mesi').fill('10');
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(MOBILE_UDA_TITLE, { exact: true }).first()).toBeVisible();
}

async function sourceCard(page, title) {
  const heading = page.getByRole('heading', { name: title, exact: true });
  await expect(heading).toBeVisible();
  return heading.locator('xpath=ancestor::article');
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
  expect(loopbackRequests).toHaveLength(0);

  await openSettings(page);
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

  await openLibrary(page);
  const disclosure = page.getByTestId('library-semantic-search-disclosure');
  await expect(disclosure).toBeVisible();
  await expect(disclosure).not.toHaveAttribute('open', '');
  await disclosure.locator('summary').click();
  await expect(page.getByTestId('semantic-memory-settings')).toHaveCount(0);

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

test('LSM-01C-B mobile Library action handoff enters PREPARE without a second Continua', async ({ page }) => {
  const proposalRequests = [];
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (request.method() === 'POST' && pathname === '/api/copilot/library-proposal') proposalRequests.push(request.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await setupFreshVault(page);
  await createMobileSyntheticClass(page);
  await createMobileSyntheticUda(page);
  await openLibrary(page);
  await addSyntheticSource(page);

  const card = await sourceCard(page, SOURCE_TITLE);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  await expect(card.getByText('Dove vuoi usarlo?', { exact: true })).toBeVisible();

  const changeContext = card.getByRole('button', { name: 'Cambia', exact: true });
  if (await changeContext.isVisible().catch(() => false)) await changeContext.click();
  const contextSelect = card.getByLabel('Dove vuoi usarlo?');
  await expect(contextSelect).toHaveCount(1);
  await expect(contextSelect).toBeVisible();
  if (!(await contextSelect.inputValue())) {
    const options = await contextSelect.locator('option').evaluateAll(nodes => nodes.map(node => ({ value: node.value, text: node.textContent || '' })));
    const target = options.find(option => option.value && option.text.includes(MOBILE_UDA_TITLE));
    expect(target).toBeTruthy();
    await contextSelect.selectOption(target.value);
  }
  await expect(contextSelect.locator('option:checked')).toContainText(MOBILE_CLASS_NAME);
  expect(proposalRequests).toEqual([]);

  await card.getByRole('button', { name: 'Prepara un’attività', exact: true }).click();
  const composer = page.getByTestId('library-copilot-composer');
  await expect(composer).toBeVisible();
  await expect(composer.getByText('Preparazione assistita', { exact: true })).toBeVisible();
  await expect(composer).toHaveCSS('position', 'fixed');
  const composerBox = await composer.boundingBox();
  expect(composerBox).toBeTruthy();
  expect(Math.abs(composerBox.height - 844)).toBeLessThanOrEqual(2);
  expect(Math.abs(composerBox.y)).toBeLessThanOrEqual(2);
  const composerScroll = composer.getByTestId('library-copilot-scroll');
  await expect(composerScroll).toHaveCount(1);
  await expect(composerScroll).toHaveCSS('overflow-y', 'auto');
  await expect(page.getByTestId('library-copilot-trigger')).toBeHidden();

  const classify = composer.getByRole('button', { name: 'Classifica come materiale professionale', exact: true });
  await expect(classify).toBeVisible();
  await expect(composer.getByRole('button', { name: /^Continua$/ })).toHaveCount(0);

  await classify.click();
  await expect(composer.getByText('Preparazione assistita', { exact: true })).toBeVisible();
  expect(proposalRequests).toEqual([]);
  const consent = composer.getByRole('button', { name: 'Consenti per questa richiesta', exact: true });
  await expect(consent).toBeVisible();
  await expect(consent).toHaveCount(1);
  await expect(composer.getByRole('button', { name: /^Continua$/ })).toHaveCount(0);

  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
  await expect(composer).toBeHidden();
  const useSurface = card.getByTestId('library-source-use-surface');
  await expect(useSurface).toBeVisible();
  await expect(useSurface).toHaveCSS('position', 'fixed');
  const useSurfaceBox = await useSurface.boundingBox();
  expect(useSurfaceBox).toBeTruthy();
  expect(Math.abs(useSurfaceBox.height - 844)).toBeLessThanOrEqual(2);
  expect(Math.abs(useSurfaceBox.y)).toBeLessThanOrEqual(2);
  await expect(useSurface.getByRole('button', { name: 'Chiudi uso materiale', exact: true })).toBeVisible();
});

