const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = process.env.EVIDENCE_DIR || '../browser-evidence';
const CLASS_NAME = '3ª A Sintetica INT-02';
const SOURCE_TITLE = 'Fonte esclusivamente sintetica INT-02';
const SOURCE_TEXT = 'Appunto professionale dimostrativo sulle energie rinnovabili.';

test.use({ viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' });
test.setTimeout(120000);

async function openDrawerItem(page, label) {
  const brand = page.getByTestId('header01-brand-navigation');
  await expect(brand).toBeVisible();
  await brand.click();
  const drawer = page.getByRole('complementary', { name: 'Navigazione del Registro' });
  await drawer.getByRole('button', { name: label, exact: true }).click();
}

async function expectNoHorizontalOverflow(page) {
  await expect.poll(async () => page.evaluate(() => {
    const root = document.documentElement;
    return Math.max(root.scrollWidth, document.body.scrollWidth) - root.clientWidth;
  })).toBeLessThanOrEqual(1);
}

// The drawer is marked aria-hidden before its 300ms slide-out completes.
// Visual evidence must be captured after it is entirely offscreen.
async function expectDrawerFullyOffscreen(page) {
  const drawer = page.locator('#registro-navigation-drawer');
  await expect(drawer).toHaveAttribute('aria-hidden', 'true');
  await expect.poll(async () => {
    const bounds = await drawer.boundingBox();
    return bounds ? bounds.x + bounds.width : 0;
  }).toBeLessThanOrEqual(1);
}

test('INT-02/S1: class-scoped professional source reaches unsaved test editor without UDA or URL payload', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill('synthetic-int02-s1-vault');
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();

  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  // A fresh class can open the existing durable-save acknowledgement.
  const saveNotice = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await saveNotice.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(saveNotice).toBeHidden();
  }

  await openDrawerItem(page, 'Biblioteca privata');
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(SOURCE_TITLE);
  await page.getByLabel('Contenuto').fill(SOURCE_TEXT);
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();

  await expect(page.getByTestId('int02-prepare-assessment')).toHaveCount(0);
  await page.getByText('Gestisci', { exact: true }).click();
  // HPR 2026-11-08: the long professional-classification control must not
  // push the source card and the whole document beyond the Android viewport.
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 390, height: 844 });
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Classifica come materiale professionale' }).click();
  await expect(page.getByText('Professionale', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Usa', exact: true }).click();
  const prepare = page.getByTestId('int02-prepare-assessment');
  await expect(prepare).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 320, height: 700 });
  await expectNoHorizontalOverflow(page);
  const bounds = await prepare.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(321);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
  await prepare.click();

  const handoff = page.getByTestId('int02-assessment-handoff');
  await expect(handoff).toBeVisible();
  await expect(handoff).toContainText(SOURCE_TITLE);
  await expect(handoff).toContainText(CLASS_NAME);
  await expect(handoff).toContainText('Non è stata creata alcuna verifica');

  // S2a: the S1 source/class handoff is authoritative, but never chooses a test.
  const shareClass = page.getByLabel('Classe Destinataria');
  const shareTest = page.getByLabel('Test per condivisione');
  const copyLink = page.getByRole('button', { name: 'Copia Link per Studenti' });
  const simulate = page.getByRole('button', { name: 'Prova come Alunno (Flashcard)' });
  await expect(shareClass).toHaveValue(CLASS_NAME);
  await expect(shareTest).toHaveValue('');
  await expect(copyLink).toBeDisabled();
  await expect(simulate).toBeDisabled();
  await expect(copyLink).not.toHaveClass(/neon-btn-primary/);
  await expect(copyLink).toHaveClass(/cursor-not-allowed/);
  await expect(simulate).toHaveClass(/opacity-60/);
  await shareTest.selectOption('energia');
  await expect(copyLink).toBeEnabled();
  await expect(simulate).toBeEnabled();
  await shareTest.selectOption('');
  await expect(copyLink).toBeDisabled();
  await expect(simulate).toBeDisabled();
  expect(page.url()).not.toContain(SOURCE_TITLE);
  expect(page.url()).not.toContain(SOURCE_TEXT);
  expect(page.url()).not.toContain('sourceId');

  await page.getByTestId('int02-open-assessment-editor').click();
  await expect(page.getByRole('heading', { name: 'Crea Nuova Verifica Formativa' })).toBeVisible();
  // S2b: permanent source provenance is opt-in, separate from the S1 route.
  const confirmOrigin = page.getByTestId('int02-s2b-confirm-origin');
  await expect(confirmOrigin).toBeVisible();
  await expect(confirmOrigin).not.toBeChecked();
  await confirmOrigin.check();
  await expect(confirmOrigin).toBeChecked();
  await confirmOrigin.uncheck();
  await expect(confirmOrigin).not.toBeChecked();
  await expectNoHorizontalOverflow(page);
  await expect(page.getByTestId('int02-open-assessment-editor')).toHaveCount(0);
  await expect(handoff.getByRole('status')).toContainText('Editor già aperto');
  const titleInput = page.getByPlaceholder('es. Verifica Formativa: Energie Rinnovabili e Impatto Ambientale');
  await titleInput.fill('BOZZA NON SALVATA INT-02');
  await expect(titleInput).toHaveValue('BOZZA NON SALVATA INT-02');
  const udaSelect = page.getByText('Collega a UDA Curricolare').locator('..').locator('select');
  await expect(udaSelect).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Salva Verifica', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salva verifica e chiudi' })).toBeVisible();
  await expect(udaSelect.locator('option').filter({ hasText: '3ª B' })).toHaveCount(0);

  // Internal navigation must not silently discard a modified assessment.
  const padletTab = page.getByRole('button', { name: 'Condivisione Padlet' });
  await padletTab.click();
  const internalExit = page.getByRole('dialog', { name: 'Modifiche non salvate' });
  await expect(internalExit).toBeVisible();
  await internalExit.getByRole('button', { name: "Rimani nell'editor" }).click();
  await expect(padletTab).toBeFocused();
  await expect(titleInput).toHaveValue('BOZZA NON SALVATA INT-02');

  // The native Android Back equivalent must restore history before displaying
  // a confirmation. Staying preserves the edited form; leaving discards only
  // session form state and does not create a test.
  await page.goBack();
  const exitDialog = page.getByRole('dialog', { name: 'Modifiche non salvate' });
  await expect(exitDialog).toBeVisible();
  await expect(exitDialog.getByRole('status', { name: 'Destinazione richiesta' })).toContainText('Biblioteca privata');
  await exitDialog.getByRole('button', { name: 'Rimani nell’editor' }).click();
  await expect(titleInput).toHaveValue('BOZZA NON SALVATA INT-02');
  await expect(handoff).toBeVisible();

  await page.goBack();
  await expect(exitDialog).toBeVisible();
  await exitDialog.getByRole('button', { name: 'Esci senza salvare' }).click();
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
  await expect(page.getByTestId('int02-assessment-handoff')).toHaveCount(0);

  // Direct entry: neither the first class nor the first test may authorize sharing.
  await openDrawerItem(page, 'Verifiche online');
  await expect(page.getByLabel('Classe Destinataria')).toHaveValue('');
  await expect(page.getByLabel('Test per condivisione')).toHaveValue('');
  await expect(page.getByTestId('int02-s2a-share-required')).toBeVisible();
  await expect(copyLink).toBeDisabled();
  await expect(simulate).toBeDisabled();
  await page.getByLabel('Test per condivisione').selectOption('energia');
  await expect(copyLink).toBeDisabled();
  await expect(simulate).toBeDisabled();
  await page.getByLabel('Classe Destinataria').selectOption(CLASS_NAME);
  await expect(copyLink).toBeEnabled();
  await expect(simulate).toBeEnabled();
  await page.setViewportSize({ width: 320, height: 700 });
  await expectNoHorizontalOverflow(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectNoHorizontalOverflow(page);
});


test('INT-02/S2b: mobile synthetic consent and origin-status visual evidence', async ({ page }) => {
  const testTitle = 'Verifica sintetica con origine INT-02/S2b';
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill('synthetic-int02-s2b-only');
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();

  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: 'Gestione Elenco Alunni: ' + CLASS_NAME })).toBeVisible();
  const saveNotice = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await saveNotice.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(saveNotice).toBeHidden();
  }

  await openDrawerItem(page, 'Biblioteca privata');
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(SOURCE_TITLE);
  await page.getByLabel('Contenuto').fill(SOURCE_TEXT);
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();
  await page.getByText('Gestisci', { exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Classifica come materiale professionale' }).click();
  await expect(page.getByText('Professionale', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Usa', exact: true }).click();
  await page.getByTestId('int02-prepare-assessment').click();
  await page.getByTestId('int02-open-assessment-editor').click();

  const checkbox = page.getByTestId('int02-s2b-confirm-origin');
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeChecked();
  await checkbox.scrollIntoViewIfNeeded();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `${evidenceDir}/int-02-s2b-01-consenso-non-selezionato-390.png`
  });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await page.screenshot({
    path: `${evidenceDir}/int-02-s2b-02-consenso-confermato-390.png`
  });

  await page.getByPlaceholder('es. Verifica Formativa: Energie Rinnovabili e Impatto Ambientale').fill(testTitle);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Salva Verifica', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Crea Nuova Verifica Formativa' })).toHaveCount(0);
  const card = page.getByRole('heading', { name: testTitle, exact: true }).locator('xpath=../../..');
  await card.getByRole('button', { name: 'Modifica', exact: true }).click();
  const originStatus = page.getByTestId('int02-s2b-origin-status');
  await expect(originStatus).toContainText('attualmente disponibile');
  await originStatus.scrollIntoViewIfNeeded();
  await expectDrawerFullyOffscreen(page);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `${evidenceDir}/int-02-s2b-03-origine-disponibile-390.png`
  });

  // A removed source must never delete or silently recertify the saved test.
  await openDrawerItem(page, 'Biblioteca privata');
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();
  await page.getByText('Gestisci', { exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Elimina', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toHaveCount(0);

  await openDrawerItem(page, 'Verifiche online');
  await page.getByRole('button', { name: 'Editor Verifiche & UDA' }).click();
  const savedCard = page.getByRole('heading', { name: testTitle, exact: true }).locator('xpath=../../..');
  await savedCard.getByRole('button', { name: 'Modifica', exact: true }).click();
  const unavailable = page.getByTestId('int02-s2b-origin-status');
  await expect(unavailable).toContainText('non disponibile o non verificabile');
  await unavailable.scrollIntoViewIfNeeded();
  await expectDrawerFullyOffscreen(page);
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `${evidenceDir}/int-02-s2b-04-origine-non-disponibile-390.png`
  });
  expect(page.url()).not.toContain(SOURCE_TITLE);
  expect(page.url()).not.toContain(SOURCE_TEXT);
});
