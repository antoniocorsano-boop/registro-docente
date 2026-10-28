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

async function handoffToComposer(page, card) {
  await card.getByRole('button', { name: 'Usa con Copilota', exact: true }).click();
  const composer = page.locator('[data-testid="library-copilot-composer"]');
  await expect(composer).toBeVisible();
  return composer;
}

async function assertReviewOnlyPossibility(composer) {
  await composer.getByLabel('Che cosa vuoi farne?').fill(
    'rivedi questa fonte nel contesto della programmazione'
  );
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  await expect(composer.getByText('Possibilità autorizzate', { exact: true })).toBeVisible();
  await expect(composer.getByTestId('library-copilot-review-panel')).toBeVisible();
  await expect(composer.getByText('Revisione nel contesto', { exact: true })).toBeVisible();
  await expect(composer.getByRole('button', { name: 'Controlla nel contesto', exact: true })).toHaveCount(0);
  await expect(composer.getByTestId('library-copilot-link-action')).toHaveCount(0);
  await expect(composer.getByText('Prepara attività', { exact: true })).toHaveCount(0);
  await expect(composer.getByText('Sintetizza la fonte', { exact: true })).toHaveCount(0);
}

async function resolveLinkPossibility(composer) {
  await composer.getByLabel('Che cosa vuoi farne?').fill(
    'Collega questa fonte al lavoro didattico corrente.'
  );
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();
  await expect(composer.getByText('Possibilità autorizzate', { exact: true })).toBeVisible();
  await expect(composer.getByRole('button', { name: 'Controlla nel contesto', exact: true })).toHaveCount(0);
  await expect(composer.getByText('Prepara attività', { exact: true })).toHaveCount(0);
  await expect(composer.getByText('Sintetizza la fonte', { exact: true })).toHaveCount(0);
  await expect(composer.getByTestId('library-copilot-link-action')).toBeVisible();
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
  await expect(card.getByRole('button', { name: 'Usa con Copilota', exact: true })).toHaveCount(0);
  await expect(card.getByLabel('UDA corrente')).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Controlla nel contesto', exact: true })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Collega a una UDA', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-testid="library-copilot-composer"]')).toHaveCount(0);

  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  const currentUda = card.getByLabel('UDA corrente');
  await expect(currentUda).toBeVisible();
  await expect(card.getByRole('button', { name: 'Usa con Copilota', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Controlla nel contesto', exact: true })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Collega a una UDA', exact: true })).toHaveCount(0);

  // Select the teaching context explicitly before handing the source to the shared Copilot.
  await currentUda.selectOption({ label: UDA_TITLE });
  trackContextualRequests = true;
  let composer = await handoffToComposer(page, card);
  const sourceSelect = composer.getByLabel('Fonte della Biblioteca');
  await expect(sourceSelect.locator('option:checked')).toHaveText(SOURCE_TITLE);

  await assertReviewOnlyPossibility(composer);
  await resolveLinkPossibility(composer);

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
  const currentUda = card.getByLabel('UDA corrente');
  await expect(currentUda).toBeVisible();
  await currentUda.selectOption({ label: UDA_TITLE });

  const handoff = card.getByRole('button', { name: 'Usa con Copilota', exact: true });
  await assertAtLeast44(handoff, 'mobile source-to-Copilot handoff');
  const composer = await handoffToComposer(page, card);
  const sourceSelect = composer.getByLabel('Fonte della Biblioteca');
  await expect(sourceSelect.locator('option:checked')).toHaveText(SOURCE_TITLE);

  const submit = composer.getByRole('button', { name: 'Mostra le possibilità', exact: true });
  await assertAtLeast44(submit, 'mobile Copilot possibilities submit');
  await composer.getByLabel('Che cosa vuoi farne?').fill(
    'Collega questa fonte al lavoro didattico corrente.'
  );
  await submit.click();
  await expect(composer.getByText('Possibilità autorizzate', { exact: true })).toBeVisible();
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