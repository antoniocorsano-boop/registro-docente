const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'lib01-browser-qualification';
const backupPassword = 'lib01-backup';
const UDA_TITLE = 'UDA Sintetica LIB-01A';
const TEXT_TITLE = 'Idea energia dal quotidiano';
const IMAGE_TITLE = 'fonte-solare.png';
const WEB_TITLE = 'Articolo energia locale';
const MOBILE_CLASS = 'Classe Sintetica LIB-01A';

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(180000);

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

async function addTextSource(page) {
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(TEXT_TITLE);
  await page.getByLabel('Contenuto').fill('Fotografia e appunto su un pannello solare osservato nel quartiere.');
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: TEXT_TITLE, exact: true })).toBeVisible();
}

async function addImageSource(page) {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=',
    'base64'
  );
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Foto o file', exact: true }).click();
  await page.locator('#library-file-input').setInputFiles({
    name: IMAGE_TITLE,
    mimeType: 'image/png',
    buffer: png
  });
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: IMAGE_TITLE, exact: true })).toBeVisible();
}

async function addWebSource(page) {
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'URL', exact: true }).click();
  await page.getByLabel('Titolo').fill(WEB_TITLE);
  await page.getByLabel('URL').fill('https://example.com/energia?ref=lib01');
  await page.getByRole('button', { name: 'Salva URL', exact: true }).click();
  await expect(page.getByRole('heading', { name: WEB_TITLE, exact: true })).toBeVisible();
}

async function sourceCard(page, title) {
  const heading = page.getByRole('heading', { name: title, exact: true });
  await expect(heading).toBeVisible();
  return heading.locator('xpath=ancestor::article');
}


async function ensureManagementOpen(card) {
  const details = card.locator('details');
  if (!(await details.evaluate(element => element.open))) {
    await card.getByText('Gestisci', { exact: true }).click();
  }
}

async function assertAtLeast44(locator, label) {
  await expect(locator, `${label} visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} bounding box`).not.toBeNull();
  expect(box.width, `${label} width`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44);
}

async function closePersistenceConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  await expect(heading).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(heading).toBeHidden();
}

test('LIB-01A private library targeted journey survives reload, limits, links and encrypted restore — desktop 1280x900', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await setupFreshVault(page);
  await createSyntheticUda(page);
  await openLibrary(page);

  // 1. Text source persists through reload.
  await addTextSource(page);
  await reloadAndUnlock(page);
  await openLibrary(page);
  await expect(page.getByRole('heading', { name: TEXT_TITLE, exact: true })).toBeVisible();

  // 2. Image source under 8 MiB persists through reload.
  await addImageSource(page);
  await reloadAndUnlock(page);
  await openLibrary(page);
  await expect(page.getByRole('heading', { name: IMAGE_TITLE, exact: true })).toBeVisible();
  const imageCard = await sourceCard(page, IMAGE_TITLE);
  await expect(imageCard.locator('img')).toHaveCount(1);

  // 3. URL source can be captured without fetching it.
  await addWebSource(page);
  const webCard = await sourceCard(page, WEB_TITLE);
  await expect(webCard.getByRole('link', { name: 'Apri origine' })).toHaveAttribute(
    'href',
    'https://example.com/energia?ref=lib01'
  );

  // 4. Link and unlink to an existing synthetic UDA.
  const textCard = await sourceCard(page, TEXT_TITLE);
  await ensureManagementOpen(textCard);
  await textCard.getByLabel('Collega a UDA').selectOption({ label: UDA_TITLE });
  await textCard.getByRole('button', { name: 'Collega', exact: true }).click();
  await expect(textCard.getByRole('button', { name: 'Scollega', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Collegate', exact: true }).click();
  await expect(page.getByRole('heading', { name: TEXT_TITLE, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Recenti', exact: true }).click();
  const linkedTextCard = await sourceCard(page, TEXT_TITLE);
  await ensureManagementOpen(linkedTextCard);
  await linkedTextCard.getByRole('button', { name: 'Scollega', exact: true }).click();
  await expect(linkedTextCard.getByRole('button', { name: 'Scollega', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Collegate', exact: true }).click();
  await expect(page.getByRole('heading', { name: TEXT_TITLE, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Recenti', exact: true }).click();

  // 5. Search narrows results and clearing restores the collection.
  const search = page.getByPlaceholder('Cerca nella biblioteca');
  await search.fill('pannello solare');
  await expect(page.getByRole('heading', { name: TEXT_TITLE, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: WEB_TITLE, exact: true })).toHaveCount(0);
  await search.fill('');
  await expect(page.getByRole('heading', { name: TEXT_TITLE, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: IMAGE_TITLE, exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: WEB_TITLE, exact: true })).toBeVisible();

  // 6. Oversized file is rejected without a false successful source.
  const oversizedPath = path.join(os.tmpdir(), `lib01-too-large-${process.pid}.bin`);
  fs.writeFileSync(oversizedPath, Buffer.alloc((8 * 1024 * 1024) + 1, 0x41));
  try {
    await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
    await page.getByRole('button', { name: 'Foto o file', exact: true }).click();
    await page.locator('#library-file-input').setInputFiles(oversizedPath);
    await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('File troppo grande: il limite per una fonte è 8 MiB.');
    await expect(page.locator('article').filter({ hasText: path.basename(oversizedPath) })).toHaveCount(0);
    await page.getByRole('button', { name: 'Chiudi acquisizione fonte' }).click();
  } finally {
    fs.rmSync(oversizedPath, { force: true });
  }

  // 7. Encrypted backup restores a deleted library source.
  await openDrawerItem(page, 'Privacy');
  await expect(page.getByRole('heading', { name: /Privacy First & Protezione dei dati/ })).toBeVisible();
  await page.getByPlaceholder('Inserisci password sicura (min. 6 caratteri)').fill(backupPassword);
  await page.getByPlaceholder('Ripeti la password').fill(backupPassword);
  let exportMessage = '';
  const exportDialogHandled = new Promise(resolve => {
    page.once('dialog', async dialog => {
      exportMessage = dialog.message();
      await dialog.accept();
      resolve();
    });
  });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Cifra e Scarica File', exact: true }).click();
  const download = await downloadPromise;
  await exportDialogHandled;
  expect(exportMessage).toContain('Backup protetto');
  const backupPath = await download.path();
  expect(backupPath).not.toBeNull();

  await openLibrary(page);
  const deleteCard = await sourceCard(page, TEXT_TITLE);
  await deleteCard.getByText('Gestisci', { exact: true }).click();
  page.once('dialog', dialog => void dialog.accept());
  await deleteCard.getByRole('button', { name: 'Elimina', exact: true }).click();
  await expect(page.getByRole('heading', { name: TEXT_TITLE, exact: true })).toHaveCount(0);

  await openDrawerItem(page, 'Privacy');
  await page.locator('input[type="file"][accept=".json"]').setInputFiles(backupPath);
  await page.getByPlaceholder('Inserisci la password impostata alla cifratura').fill(backupPassword);
  let restoreMessage = '';
  const restoreDialogHandled = new Promise(resolve => {
    page.once('dialog', async dialog => {
      restoreMessage = dialog.message();
      await dialog.accept();
      resolve();
    });
  });
  await page.getByRole('button', { name: 'Ripristina Backup Cifrato', exact: true }).click();
  await restoreDialogHandled;
  expect(restoreMessage).toContain('ripristinato con successo');
  await openLibrary(page);
  await expect(page.getByRole('heading', { name: TEXT_TITLE, exact: true })).toBeVisible();

  // 8-9. Drawer placement and desktop overflow/touch safety.
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Biblioteca privata', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Biblioteca privata', exact: true }).click();
  await assertAtLeast44(page.getByRole('button', { name: 'Aggiungi fonte', exact: true }), 'desktop add-source');
  await assertAtLeast44(page.getByRole('button', { name: 'Recenti', exact: true }), 'desktop recent filter');
  const desktopOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  expect(desktopOverflow.scrollWidth).toBeLessThanOrEqual(desktopOverflow.innerWidth + 1);

  await page.screenshot({
    path: path.join(evidenceDir, 'lib01-private-library-desktop.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib01-private-library-desktop.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 1280, height: 900 },
      checks: [
        'text-reload',
        'image-reload',
        'url-capture',
        'uda-link-unlink',
        'search-clear',
        'oversize-fail-closed',
        'encrypted-backup-restore',
        'secondary-navigation',
        'overflow-touch-safety'
      ],
      pageErrors
    }, null, 2) + '\n'
  );
  expect(pageErrors).toEqual([]);
});

test('LIB-01A library remains secondary, touch-safe and overflow-free — mobile 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await setupFreshVault(page);

  page.once('dialog', dialog => void dialog.accept(MOBILE_CLASS));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${MOBILE_CLASS}` })).toBeVisible();
  await closePersistenceConfirmation(page);

  const mobileNav = page.locator('nav.md\\:hidden.fixed.bottom-0');
  await expect(mobileNav).toBeVisible();
  for (const label of ['Riepilogo', 'Valutazioni', 'Comportamento', 'Tabellone', 'Analisi']) {
    await expect(mobileNav.getByRole('button', { name: label, exact: true })).toHaveCount(1);
  }
  await expect(mobileNav.getByRole('button', { name: 'Biblioteca privata', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const libraryEntry = page.getByRole('button', { name: 'Biblioteca privata', exact: true });
  await expect(libraryEntry).toHaveCount(1);
  await assertAtLeast44(libraryEntry, 'mobile library drawer entry');
  await libraryEntry.click();
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();

  await assertAtLeast44(page.getByRole('button', { name: 'Aggiungi fonte', exact: true }), 'mobile add-source');
  for (const label of ['Recenti', 'Collegate', 'Da rivedere']) {
    await assertAtLeast44(page.getByRole('button', { name: label, exact: true }), `mobile ${label} filter`);
  }

  const mobileOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth
  }));
  expect(mobileOverflow.scrollWidth).toBeLessThanOrEqual(mobileOverflow.innerWidth + 1);

  await page.screenshot({
    path: path.join(evidenceDir, 'lib01-private-library-mobile.png'),
    fullPage: true
  });
  fs.writeFileSync(
    path.join(evidenceDir, 'lib01-private-library-mobile.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 390, height: 844 },
      primaryNavigation: ['Riepilogo', 'Valutazioni', 'Comportamento', 'Tabellone', 'Analisi'],
      libraryDrawerEntryCount: 1,
      pageErrors
    }, null, 2) + '\n'
  );

  expect(pageErrors).toEqual([]);
  await context.close();
});
