const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lib04b-browser-qualification';
const SOURCE_TITLE = 'Leve e vantaggio meccanico';

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(120000);

async function setupFreshVault(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function reloadAndUnlock(page, url = baseURL) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const unlockHeading = page.getByRole('heading', { name: 'Sblocca Registro' });
  if (await unlockHeading.isVisible().catch(() => false)) {
    await page.locator('#vault-password').fill(vaultPassword);
    await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  }
}

async function openComposer(page) {
  const trigger = page.locator('[data-testid="library-copilot-trigger"]');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const composer = page.locator('[data-testid="library-copilot-composer"]');
  await expect(composer).toBeVisible();
  return composer;
}

async function addTextSourceFromComposer(page, composer) {
  await composer.getByText('Aggiungi una nuova fonte', { exact: true }).click();
  await composer.getByRole('button', { name: 'Testo/idea', exact: true }).click();
  await composer.getByPlaceholder('Titolo della fonte').fill(SOURCE_TITLE);
  await composer.getByPlaceholder('Incolla un testo, un appunto o descrivi un’idea…').fill(
    'Una leva permette di discutere fulcro, forza resistente e vantaggio meccanico.'
  );
  await composer.getByRole('button', { name: 'Salva nella Biblioteca', exact: true }).click();

  const sourceSelect = composer.getByLabel('Fonte della Biblioteca');
  await expect(sourceSelect).not.toHaveValue('');
  await expect(sourceSelect.locator('option:checked')).toHaveText(SOURCE_TITLE);
}

test('LIB-04B captures durably and presents only Core-authorized fallback actions — desktop', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await setupFreshVault(page);
  let composer = await openComposer(page);
  await addTextSourceFromComposer(page, composer);

  await composer.getByLabel('Che cosa vuoi farne?').fill('Aiutami a usare questa fonte in una attività didattica.');
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();

  await expect(composer.getByText('Possibilità autorizzate', { exact: true })).toBeVisible();
  await expect(composer.getByText('L’interpretazione automatica dell’intento non è attiva.', { exact: false })).toBeVisible();
  await expect(composer.getByText('Rivedi nel contesto', { exact: true })).toBeVisible();
  await expect(composer.getByText('Collega a una UDA', { exact: true })).toBeVisible();
  await expect(composer.getByText('Prepara attività', { exact: true })).toHaveCount(0);
  await expect(composer.getByText('Sintetizza la fonte', { exact: true })).toHaveCount(0);
  await expect(composer.getByRole('button', { name: 'Rivedi nel contesto', exact: true })).toHaveCount(0);
  await expect(composer.getByRole('button', { name: 'Collega a una UDA', exact: true })).toHaveCount(0);

  await reloadAndUnlock(page);
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
  composer = await openComposer(page);
  await expect(composer.getByLabel('Fonte della Biblioteca').locator('option').filter({ hasText: SOURCE_TITLE })).toHaveCount(1);

  await page.screenshot({ path: path.join(evidenceDir, 'lib04b-copilot-composer-desktop.png'), fullPage: true });
  fs.writeFileSync(path.join(evidenceDir, 'lib04b-copilot-composer-desktop.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 1280, height: 900 },
    sourcePersistedAfterReload: true,
    pageErrors
  }, null, 2) + '\n');

  expect(pageErrors).toEqual([]);
});

test('LIB-04B composer stays closable, touch-safe and inside the 390x844 viewport', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await setupFreshVault(page);
  const trigger = page.locator('[data-testid="library-copilot-trigger"]');
  const triggerBox = await trigger.boundingBox();
  expect(triggerBox).not.toBeNull();
  expect(triggerBox.height).toBeGreaterThanOrEqual(44);
  await trigger.click();

  const composer = page.locator('[data-testid="library-copilot-composer"]');
  await expect(composer).toBeVisible();
  const closeButton = composer.getByRole('button', { name: 'Chiudi Copilota', exact: true });
  const closeBox = await closeButton.boundingBox();
  expect(closeBox).not.toBeNull();
  expect(closeBox.width).toBeGreaterThanOrEqual(44);
  expect(closeBox.height).toBeGreaterThanOrEqual(44);

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

  await page.screenshot({ path: path.join(evidenceDir, 'lib04b-copilot-composer-mobile.png'), fullPage: true });
  await closeButton.click();
  await expect(composer).toBeHidden();
  await expect(trigger).toBeVisible();

  fs.writeFileSync(path.join(evidenceDir, 'lib04b-copilot-composer-mobile.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || null,
    viewport: { width: 390, height: 844 },
    triggerBox,
    closeBox,
    overflow,
    pageErrors
  }, null, 2) + '\n');

  expect(pageErrors).toEqual([]);
  await context.close();
});
