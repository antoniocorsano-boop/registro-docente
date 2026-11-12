const { test, expect } = require('@playwright/test');
const { navigationButton, settleOggiNavigation } = require('./header01-navigation.cjs');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const vaultPassword = 'synthetic-vault-only';
const backupPassword = 'synthetic-backup-only';
const classBefore = '3ª Z - Sintetica M2';
const classAfter = '3ª Y - Sintetica M2';

test.setTimeout(120000);
test('M2 synthetic native bridge: verified export, wrong password, cancelled restore and authenticated roundtrip', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    let encrypted = '';
    window.__m2Native = { writes: 0, reads: 0, cancel: false };
    const digest = async text => {
      const bytes = new TextEncoder().encode(text);
      return { bytes: bytes.length, sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('') };
    };
    window.Capacitor = { getPlatform: () => 'android', Plugins: { RegistroBackupFiles: {
      chooseBackupDestination: async () => ({ status: 'selected', token: 'write' }),
      writeEncryptedBackup: async opts => {
        if (opts.token !== 'write') throw Error('invalid token');
        const env = JSON.parse(opts.encryptedText);
        if (env.privacy_protocol !== 'REGISTRO_DOCENTE_AES_GCM_256' || env.version !== 2) throw Error('invalid envelope');
        encrypted = opts.encryptedText;
        window.__m2Native.writes++;
        return { status: 'verified', ...await digest(encrypted) };
      },
      chooseBackupSource: async () => window.__m2Native.cancel ? { status: 'cancelled' } : { status: 'selected', token: 'read' },
      readEncryptedBackup: async opts => {
        if (opts.token !== 'read') throw Error('invalid token');
        window.__m2Native.reads++;
        return { status: 'read', encryptedText: encrypted, ...await digest(encrypted) };
      }
    } } };
  });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('input[name="archive-mode"][value="demo"]').check();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Avvia la prova' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();

  async function nav(label) {
    await navigationButton(page).click();
    await page.locator('#registro-navigation-drawer').getByRole('button', { name: label, exact: true }).click();
    if (label === 'Oggi') await settleOggiNavigation(page);
  }
  async function createClass(name) {
    page.once('dialog', d => d.accept(name));
    await page.getByRole('button', { name: /Nuova Classe/ }).click();
    await expect(page.getByRole('heading', { name: 'Gestione Elenco Alunni: ' + name })).toBeVisible();
    const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
    if (await heading.isVisible().catch(() => false)) await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await nav('Oggi');
    await expect(page.getByRole('button', { name: 'Apri classe ' + name, exact: true })).toBeVisible();
  }
  await createClass(classBefore);
  await nav('Privacy');
  const exportButton = page.getByRole('button', { name: 'Cifra e Scarica File', exact: true });
  await page.getByPlaceholder('Inserisci password sicura (min. 6 caratteri)').fill(backupPassword);
  await page.getByPlaceholder('Ripeti la password').fill(backupPassword);
  const exported = page.waitForEvent('dialog');
  const exportClick = exportButton.click();
  const saved = await exported;
  expect(saved.message()).toContain('Copia di sicurezza salvata e verificata');
  await saved.accept();
  await exportClick;
  expect(await page.evaluate(() => window.__m2Native.writes)).toBe(1);
  await nav('Oggi');
  await createClass(classAfter);
  await nav('Privacy');
  const restoreButton = page.getByRole('button', { name: 'Scegli file e ripristina', exact: true });
  const pass = page.getByPlaceholder('Inserisci la password impostata alla cifratura');
  await pass.fill('wrong-synthetic-password');
  const wrong = page.waitForEvent('dialog');
  const wrongClick = restoreButton.click();
  const error = await wrong;
  expect(error.message()).toContain('Ripristino non completato');
  await error.accept();
  await wrongClick;
  await expect(restoreButton).toBeEnabled();
  await pass.fill(backupPassword);
  await page.evaluate(() => { window.__m2Native.cancel = true; });
  await restoreButton.click();
  await expect(restoreButton).toBeEnabled();
  expect(await page.evaluate(() => window.__m2Native.reads)).toBe(1);
  await page.evaluate(() => { window.__m2Native.cancel = false; });
  const confirm = page.waitForEvent('dialog');
  const cancelClick = restoreButton.click();
  const cancel = await confirm;
  expect(cancel.message()).toContain('Il ripristino sostituirà');
  await cancel.dismiss();
  await cancelClick;
  await expect(restoreButton).toBeEnabled();
  await nav('Oggi');
  await expect(page.getByRole('button', { name: 'Apri classe ' + classAfter, exact: true })).toBeVisible();
  await nav('Privacy');
  await pass.fill(backupPassword);
  // The actual App restore handler writes and verifies the real local encrypted Vault.
  const accepted = [];
  const handler = async d => { accepted.push(d.message()); await d.accept(); };
  page.on('dialog', handler);
  await restoreButton.click();
  await expect(page.getByRole('button', { name: 'Apri classe ' + classBefore, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apri classe ' + classAfter, exact: true })).toHaveCount(0);
  expect(accepted.some(message => message.includes('Il ripristino sostituirà'))).toBe(true);
  page.off('dialog', handler);
});
