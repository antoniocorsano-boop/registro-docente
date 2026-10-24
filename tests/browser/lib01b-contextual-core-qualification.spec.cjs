const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lib01b-browser-qualification';
const UDA_TITLE = 'UDA Sintetica LIB-01B';
const SOURCE_TITLE = 'Fonte sintetica contestuale LIB-01B';

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

async function openDrawerItem(page, label) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const item = page.getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

async function openLibrary(page) {
  await openDrawerItem(page, 'Biblioteca privata');
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
}

async function createSyntheticUda(page) {
  await openDrawerItem(page, 'UDA');
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(UDA_TITLE);
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(UDA_TITLE, { exact: true }).first()).toBeVisible();
}

async function addSyntheticSource(page) {
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(SOURCE_TITLE);
  await page.getByLabel('Contenuto').fill('Contenuto sintetico locale per verificare il percorso contestuale condiviso.');
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();
}

async function sourceCard(page) {
  const heading = page.getByRole('heading', { name: SOURCE_TITLE, exact: true });
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

test('LIB-01B progressively reveals shared Core actions and gates contextual UDA linking — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const pageErrors = [];
  const contextualExternalRequests = [];
  let trackContextualRequests = false;
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('request', request => {
    if (!trackContextualRequests) return;
    const url = request.url();
    if (!url.startsWith(baseURL) && !url.startsWith('data:') && !url.startsWith('blob:')) {
      contextualExternalRequests.push(url);
    }
  });

  await setupFreshVault(page);
  await createSyntheticUda(page);
  await openLibrary(page);
  await addSyntheticSource(page);

  // Reload clears ephemeral selection: advanced contextual actions must not be visible by default.
  await reloadAndUnlock(page);
  await openLibrary(page);
  await expect(page.getByText('Che cosa vuoi farne?', { exact: true })).toHaveCount(0);

  const card = await sourceCard(page);
  // Network guard begins exactly where the LIB-01B contextual flow begins. Existing shell assets are out of scope.
  trackContextualRequests = true;
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  await expect(card.getByText('Che cosa vuoi farne?', { exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Rivedi nel contesto', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Collega a una UDA', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Prepara materiale', exact: true })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Sintetizza la fonte', exact: true })).toHaveCount(0);

  await card.getByRole('button', { name: 'Rivedi nel contesto', exact: true }).click();
  await expect(card.getByText('Contesto locale', { exact: true })).toBeVisible();
  await expect(card.getByText('Privacy da verificare', { exact: true })).toBeVisible();

  await card.getByRole('button', { name: 'Collega a una UDA', exact: true }).click();
  await card.getByLabel('UDA di destinazione').selectOption({ label: UDA_TITLE });
  await card.getByRole('button', { name: 'Continua', exact: true }).click();
  await expect(card.getByText('Confermi il collegamento della fonte alla UDA selezionata?', { exact: true })).toBeVisible();

  // The first Core dispatch must not mutate the vertical state.
  await card.getByText('Gestisci', { exact: true }).click();
  await expect(card.getByRole('button', { name: 'Scollega', exact: true })).toHaveCount(0);

  await card.getByRole('button', { name: 'Conferma collegamento', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Scollega', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Collegate', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();

  await page.screenshot({
    path: path.join(evidenceDir, 'lib01b-contextual-core-desktop.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib01b-contextual-core-desktop.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 1280, height: 900 },
      checks: [
        'actions-hidden-before-use',
        'shared-core-actions-visible-after-use',
        'generative-actions-unavailable',
        'local-review',
        'human-confirmation-before-link',
        'link-visible-after-confirmed-dispatch',
        'no-contextual-external-network'
      ],
      contextualExternalRequests,
      pageErrors
    }, null, 2) + '\n'
  );

  expect(contextualExternalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('LIB-01B contextual disclosure stays touch-safe and overflow-free — mobile 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await setupFreshVault(page);
  await openLibrary(page);
  await addSyntheticSource(page);

  const card = await sourceCard(page);
  await expect(card.getByText('Che cosa vuoi farne?', { exact: true })).toBeVisible();
  await assertAtLeast44(card.getByRole('button', { name: 'Rivedi nel contesto', exact: true }), 'mobile review action');
  await assertAtLeast44(card.getByRole('button', { name: 'Collega a una UDA', exact: true }), 'mobile link action');
  await expect(card.getByRole('button', { name: 'Prepara materiale', exact: true })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Sintetizza la fonte', exact: true })).toHaveCount(0);

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

  await page.screenshot({
    path: path.join(evidenceDir, 'lib01b-contextual-core-mobile.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib01b-contextual-core-mobile.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 390, height: 844 },
      overflow,
      pageErrors
    }, null, 2) + '\n'
  );

  expect(pageErrors).toEqual([]);
  await context.close();
});
