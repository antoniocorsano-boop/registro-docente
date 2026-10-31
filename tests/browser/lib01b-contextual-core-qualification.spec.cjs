const { test, expect } = require('@playwright/test');
const { selectLibraryUseTarget, libraryUseAction } = require('./library-use-surface-helpers.cjs');
const { expectDirectCopilotLaunch } = require('./teacher-first-copilot-helpers.cjs');
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

async function handoffToComposer(page, card, intent = 'review') {
  await libraryUseAction(card, intent).click();
  const composer = page.locator('[data-testid="library-copilot-composer"]');
  await expectDirectCopilotLaunch(composer, { intent, sourceCard: card });
  return composer;
}

test('LIB-01B hands contextual source actions to Copilot and gates durable UDA linking — desktop 1280x900', async ({ page }) => {
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

  // Reload clears ephemeral selection: contextual handoff controls must not be visible by default.
  await reloadAndUnlock(page);
  await openLibrary(page);
  const card = await sourceCard(page);
  await expect(card.getByLabel('Dove vuoi usarlo?')).toHaveCount(0);
  await expect(libraryUseAction(card, 'prepare')).toHaveCount(0);
  await expect(libraryUseAction(card, 'review')).toHaveCount(0);
  await expect(libraryUseAction(card, 'link')).toHaveCount(0);
  await expect(page.locator('[data-testid="library-copilot-composer"]')).toHaveCount(0);

  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  const currentTarget = await selectLibraryUseTarget(card, { udaTitle: UDA_TITLE });
  await expect(currentTarget).toBeVisible();
  await expect(libraryUseAction(card, 'prepare')).toBeVisible();
  await expect(libraryUseAction(card, 'review')).toBeVisible();
  await expect(libraryUseAction(card, 'link')).toBeVisible();
  trackContextualRequests = true;
  let composer = await handoffToComposer(page, card, 'review');
  await expect(composer.getByTestId('library-copilot-review-panel')).toBeVisible();
  await expect(composer.getByTestId('library-copilot-link-action')).toHaveCount(0);
  await expect(composer.getByTestId('library-copilot-prepare-disclosure')).toHaveCount(0);
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  composer = await handoffToComposer(page, card, 'link');
  const linkAction = composer.getByTestId('library-copilot-link-action');
  await linkAction.click();
  const confirmation = composer.getByTestId('library-copilot-link-confirmation');
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByText(`Destinazione: UDA · ${UDA_TITLE}`, { exact: true })).toBeVisible();

  // The first LINK dispatch must not mutate the Library; the pending confirmation can be retried.
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
  await card.getByText('Gestisci', { exact: true }).click();
  await expect(card.getByRole('button', { name: 'Scollega', exact: true })).toHaveCount(0);

  composer = await page.locator('[data-testid="library-copilot-composer"]').count()
    ? page.locator('[data-testid="library-copilot-composer"]')
    : null;
  if (!composer) {
    const trigger = page.locator('[data-testid="library-copilot-trigger"]');
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByTestId('copilot-deck')).toBeVisible();
    await page.getByRole('button', { name: 'Parla con il Copilota', exact: true }).click();
    composer = page.locator('[data-testid="library-copilot-composer"]');
  }
  await expect(composer).toBeVisible();
  await expect(composer.getByTestId('library-copilot-link-confirmation')).toBeVisible();
  await composer.getByRole('button', { name: 'Conferma collegamento', exact: true }).click();
  await expect(composer.getByText('Il collegamento è stato salvato nella Biblioteca.', { exact: true })).toBeVisible();
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  const linkedCard = await sourceCard(page);
  const linkedRow = linkedCard.getByRole('button', { name: 'Scollega', exact: true }).locator('xpath=..');
  await expect(linkedRow.getByText(UDA_TITLE, { exact: true })).toBeVisible();

  trackContextualRequests = false;
  await reloadAndUnlock(page);
  await openLibrary(page);
  const reloadedCard = await sourceCard(page);
  await reloadedCard.getByText('Gestisci', { exact: true }).click();
  const reloadedRow = reloadedCard.getByRole('button', { name: 'Scollega', exact: true }).locator('xpath=..');
  await expect(reloadedRow.getByText(UDA_TITLE, { exact: true })).toBeVisible();

  await page.screenshot({
    path: path.join(evidenceDir, 'lib01b-copilot-contextual-desktop.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib01b-copilot-contextual-desktop.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 1280, height: 900 },
      checks: [
        'contextual-controls-hidden-before-use',
        'explicit-uda-context-before-copilot-handoff',
        'review-utterance-resolves-review-only',
        'link-requires-human-confirmation',
        'no-write-before-explicit-confirmation',
        'durable-link-visible-after-confirmation',
        'link-persists-after-reload',
        'no-contextual-external-network'
      ],
      contextualExternalRequests,
      pageErrors
    }, null, 2) + '\n'
  );

  expect(contextualExternalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('LIB-01B Copilot handoff and LINK controls stay touch-safe and overflow-free — mobile 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await setupFreshVault(page);
  await createSyntheticUda(page);
  await openLibrary(page);
  await addSyntheticSource(page);

  const card = await sourceCard(page);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  const currentTarget = await selectLibraryUseTarget(card, { udaTitle: UDA_TITLE });
  await expect(currentTarget).toBeVisible();

  const handoff = libraryUseAction(card, 'review');
  await assertAtLeast44(handoff, 'mobile REVIEW handoff');
  let composer = await handoffToComposer(page, card, 'review');
  await assertAtLeast44(composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }), 'mobile Copilot close after REVIEW');
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();

  const linkHandoff = libraryUseAction(card, 'link');
  await assertAtLeast44(linkHandoff, 'mobile LINK handoff');
  composer = await handoffToComposer(page, card, 'link');
  const linkAction = composer.getByTestId('library-copilot-link-action');
  await assertAtLeast44(linkAction, 'mobile Copilot LINK action');
  await linkAction.click();

  const confirmation = composer.getByTestId('library-copilot-link-confirmation');
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByText(`Destinazione: UDA · ${UDA_TITLE}`, { exact: true })).toBeVisible();
  const confirmButton = confirmation.getByRole('button', { name: 'Conferma collegamento', exact: true });
  const cancelButton = confirmation.getByRole('button', { name: 'Annulla', exact: true });
  await assertAtLeast44(confirmButton, 'mobile confirm LINK');
  await assertAtLeast44(cancelButton, 'mobile cancel LINK');

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

  await cancelButton.click();
  await expect(confirmation).toBeHidden();
  await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
  await card.getByText('Gestisci', { exact: true }).click();
  await expect(card.getByRole('button', { name: 'Scollega', exact: true })).toHaveCount(0);

  await page.screenshot({
    path: path.join(evidenceDir, 'lib01b-copilot-contextual-mobile.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib01b-copilot-contextual-mobile.json'),
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