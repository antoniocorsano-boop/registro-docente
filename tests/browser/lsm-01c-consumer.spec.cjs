const { test, expect } = require('@playwright/test');
const { selectLibraryUseTarget, libraryUseAction } = require('./library-use-surface-helpers.cjs');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lsm01c-browser-qualification';
const capabilitySentinel = 'lsm01d-ephemeral-capability-sentinel';
const SOURCE_TITLE = 'Fonte sintetica LSM-01C';
const SOURCE_TEXT = 'Materiale professionale sintetico per verificare la continuità della ricerca testuale.';
const MOBILE_CLASS_NAME = 'Classe Sintetica LSM-01C-B';
const MOBILE_UDA_TITLE = 'UDA Sintetica LSM-01C-B';
const ALT_UDA_TITLE = 'UDA Alternativa LSM-01C-B';
const ALT_SOURCE_TITLE = 'Fonte alternativa LSM-01C-B';

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

async function addNamedSyntheticSource(page, title, text = SOURCE_TEXT) {
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(title);
  await page.getByLabel('Contenuto').fill(text);
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function addSyntheticSource(page) {
  await addNamedSyntheticSource(page, SOURCE_TITLE);
}

async function closePersistenceConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await heading.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(heading).toBeHidden();
  }
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

async function createSyntheticUda(page, title = MOBILE_UDA_TITLE) {
  await openDrawerItem(page, 'UDA');
  await page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'UDA', exact: true }).click();
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(title);
  await dialog.getByRole('combobox', { name: 'Classe', exact: true }).selectOption({ label: MOBILE_CLASS_NAME });
  await dialog.getByLabel('Mese Inizio').selectOption('0');
  await dialog.getByLabel('Durata Mesi').fill('10');
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
}

async function createMobileSyntheticUda(page) {
  await createSyntheticUda(page, MOBILE_UDA_TITLE);
}

async function sourceCard(page, title) {
  const heading = page.getByRole('heading', { name: title, exact: true });
  await expect(heading).toBeVisible();
  return heading.locator('xpath=ancestor::article');
}

test('LSM-01C connection remains explicit and fails safely without device loopback', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const loopbackRequests = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await page.route('http://127.0.0.1:8765/**', async route => {
    const request = route.request();
    loopbackRequests.push({
      method: request.method(),
      url: request.url(),
      authorization: request.headers().authorization || null,
    });
    await route.abort('connectionrefused');
  });

  await setupFreshVault(page);
  expect(loopbackRequests).toHaveLength(0);

  await openSettings(page);
  const settings = page.getByTestId('semantic-memory-settings');
  await expect(settings).toBeVisible();
  await expect(settings.getByLabel('Endpoint locale')).toHaveValue('http://127.0.0.1:8765');
  await expect(settings.getByLabel('Token di sessione')).toHaveCount(0);
  await expect(settings.locator('input[type="password"]')).toHaveCount(0);
  expect(loopbackRequests).toHaveLength(0);

  const syncButton = settings.getByRole('button', { name: 'Sincronizza', exact: true });
  await expect(syncButton).toBeDisabled();
  await settings.getByRole('button', { name: 'Attiva memoria locale', exact: true }).click();

  await expect(settings.getByText('Connessione locale non disponibile. Controlla Termux e riprova.', { exact: true })).toBeVisible();
  expect(loopbackRequests).toHaveLength(1);
  expect(loopbackRequests[0].method).toBe('POST');
  expect(new URL(loopbackRequests[0].url).pathname).toBe('/v1/session');
  expect(loopbackRequests[0].authorization).toBeNull();
  await expect(syncButton).toBeDisabled();

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
    path: path.join(evidenceDir, 'lsm-01d-consumer-explicit-loopback-failure.png'),
    fullPage: true,
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lsm-01d-consumer-explicit-loopback-failure.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      loopbackRequestsBeforeGesture: 0,
      loopbackRequestsAfterGesture: loopbackRequests.length,
      bootstrapPath: new URL(loopbackRequests[0].url).pathname,
      bootstrapAuthorizationHeader: loopbackRequests[0].authorization,
      tokenFieldExposed: false,
      textualLibraryContinuity: true,
      pageErrors,
    }, null, 2),
  );

  expect(pageErrors).toEqual([]);
});

test('LSM-01D activation obtains one ephemeral capability without persistence or automatic sync', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const loopbackRequests = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await page.route('http://127.0.0.1:8765/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    loopbackRequests.push({
      method: request.method(),
      url: request.url(),
      authorization: request.headers().authorization || null,
    });
    if (pathname !== '/v1/session') {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': new URL(baseURL).origin,
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify({
        schema: 'trama.semantic-memory-session/v1',
        token: capabilitySentinel,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        health: {
          schema: 'trama.semantic-memory-health/v1',
          status: 'ready',
          protocolVersion: 1,
          modelId: 'embeddinggemma-2-local',
          dimensions: 768,
          indexRevision: '1',
        },
      }),
    });
  });

  await setupFreshVault(page);
  expect(loopbackRequests).toHaveLength(0);
  await openSettings(page);
  const settings = page.getByTestId('semantic-memory-settings');
  await expect(settings.getByLabel('Token di sessione')).toHaveCount(0);
  const syncButton = settings.getByRole('button', { name: 'Sincronizza', exact: true });
  await expect(syncButton).toBeDisabled();
  expect(loopbackRequests).toHaveLength(0);

  await settings.getByRole('button', { name: 'Attiva memoria locale', exact: true }).click();
  await expect(settings.getByText('Memoria locale connessa e pronta.', { exact: true })).toBeVisible();
  await expect(syncButton).toBeEnabled();
  await expect(settings.getByRole('button', { name: 'Disconnetti', exact: true })).toBeVisible();

  expect(loopbackRequests).toHaveLength(1);
  expect(loopbackRequests[0].method).toBe('POST');
  expect(new URL(loopbackRequests[0].url).pathname).toBe('/v1/session');
  expect(loopbackRequests[0].authorization).toBeNull();

  await page.waitForTimeout(150);
  expect(loopbackRequests).toHaveLength(1);
  const storageSnapshots = await page.evaluate(() => ({
    local: JSON.stringify({ ...window.localStorage }),
    session: JSON.stringify({ ...window.sessionStorage }),
  }));
  expect(storageSnapshots.local).not.toContain(capabilitySentinel);
  expect(storageSnapshots.session).not.toContain(capabilitySentinel);

  await page.screenshot({
    path: path.join(evidenceDir, 'lsm-01d-consumer-zero-token-ready.png'),
    fullPage: true,
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lsm-01d-consumer-zero-token-ready.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      loopbackRequestsBeforeGesture: 0,
      bootstrapRequests: loopbackRequests.length,
      bootstrapPath: new URL(loopbackRequests[0].url).pathname,
      bootstrapAuthorizationHeader: loopbackRequests[0].authorization,
      capabilityPersistedToLocalStorage: storageSnapshots.local.includes(capabilitySentinel),
      capabilityPersistedToSessionStorage: storageSnapshots.session.includes(capabilitySentinel),
      automaticSyncRequests: loopbackRequests.length - 1,
      pageErrors,
    }, null, 2),
  );

  expect(pageErrors).toEqual([]);
});

test('LSM-01D mobile activation sync and reload remain explicit and zero-token', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const appRequests = [];
  const preflightRequests = [];
  const upsertRequests = [];
  const issuedCapabilities = [];
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  const allowedOrigin = new URL(baseURL).origin;
  let currentCapability = null;

  const corsHeaders = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Private-Network': 'true',
    'Cache-Control': 'no-store',
  };

  await page.route('http://127.0.0.1:8765/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const record = {
      method: request.method(),
      path: pathname,
      authorization: request.headers().authorization || null,
    };

    if (request.method() === 'OPTIONS') {
      preflightRequests.push(record);
      await route.fulfill({ status: 204, headers: corsHeaders, body: '' });
      return;
    }

    appRequests.push(record);
    if (pathname === '/v1/session' && request.method() === 'POST') {
      currentCapability = `${capabilitySentinel}-${issuedCapabilities.length + 1}`;
      issuedCapabilities.push(currentCapability);
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          schema: 'trama.semantic-memory-session/v1',
          token: currentCapability,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          health: {
            schema: 'trama.semantic-memory-health/v1',
            status: 'ready',
            protocolVersion: 1,
            modelId: 'embeddinggemma-2-local',
            dimensions: 768,
            indexRevision: '1',
          },
        }),
      });
      return;
    }

    if (pathname === '/v1/health' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          schema: 'trama.semantic-memory-health/v1',
          status: 'ready',
          protocolVersion: 1,
          modelId: 'embeddinggemma-2-local',
          dimensions: 768,
          indexRevision: '1',
        }),
      });
      return;
    }

    if (pathname === '/v1/projections/upsert' && request.method() === 'POST') {
      const payload = request.postDataJSON();
      upsertRequests.push({
        authorization: record.authorization,
        expectedRevision: payload.expectedRevision,
        sourceId: payload.projection?.sourceId || null,
      });
      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          schema: 'trama.semantic-memory-upsert-receipt/v1',
          status: payload.expectedRevision === null ? 'inserted' : 'replaced',
          source: {
            sourceAppId: payload.projection.sourceAppId,
            sourceType: payload.projection.sourceType,
            sourceId: payload.projection.sourceId,
          },
          revision: payload.projection.revision,
        }),
      });
      return;
    }

    await route.abort('failed');
  });

  await setupFreshVault(page);
  expect(appRequests).toHaveLength(0);

  await openLibrary(page);
  await addNamedSyntheticSource(page, 'Fonte LSM-01D mobile', 'Materiale professionale sintetico per la qualifica della sincronizzazione locale.');
  const card = await sourceCard(page, 'Fonte LSM-01D mobile');
  await card.getByText('Gestisci', { exact: true }).click();
  const classify = card.getByRole('button', { name: 'Classifica come materiale professionale', exact: true });
  await expect(classify).toBeVisible();
  page.once('dialog', dialog => {
    expect(dialog.message()).toBe('Confermo che è materiale professionale del docente e non contiene dati personali degli studenti.');
    void dialog.accept();
  });
  await classify.click();
  await expect(card.getByText('Professionale', { exact: true })).toBeVisible();
  expect(appRequests).toHaveLength(0);

  await openSettings(page);
  let settings = page.getByTestId('semantic-memory-settings');
  await expect(settings.getByLabel('Token di sessione')).toHaveCount(0);
  let syncButton = settings.getByRole('button', { name: 'Sincronizza', exact: true });
  await expect(syncButton).toBeDisabled();
  expect(appRequests).toHaveLength(0);

  await settings.getByRole('button', { name: 'Attiva memoria locale', exact: true }).click();
  await expect(settings.getByText('Memoria locale connessa e pronta.', { exact: true })).toBeVisible();
  await expect(syncButton).toBeEnabled();
  expect(issuedCapabilities).toHaveLength(1);
  expect(appRequests).toHaveLength(1);
  expect(appRequests[0]).toEqual({ method: 'POST', path: '/v1/session', authorization: null });

  await page.waitForTimeout(150);
  expect(appRequests).toHaveLength(1);
  await syncButton.click();
  await expect(settings.getByText(/Indice locale (aggiornato|già allineato)/)).toBeVisible();
  await expect.poll(() => upsertRequests.length).toBeGreaterThan(0);
  expect(appRequests.filter(request => request.path === '/v1/health')).toHaveLength(1);
  expect(appRequests.find(request => request.path === '/v1/health')?.authorization).toBeNull();
  expect(upsertRequests.every(request => request.authorization === `Bearer ${issuedCapabilities[0]}`)).toBe(true);
  expect(upsertRequests.some(request => request.sourceId)).toBe(true);

  const storageBeforeReload = await page.evaluate(() => ({
    local: JSON.stringify({ ...window.localStorage }),
    session: JSON.stringify({ ...window.sessionStorage }),
  }));
  expect(storageBeforeReload.local).not.toContain(issuedCapabilities[0]);
  expect(storageBeforeReload.session).not.toContain(issuedCapabilities[0]);

  const appRequestCountBeforeReload = appRequests.length;
  await reloadAndUnlock(page);
  expect(appRequests).toHaveLength(appRequestCountBeforeReload);
  await openSettings(page);
  settings = page.getByTestId('semantic-memory-settings');
  await expect(settings.getByText('Non connessa. La Biblioteca continua a usare la ricerca locale già disponibile.', { exact: true })).toBeVisible();
  await expect(settings.getByLabel('Token di sessione')).toHaveCount(0);
  syncButton = settings.getByRole('button', { name: 'Sincronizza', exact: true });
  await expect(syncButton).toBeDisabled();
  expect(appRequests).toHaveLength(appRequestCountBeforeReload);

  await settings.getByRole('button', { name: 'Attiva memoria locale', exact: true }).click();
  await expect(settings.getByText('Memoria locale connessa e pronta.', { exact: true })).toBeVisible();
  await expect(syncButton).toBeEnabled();
  expect(issuedCapabilities).toHaveLength(2);
  expect(issuedCapabilities[1]).not.toBe(issuedCapabilities[0]);
  expect(appRequests).toHaveLength(appRequestCountBeforeReload + 1);
  expect(appRequests.at(-1)).toEqual({ method: 'POST', path: '/v1/session', authorization: null });
  await page.waitForTimeout(150);
  expect(appRequests).toHaveLength(appRequestCountBeforeReload + 1);

  const storageAfterReactivation = await page.evaluate(() => ({
    local: JSON.stringify({ ...window.localStorage }),
    session: JSON.stringify({ ...window.sessionStorage }),
  }));
  for (const capability of issuedCapabilities) {
    expect(storageAfterReactivation.local).not.toContain(capability);
    expect(storageAfterReactivation.session).not.toContain(capability);
  }

  await page.screenshot({
    path: path.join(evidenceDir, 'lsm-01d-mobile-sync-reload-reactivation.png'),
    fullPage: true,
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lsm-01d-mobile-sync-reload-reactivation.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 390, height: 844 },
      sessionBootstrapCount: issuedCapabilities.length,
      applicationRequests: appRequests,
      preflightCount: preflightRequests.length,
      upsertRequests: upsertRequests.map(request => ({
        ...request,
        authorization: request.authorization ? 'Bearer <ephemeral-capability>' : null,
      })),
      noProbeOnReload: appRequests.length === appRequestCountBeforeReload + 1,
      capabilityPersisted: issuedCapabilities.some(capability =>
        storageAfterReactivation.local.includes(capability) || storageAfterReactivation.session.includes(capability)
      ),
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
  const useButton = card.getByRole('button', { name: 'Usa', exact: true });
  const useSurface = card.getByTestId('library-source-use-surface');
  await expect(useSurface).toBeHidden();
  await expect(page.getByTestId('library-copilot-composer')).toHaveCount(0);
  await useButton.click();
  await expect(useSurface).toHaveAttribute('role', 'dialog');
  await expect(useSurface).toHaveAttribute('aria-modal', 'true');
  const useClose = useSurface.getByRole('button', { name: 'Chiudi uso materiale', exact: true });
  await expect(useClose).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await useSurface.evaluate(element => element.contains(document.activeElement))).toBe(true);
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
  await expect(page.getByTestId('library-copilot-composer')).toHaveCount(0);
  expect(proposalRequests).toEqual([]);

  await card.getByRole('button', { name: 'Prepara un’attività', exact: true }).click();
  const classificationGate = card.getByTestId('library-professional-classification-gate');
  await expect(classificationGate).toBeVisible();
  await expect(classificationGate.getByText('Prima di continuare', { exact: true })).toBeVisible();
  await expect(page.getByTestId('library-copilot-composer')).toHaveCount(0);
  page.once('dialog', dialog => {
    expect(dialog.message()).toBe('Confermo che è materiale professionale del docente e non contiene dati personali degli studenti.');
    void dialog.accept();
  });
  await classificationGate.getByRole('button', { name: 'Classifica come materiale professionale', exact: true }).click();

  const composer = page.getByTestId('library-copilot-composer');
  await expect(composer).toBeVisible();
  await expect(composer).toHaveAttribute('role', 'dialog');
  await expect(composer).toHaveAttribute('aria-modal', 'true');
  await expect(useSurface).not.toHaveAttribute('role', 'dialog');
  await expect(useSurface).not.toHaveAttribute('aria-modal', 'true');
  await expect(useSurface).toHaveAttribute('aria-hidden', 'true');
  await expect(useSurface).toHaveAttribute('inert', '');
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
  const composerClose = composer.getByRole('button', { name: 'Chiudi Copilota', exact: true });
  await expect(composerClose).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(await composer.evaluate(element => element.contains(document.activeElement))).toBe(true);
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

  await expect(composer.getByRole('button', { name: 'Classifica come materiale professionale', exact: true })).toHaveCount(0);
  await expect(composer.getByRole('button', { name: /^Continua$/ })).toHaveCount(0);
  await expect(composer.getByText('Preparazione assistita', { exact: true })).toBeVisible();
  expect(proposalRequests).toEqual([]);
  const consent = composer.getByRole('button', { name: 'Consenti per questa richiesta', exact: true });
  await expect(consent).toBeVisible();
  await expect(consent).toHaveCount(1);
  await expect(composer.getByRole('button', { name: /^Continua$/ })).toHaveCount(0);

  const dockPositionBeforeScroll = await consent.boundingBox();
  expect(dockPositionBeforeScroll).toBeTruthy();
  await expect(consent).toHaveCSS('position', 'fixed');
  await composerScroll.evaluate(element => {
    const spacer = document.createElement('div');
    spacer.dataset.testid = 'library-copilot-dock-scroll-fixture';
    spacer.setAttribute('aria-hidden', 'true');
    spacer.style.height = '1200px';
    spacer.style.pointerEvents = 'none';
    element.appendChild(spacer);
  });
  const scrollMetrics = await composerScroll.evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop
  }));
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
  await composerScroll.evaluate(element => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(async () => composerScroll.evaluate(element => element.scrollTop)).toBeGreaterThan(scrollMetrics.scrollTop);
  const dockPositionAfterScroll = await consent.boundingBox();
  expect(dockPositionAfterScroll).toBeTruthy();
  expect(Math.abs(dockPositionAfterScroll.y - dockPositionBeforeScroll.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(dockPositionAfterScroll.x - dockPositionBeforeScroll.x)).toBeLessThanOrEqual(1);
  expect(dockPositionAfterScroll.y + dockPositionAfterScroll.height).toBeLessThanOrEqual(844);

  await composerClose.click();
  await expect(composer).toBeHidden();
  await expect(useSurface).toHaveAttribute('role', 'dialog');
  await expect(useSurface).toHaveAttribute('aria-modal', 'true');
  await expect(useSurface).not.toHaveAttribute('aria-hidden', 'true');
  await expect(useSurface).not.toHaveAttribute('inert', '');
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
  await expect(card.getByRole('button', { name: 'Prepara un’attività', exact: true })).toBeFocused();
  await expect(useSurface).toBeVisible();
  await expect(useSurface).toHaveCSS('position', 'fixed');
  const useSurfaceBox = await useSurface.boundingBox();
  expect(useSurfaceBox).toBeTruthy();
  expect(Math.abs(useSurfaceBox.height - 844)).toBeLessThanOrEqual(2);
  expect(Math.abs(useSurfaceBox.y)).toBeLessThanOrEqual(2);
  await expect(useClose).toBeVisible();
  await useClose.click();
  await expect(useSurface).toBeHidden();
  await expect(useButton).toBeFocused();
});



test('LSM-01C-B direct launches settle exact source and teaching target across PREPARE REVIEW and LINK', async ({ page }) => {
  await setupFreshVault(page);
  await createMobileSyntheticClass(page);
  await createSyntheticUda(page, MOBILE_UDA_TITLE);
  await createSyntheticUda(page, ALT_UDA_TITLE);
  await openLibrary(page);
  await addNamedSyntheticSource(page, SOURCE_TITLE);
  await addNamedSyntheticSource(page, ALT_SOURCE_TITLE, 'Seconda fonte sintetica per forzare il cambio di binding tra lanci diretti.');

  const firstCard = await sourceCard(page, SOURCE_TITLE);
  const secondCard = await sourceCard(page, ALT_SOURCE_TITLE);
  const firstSourceId = await firstCard.getAttribute('data-source-id');
  const secondSourceId = await secondCard.getAttribute('data-source-id');
  expect(firstSourceId).toBeTruthy();
  expect(secondSourceId).toBeTruthy();
  expect(firstSourceId).not.toBe(secondSourceId);

  async function openUse(card, udaTitle) {
    const surface = card.getByTestId('library-source-use-surface');
    if (!(await surface.isVisible().catch(() => false))) {
      await card.getByRole('button', { name: 'Usa', exact: true }).click();
    }
    await expect(surface).toBeVisible();
    const select = await selectLibraryUseTarget(card, { udaTitle });
    await expect(page.getByTestId('library-copilot-composer')).toHaveCount(0);
    return { surface, target: await select.inputValue() };
  }

  async function expectBinding(composer, card, target) {
    await expect(composer).toBeVisible();
    await expect(composer).toHaveAttribute('data-source-id', await card.getAttribute('data-source-id'));
    await expect(composer).toHaveAttribute('data-teaching-target', target);
  }

  async function completeClassificationGateIfPresent(card) {
    const gate = card.getByTestId('library-professional-classification-gate');
    if (!(await gate.isVisible().catch(() => false))) return;
    await expect(page.getByTestId('library-copilot-composer')).toHaveCount(0);
    page.once('dialog', dialog => {
      expect(dialog.message()).toBe('Confermo che è materiale professionale del docente e non contiene dati personali degli studenti.');
      void dialog.accept();
    });
    await gate.getByRole('button', { name: 'Classifica come materiale professionale', exact: true }).click();
  }

  // Establish an initial binding, then force PREPARE to switch both source and UDA.
  let use = await openUse(firstCard, MOBILE_UDA_TITLE);
  await libraryUseAction(firstCard, 'prepare').click();
  await completeClassificationGateIfPresent(firstCard);
  let composer = page.getByTestId('library-copilot-composer');
  await expectBinding(composer, firstCard, use.target);
  await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toBeVisible();
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  use = await openUse(secondCard, ALT_UDA_TITLE);
  await libraryUseAction(secondCard, 'prepare').click();
  await completeClassificationGateIfPresent(secondCard);
  composer = page.getByTestId('library-copilot-composer');
  await expectBinding(composer, secondCard, use.target);
  await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toBeVisible();
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  // REVIEW must wait until the first source/target are rebound, not reuse the second launch.
  use = await openUse(firstCard, MOBILE_UDA_TITLE);
  await libraryUseAction(firstCard, 'review').click();
  await completeClassificationGateIfPresent(firstCard);
  composer = page.getByTestId('library-copilot-composer');
  await expectBinding(composer, firstCard, use.target);
  await expect(composer.getByTestId('library-copilot-review-panel')).toBeVisible();
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  // LINK switches both bindings again and the human-confirmation destination must be the requested UDA.
  use = await openUse(secondCard, ALT_UDA_TITLE);
  await libraryUseAction(secondCard, 'link').click();
  await completeClassificationGateIfPresent(secondCard);
  composer = page.getByTestId('library-copilot-composer');
  await expectBinding(composer, secondCard, use.target);
  const linkAction = composer.getByTestId('library-copilot-link-action');
  await expect(linkAction).toBeVisible();
  await linkAction.click();
  const confirmation = composer.getByTestId('library-copilot-link-confirmation');
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByText(`Destinazione: UDA · ${ALT_UDA_TITLE}`, { exact: true })).toBeVisible();
});

test('LSM-01C-B Library classifies an unknown professional source locally without opening Copilot', async ({ page }) => {
  const classificationTitle = 'Fonte classificazione locale LSM-01C-B';
  const copilotPostRequests = [];
  page.on('request', request => {
    const pathname = new URL(request.url()).pathname;
    if (request.method() === 'POST' && pathname.startsWith('/api/copilot/')) copilotPostRequests.push(request.url());
  });

  await setupFreshVault(page);
  await openLibrary(page);
  await addNamedSyntheticSource(page, classificationTitle, 'Materiale professionale sintetico senza dati personali degli studenti.');

  const card = await sourceCard(page, classificationTitle);
  await expect(card.getByText('Da classificare', { exact: true })).toBeVisible();
  await expect(page.getByTestId('library-copilot-composer')).toHaveCount(0);
  await card.getByText('Gestisci', { exact: true }).click();
  const classify = card.getByRole('button', { name: 'Classifica come materiale professionale', exact: true });
  await expect(classify).toBeVisible();

  page.once('dialog', dialog => {
    expect(dialog.message()).toBe('Confermo che è materiale professionale del docente e non contiene dati personali degli studenti.');
    void dialog.accept();
  });
  await classify.click();

  await expect(card.getByText('Professionale', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Classifica come materiale professionale', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('library-copilot-composer')).toHaveCount(0);
  expect(copilotPostRequests).toEqual([]);
});

