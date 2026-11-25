const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const { navigationButton, settleOggiNavigation } = require('./header01-navigation.cjs');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const vaultPassword = 'v7-vault-synthetic-only';
const backupPassword = 'v7-copy-synthetic-only';
const firstClass = 'Classe sintetica V7 A';
const secondClass = 'Classe sintetica V7 B';

test.use({ viewport: { width: 390, height: 844 }, acceptDownloads: true, trace: 'retain-on-failure' });
test.setTimeout(180000);

test('AP-02 V7 actual Privacy web UI: physical file verification and exact recovery before replacement', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  let nextPrompt = null;
  const dialogs = [];
  page.on('dialog', async dialog => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    if (dialog.type() === 'prompt') {
      const value = nextPrompt;
      nextPrompt = null;
      await dialog.accept(value ?? '');
    } else {
      await dialog.accept();
    }
  });

  async function nav(label) {
    await navigationButton(page).first().click();
    await page.locator('#registro-navigation-drawer')
      .getByRole('button', { name: label, exact: true }).click();
    if (label === 'Oggi') await settleOggiNavigation(page);
  }

  async function createClass(name) {
    nextPrompt = name;
    await page.getByRole('button', { name: /Nuova Classe/ }).click();
    await expect(page.getByRole('heading', { name: 'Gestione Elenco Alunni: ' + name })).toBeVisible();
    const notice = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
    if (await notice.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    }
    await nav('Oggi');
    await expect(page.getByRole('button', { name: 'Apri classe ' + name, exact: true })).toBeVisible();
  }

  async function exportV7() {
    await page.getByPlaceholder('Inserisci password sicura (min. 6 caratteri)').fill(backupPassword);
    await page.getByPlaceholder('Ripeti la password').fill(backupPassword);
    const downloaded = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Esporta copia completa V7', exact: true }).click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toMatch(/^Backup_Valutazioni_V7_.*\.enc\.json$/);
    const bytes = await fs.readFile(await download.path());
    const encrypted = JSON.parse(bytes.toString('utf8'));
    expect(encrypted.privacy_protocol).toBe('REGISTRO_DOCENTE_AES_GCM_256');
    expect(encrypted.version).toBe(2);
    expect(bytes.toString('utf8')).not.toContain(firstClass);
    await expect(page.locator('#verify-downloaded-backup')).toBeVisible();
    return { path: await download.path(), bytes };
  }

  async function verifyDownloaded(path) {
    await page.locator('#verify-downloaded-backup').setInputFiles(path);
    await expect(page.getByRole('status').filter({ hasText: 'Copia V7 verificata' })).toBeVisible();
  }

  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('input[name="archive-mode"][value="demo"]').check();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Avvia la prova' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();

  await createClass(firstClass);
  await nav('Privacy');
  const original = await exportV7();

  // A downloaded but unverified copy MUST NOT be accepted.
  await page.locator('#verify-downloaded-backup').setInputFiles({
    name: 'incorrect-v7.enc.json', mimeType: 'application/json',
    buffer: Buffer.from('{"synthetic":"wrong bytes"}')
  });
  await expect(page.getByRole('status').filter({ hasText: 'Copia non verificata' })).toBeVisible();

  // A failed one-use verification requires a newly generated copy.
  const target = await exportV7();
  await verifyDownloaded(target.path);

  await nav('Oggi');
  await createClass(secondClass);
  await nav('Privacy');
  const recovery = await exportV7();
  await verifyDownloaded(recovery.path);

  // An obsolete recovery file must not authorize replacing current data.
  await page.locator('#restore-backup-file').setInputFiles(target.path);
  await page.locator('#restore-v7-recovery').setInputFiles(original.path);
  await page.getByPlaceholder('Inserisci la password impostata alla cifratura').fill(backupPassword);
  await page.locator('#restore-v7-recovery-password').fill(backupPassword);
  await page.getByRole('button', { name: 'Decifra e Ripristina Registro', exact: true }).click();
  await expect.poll(
    () => dialogs.some(d => d.type === 'alert' && /Archivio aggiornato non verificabile|non valid[oa]|non corrispond|Password errata/i.test(d.message)),
    { timeout: 30000, message: 'A stale recovery copy must be rejected before V7 restore' }
  ).toBe(true);
  // Preserve the exact current logical state between its authenticated
  // recovery copy and the authorized restore attempt. Navigating to Oggi
  // changes the active-class selection and is not part of backup recovery.
  await expect(page.getByRole('heading', { name: /Privacy First/ })).toBeVisible();
  expect(dialogs.some(d => d.type === 'alert' && /ripristinato con successo/i.test(d.message))).toBe(false);

  // The newly downloaded, authenticated exact current-state copy is accepted.
  await page.locator('#restore-backup-file').setInputFiles(target.path);
  await page.locator('#restore-v7-recovery').setInputFiles(recovery.path);
  await page.getByPlaceholder('Inserisci la password impostata alla cifratura').fill(backupPassword);
  await page.locator('#restore-v7-recovery-password').fill(backupPassword);
  await page.getByRole('button', { name: 'Decifra e Ripristina Registro', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Apri classe ' + firstClass, exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Apri classe ' + secondClass, exact: true })).toHaveCount(0);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Sblocca Registro' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  await expect(page.getByRole('button', { name: 'Apri classe ' + firstClass, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apri classe ' + secondClass, exact: true })).toHaveCount(0);
  expect(dialogs.some(d => /Copia V7 generata/.test(d.message))).toBe(true);
  expect(pageErrors).toEqual([]);
});

// F3-R01: exercise the shared gate with real Chromium locators on a controlled
// public document. These fixtures do not claim to be the production Vault.
const { reloadVaultAndUnlock, awaitVaultWorkspace, gotoVaultAndUnlock } = require('./header01-navigation.cjs');
async function f3GateFixture(page, { locked = false, inert = false, accepts = true } = {}) {
  await page.route('**/f3-gate-fixture', route => route.fulfill({
    contentType: 'text/html',
    body: `<section id="gate" ${locked ? '' : 'hidden'}>
      <h1>Sblocca Registro</h1><input id="vault-password" type="password">
      <button id="unlock">Sblocca Registro</button></section>
      <section id="workspace" ${locked ? 'hidden' : ''} ${inert ? 'inert' : ''}>
      <h2>Le mie classi</h2><button data-testid="header01-brand-navigation">Menu Registro</button></section>
      <script>window.unlocks=0;document.querySelector('#unlock').onclick=()=>{
        window.unlocks++;
        if(${accepts} && document.querySelector('#vault-password').value==='synthetic-f3'){
          document.querySelector('#gate').hidden=true;
          document.querySelector('#workspace').hidden=false;
        }
      };</script>`
  }));
  await page.goto(baseURL + '/f3-gate-fixture');
}

test('F3-R01: full reload refuses workspace without mandatory authentication', async ({ page }) => {
  await f3GateFixture(page);
  await expect(reloadVaultAndUnlock(page, 'synthetic-f3', {
    requireHome: true, requireUnlock: false, timeout: 500
  })).rejects.toThrow(); // A caller cannot disable the reload authentication contract.
  expect(await page.evaluate(() => window.unlocks)).toBe(0);
});

test('F3-R01: full reload observes lock and authenticates exactly once', async ({ page }) => {
  await f3GateFixture(page, { locked: true });
  await reloadVaultAndUnlock(page, 'synthetic-f3', { requireHome: true, timeout: 2000 });
  expect(await page.evaluate(() => window.unlocks)).toBe(1);
});

test('F3-R01: rejected password never qualifies the workspace', async ({ page }) => {
  await f3GateFixture(page, { locked: true, accepts: false });
  await expect(reloadVaultAndUnlock(page, 'synthetic-f3', { timeout: 500 })).rejects.toThrow();
  expect(await page.evaluate(() => window.unlocks)).toBe(1);
});

test('F3-R01: generic readiness refuses visible inert navigation', async ({ page }) => {
  await f3GateFixture(page, { inert: true });
  await expect(awaitVaultWorkspace(page, 'synthetic-f3', { timeout: 500 })).rejects.toThrow();
});

test('F3-R01: generic readiness still accepts an already authenticated workspace', async ({ page }) => {
  await f3GateFixture(page);
  await awaitVaultWorkspace(page, 'synthetic-f3', { requireHome: true, timeout: 500 });
  expect(await page.evaluate(() => window.unlocks)).toBe(0);
});

test('F3-R02: full goto refuses an accessible workspace without fresh authentication', async ({ page }) => {
  await f3GateFixture(page);
  await expect(gotoVaultAndUnlock(page, baseURL + '/f3-gate-fixture', 'synthetic-f3', {
    requireHome: true, requireUnlock: false, timeout: 1000
  })).rejects.toThrow();
  expect(await page.evaluate(() => window.unlocks)).toBe(0);
});

test('F3-R02: full goto observes public lock and authenticates exactly once', async ({ page }) => {
  await f3GateFixture(page, { locked: true });
  await gotoVaultAndUnlock(page, baseURL + '/f3-gate-fixture', 'synthetic-f3', {
    requireHome: true, timeout: 5000
  });
  expect(await page.evaluate(() => window.unlocks)).toBe(1);
});
