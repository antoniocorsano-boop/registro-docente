const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lib01e-disclosure-review';
const UDA_TITLE = 'UDA Disclosure LIB-01E';
const SOURCE_TITLE = 'Fonte Disclosure LIB-01E';

async function setupFreshVault(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function openDrawerItem(page, label) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const drawer = page.getByRole('complementary');
  const item = drawer.getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

async function createSyntheticUda(page) {
  await openDrawerItem(page, 'UDA');
  const udaViewToggle = page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'UDA', exact: true });
  if (await udaViewToggle.isVisible().catch(() => false)) await udaViewToggle.click();
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(UDA_TITLE);
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(UDA_TITLE, { exact: true }).first()).toBeVisible();
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
  await page.getByLabel('Contenuto').fill('Fonte professionale sintetica per verificare la disclosure del destinatario remoto.');
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();
}

async function sourceCard(page) {
  const heading = page.getByRole('heading', { name: SOURCE_TITLE, exact: true });
  await expect(heading).toBeVisible();
  return heading.locator('xpath=ancestor::article');
}

test('LIB-01E keeps one-shot consent fail-closed until provider disclosure succeeds and allows explicit metadata retry', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  let metadataAttempts = 0;
  let markFirstStarted;
  const firstStarted = new Promise(resolve => {
    markFirstStarted = resolve;
  });
  let releaseFirst;
  const firstGate = new Promise(resolve => {
    releaseFirst = resolve;
  });

  await page.route('**/api/copilot/library-proposal/provider', async route => {
    metadataAttempts += 1;
    if (metadataAttempts === 1) {
      markFirstStarted();
      await firstGate;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'synthetic metadata failure' })
      });
      return;
    }

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

  await setupFreshVault(page);
  await createSyntheticUda(page);
  await openLibrary(page);
  await addSyntheticSource(page);

  const card = await sourceCard(page);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  await card.getByLabel('UDA corrente').selectOption({ label: UDA_TITLE });
  await card.getByRole('button', { name: 'Classifica come materiale professionale', exact: true }).click();

  await firstStarted;
  const consent = card.getByRole('button', { name: 'Consenti per questa richiesta', exact: true });
  await expect(consent).toBeVisible();
  await expect(consent).toBeDisabled();
  await expect(card.getByText('Browser Provider LIB-01E', { exact: true })).toHaveCount(0);

  releaseFirst();
  await expect(card.getByText('Non è stato possibile verificare il servizio remoto configurato.', { exact: true })).toBeVisible();
  await expect(consent).toBeDisabled();

  const retry = card.getByRole('button', { name: 'Riprova verifica servizio', exact: true });
  await expect(retry).toBeVisible();
  await retry.click();

  await expect(card.getByText('Browser Provider LIB-01E', { exact: true })).toBeVisible();
  await expect(card).toContainText('browser-fixture-v1');
  await expect(consent).toBeEnabled();
  expect(metadataAttempts).toBe(2);

  const unexpectedConsoleErrors = consoleErrors.filter(message =>
    !/^Failed to load resource: the server responded with a status of 503 \(/.test(message)
  );

  await page.screenshot({
    path: path.join(evidenceDir, 'lib01e-provider-disclosure-review.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib01e-provider-disclosure-review.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      metadataAttempts,
      pageErrors,
      expectedSyntheticConsoleErrors: consoleErrors.filter(message => !unexpectedConsoleErrors.includes(message)),
      unexpectedConsoleErrors
    }, null, 2) + '\n'
  );

  expect(pageErrors).toEqual([]);
  expect(unexpectedConsoleErrors).toEqual([]);
});
