const { test, expect } = require('@playwright/test');
const { navigationButton, settleOggiNavigation } = require('./header01-navigation.cjs');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const vaultPassword = 'ap02-f2-vault-synthetic-only';
const copyPassword = 'ap02-f2-backup-synthetic-only';
const firstClass = 'Classe sintetica AP02 F2 A';
const secondClass = 'Classe sintetica AP02 F2 B';

test.use({ viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' });
test.setTimeout(210000);

test('AP-02/F2 synthetic Android V7 UI: native readback, cancellation, stale recovery and verified restart', async ({ page }) => {
  const dialogs = [];
  const pageErrors = [];
  let promptedClass = null;
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('dialog', async dialog => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    if (dialog.type() === 'prompt') {
      const text = promptedClass;
      promptedClass = null;
      await dialog.accept(text ?? '');
    } else {
      await dialog.accept(); // synthetic informed consent, no real records
    }
  });
  await page.addInitScript(() => {
    const state = {
      saved: [],
      writes: 0,
      reads: 0,
      sources: [],
      badReceipt: false,
      badReadback: false,
      cancelNext: false,
      nativeSelections: 0
    };
    window.__ap02F2 = state;
    const digest = async text => {
      const bytes = new TextEncoder().encode(text);
      const sha256 = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        x => x.toString(16).padStart(2, '0')
      ).join('');
      return { bytes: bytes.length, sha256 };
    };
    window.Capacitor = { getPlatform: () => 'android', Plugins: {
      RegistroSession: {
        getState: async () => ({ epoch: 0, foreground: true }),
        authorize: async ({ epoch }) => { if (epoch !== 0) throw Error('synthetic session mismatch'); },
        revoke: async ({ epoch }) => { if (epoch !== 0) throw Error('synthetic session mismatch'); },
        acknowledgeShield: async ({ epoch }) => { if (epoch !== 0) throw Error('synthetic session mismatch'); }
      },
      RegistroBackupFiles: {
        chooseBackupDestination: async ({ filename }) => {
          if (!/^Backup_Valutazioni_V7_.*\.enc\.json$/.test(filename)) throw Error('unexpected V7 filename');
          state.nativeSelections++;
          return { status: 'selected', token: 'synthetic-out' };
        },
        writeEncryptedBackup: async ({ token, encryptedText }) => {
          if (token !== 'synthetic-out') throw Error('invalid synthetic destination');
          const envelope = JSON.parse(encryptedText);
          if (envelope.privacy_protocol !== 'REGISTRO_DOCENTE_AES_GCM_256' ||
              envelope.version !== 2 || encryptedText.includes('Classe sintetica AP02 F2 A'))
            throw Error('native bridge received invalid or plain assessment backup');
          const physical = { ...await digest(encryptedText) };
          state.saved.push(encryptedText);
          state.writes++;
          if (state.badReceipt) return { status: 'verified', ...physical, sha256: '0'.repeat(64) };
          return { status: 'verified', ...physical };
        },
        chooseBackupSource: async () => {
          state.nativeSelections++;
          if (state.cancelNext) {
            state.cancelNext = false;
            return { status: 'cancelled' };
          }
          if (!state.sources.length) throw Error('no approved synthetic source');
          return { status: 'selected', token: 'synthetic-source-' + state.sources.shift() };
        },
        readEncryptedBackup: async ({ token }) => {
          const id = Number(token.replace(/^synthetic-source-/, ''));
          if (!Number.isSafeInteger(id) || id < 0 || id >= state.saved.length)
            throw Error('unknown synthetic source');
          const encryptedText = state.saved[id];
          const evidence = await digest(encryptedText);
          state.reads++;
          return { status: 'read', encryptedText,
            bytes: evidence.bytes,
            sha256: state.badReadback ? '0'.repeat(64) : evidence.sha256 };
        }
      }
    } };
  });

  async function nav(label) {
    await navigationButton(page).first().click();
    await page.locator('#registro-navigation-drawer')
      .getByRole('button', { name: label, exact: true }).click();
    if (label === 'Oggi') await settleOggiNavigation(page);
  }
  async function createClass(name) {
    promptedClass = name;
    await page.getByRole('button', { name: /Nuova Classe/ }).click();
    await expect(page.getByRole('heading', { name: 'Gestione Elenco Alunni: ' + name })).toBeVisible();
    const notice = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
    if (await notice.isVisible().catch(() => false))
      await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await nav('Oggi');
    await expect(page.getByRole('button', { name: 'Apri classe ' + name, exact: true })).toBeVisible();
  }
  async function exportV7(expectedAlert) {
    const start = dialogs.length;
    await page.getByPlaceholder('Inserisci password sicura (min. 6 caratteri)').fill(copyPassword);
    await page.getByPlaceholder('Ripeti la password').fill(copyPassword);
    await page.getByRole('button', { name: 'Esporta copia completa V7', exact: true }).click();
    await expect.poll(
      () => dialogs.slice(start).some(d => d.type === 'alert' && expectedAlert.test(d.message)),
      { timeout: 30000, message: 'V7 native write/readback must report the real outcome' }
    ).toBe(true);
  }
  async function restore(indices, password, expectedAlert) {
    const start = dialogs.length;
    await page.evaluate(sources => { window.__ap02F2.sources = sources; }, indices);
    await page.getByPlaceholder('Inserisci la password impostata alla cifratura').fill(password);
    await page.locator('#restore-v7-recovery-password').fill(copyPassword);
    await page.getByRole('button', { name: 'Scegli file e ripristina', exact: true }).click();
    await expect.poll(
      () => dialogs.slice(start).some(d => d.type === 'alert' && expectedAlert.test(d.message)),
      { timeout: 30000, message: 'V7 Android restore must explicitly report rejection or success' }
    ).toBe(true);
  }

  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('input[name="archive-mode"][value="demo"]').check();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Avvia la prova' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
  await createClass(firstClass);
  await nav('Privacy');
  await expect(page.getByText('Ripristina backup cifrato')).toBeVisible();
  await expect(page.locator('#restore-backup-file')).toHaveCount(0); // Android must use native picker

  // Native write returning a forged SHA is not a successful checkpoint.
  await page.evaluate(() => { window.__ap02F2.badReceipt = true; });
  await exportV7(/Copia V7 non completata o non verificata/i);
  expect(await page.evaluate(() => window.__ap02F2.writes)).toBe(1);
  await page.evaluate(() => { window.__ap02F2.badReceipt = false; });
  await exportV7(/Copia completa V7 salvata, riletta e verificata/i);
  expect(await page.evaluate(() => window.__ap02F2.writes)).toBe(2);
  const targetIndex = 1; // index 0 is the rejected native attestation
  await nav('Oggi');
  await createClass(secondClass);
  await nav('Privacy');
  await exportV7(/Copia completa V7 salvata, riletta e verificata/i);
  expect(await page.evaluate(() => window.__ap02F2.writes)).toBe(3);
  const recoveryIndex = 2;

  // Cancelling Android SAF selection leaves the current archive untouched.
  await page.evaluate(() => { window.__ap02F2.cancelNext = true; });
  await page.getByPlaceholder('Inserisci la password impostata alla cifratura').fill(copyPassword);
  await page.locator('#restore-v7-recovery-password').fill(copyPassword);
  await page.getByRole('button', { name: 'Scegli file e ripristina', exact: true }).click();
  expect(await page.evaluate(() => window.__ap02F2.reads)).toBe(0);
  await expect(page.getByRole('heading', { name: /Privacy First/ })).toBeVisible();

  // Authentic ciphertext with wrong password must be rejected before recovery selection.
  await restore([targetIndex], 'not-the-password', /Ripristino non completato/i);
  expect(await page.evaluate(() => window.__ap02F2.reads)).toBe(1);

  // Android plugin readback SHA mismatch must reject before decrypting.
  await page.evaluate(() => { window.__ap02F2.badReadback = true; });
  await restore([targetIndex], copyPassword, /Ripristino non completato/i);
  await page.evaluate(() => { window.__ap02F2.badReadback = false; });

  // An older (but properly encrypted) recovery file is not the CURRENT
  // exact archive and cannot authorize replacement.
  await restore([targetIndex, targetIndex], copyPassword, /Ripristino non completato/i);

  // Two correct separately selected V7 copies: older target and current
  // authenticated recovery, then the real App Vault write and readback.
  await restore([targetIndex, recoveryIndex], copyPassword, /ripristinato con successo/i);
  await expect(page.getByRole('button', { name: 'Apri classe ' + firstClass, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apri classe ' + secondClass, exact: true })).toHaveCount(0);

  // Cold web process restart of the same encrypted local Vault. This is a
  // native-bridge simulation, not a physical Android-device acceptance.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Sblocca Registro' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  await expect(page.getByRole('button', { name: 'Apri classe ' + firstClass, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Apri classe ' + secondClass, exact: true })).toHaveCount(0);
  expect(dialogs.some(d => d.type === 'confirm' && /Ripristino V7/.test(d.message))).toBe(true);
  expect(pageErrors).toEqual([]);
});
