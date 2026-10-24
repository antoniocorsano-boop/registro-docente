const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const uxVaultPassword = 'ux-trust-01-qualification-only';
const UX_CLASS_NAME = 'Classe Sintetica UXT-A';
const UX_STUDENT_NAME = 'Studente Sintetico UXT-A';
const UX_EVALUATION_TITLE = 'Valutazione Sintetica UXT-A';

test.use({
  viewport: { width: 1280, height: 900 },
  trace: 'retain-on-failure'
});

test.setTimeout(120000);

async function setupFreshUxVault(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(uxVaultPassword);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function closePersistenceConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  await expect(heading).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(heading).toBeHidden();
}

async function disablePrivacyShield(page) {
  const shield = page.locator('button[title^="Privacy Shield"]').first();
  await expect(shield).toBeVisible();
  await shield.click();
}

async function createSyntheticClassAndStudent(page) {
  page.once('dialog', dialog => dialog.accept(UX_CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${UX_CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);
  await disablePrivacyShield(page);

  const studentInput = page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)');
  await studentInput.fill(UX_STUDENT_NAME);
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(page.getByText(UX_STUDENT_NAME, { exact: true })).toBeVisible();
}

async function assertAtLeast44(locator, label) {
  await expect(locator, `${label} must be visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} must have a bounding box`).not.toBeNull();
  expect(box.width, `${label} width`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${label} height`).toBeGreaterThanOrEqual(44);
  return box;
}

test('exact candidate serves a usable Registro Docente production shell', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });

  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error instanceof Error ? error.message : String(error));
  });

  let result = 'FAIL';
  let status = null;
  let title = '';
  let rootTextLength = 0;
  let qualificationError = null;

  try {
    const response = await page.goto(baseURL, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000
    });

    expect(response, 'navigation must return an HTTP response').not.toBeNull();
    status = response.status();
    expect(status).toBe(200);

    await expect(page).toHaveTitle(/Registro Docente/i);
    title = await page.title();

    const root = page.locator('#root');
    await expect(root).toBeVisible();
    await expect
      .poll(async () => (await root.innerText()).trim().length, {
        message: '#root must contain rendered application content',
        timeout: 15_000
      })
      .toBeGreaterThan(0);

    rootTextLength = (await root.innerText()).trim().length;
  } catch (error) {
    qualificationError = error;
  }

  try {
    await page.screenshot({
      path: path.join(evidenceDir, 'home.png'),
      fullPage: true
    });
  } catch (error) {
    fs.writeFileSync(
      path.join(evidenceDir, 'screenshot-error.txt'),
      `${error instanceof Error ? error.stack || error.message : String(error)}\n`
    );
    if (!qualificationError) {
      qualificationError = error;
    }
  }

  if (!qualificationError) {
    try {
      expect(pageErrors, 'page must not emit uncaught JavaScript errors').toEqual([]);
      result = 'PASS';
    } catch (error) {
      qualificationError = error;
    }
  }

  fs.writeFileSync(
    path.join(evidenceDir, 'qualification.json'),
    JSON.stringify(
      {
        candidateSha: process.env.CANDIDATE_SHA || null,
        result,
        baseURL,
        status,
        title,
        rootTextLength,
        pageErrors
      },
      null,
      2
    ) + '\n'
  );

  if (qualificationError) {
    throw qualificationError;
  }
});

test('UXT-A compact Vault and operational controls are touch-safe — mobile 390x844', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await setupFreshUxVault(page);

  const mobileAutoLock = page.locator('#vault-auto-lock-mobile');
  const mobileVault = mobileAutoLock.locator('..');
  const mobileLock = mobileVault.getByRole('button', { name: 'Blocca Registro' });
  const desktopAutoLock = page.locator('#vault-auto-lock-desktop');

  await expect(mobileVault).toBeVisible();
  await expect(desktopAutoLock).toBeHidden();
  const vaultBox = await mobileVault.boundingBox();
  expect(vaultBox).not.toBeNull();
  expect(vaultBox.width, 'mobile Vault cluster width').toBeLessThanOrEqual(200);
  const autoLockBox = await mobileAutoLock.boundingBox();
  expect(autoLockBox).not.toBeNull();
  expect(autoLockBox.height, 'mobile auto-lock height').toBeGreaterThanOrEqual(44);
  await assertAtLeast44(mobileLock, 'mobile lock button');

  await createSyntheticClassAndStudent(page);

  const mobileNav = page.locator('nav.md\\:hidden.fixed.bottom-0');
  await expect(mobileNav).toBeVisible();
  const navBox = await mobileNav.boundingBox();
  const vaultWithNavBox = await mobileVault.boundingBox();
  expect(navBox).not.toBeNull();
  expect(vaultWithNavBox).not.toBeNull();
  expect(vaultWithNavBox.y + vaultWithNavBox.height, 'Vault must remain above mobile navigation').toBeLessThanOrEqual(navBox.y + 1);

  await mobileNav.getByRole('button', { name: 'Valutazioni', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();
  const quickFill = page.getByRole('button', { name: 'Tutti 8', exact: true });
  await assertAtLeast44(quickFill, 'evaluation quick-fill button');
  const delayedToggle = page.getByRole('button', { name: 'R', exact: true }).first();
  await assertAtLeast44(delayedToggle, 'evaluation delayed toggle');

  await page.getByPlaceholder('es. Verifica su Fonti Rinnovabili').fill(UX_EVALUATION_TITLE);
  await quickFill.click();
  await page.getByRole('button', { name: 'Salva Valutazioni di Classe', exact: true }).click();
  await closePersistenceConfirmation(page);
  await expect(page.getByText(UX_EVALUATION_TITLE, { exact: true })).toBeVisible();

  const editButton = page.getByTitle('Modifica valutazione').first();
  const deleteButton = page.getByTitle('Elimina prova').first();
  await assertAtLeast44(editButton, 'history edit action');
  await assertAtLeast44(deleteButton, 'history delete action');

  await mobileNav.getByRole('button', { name: 'Comportamento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Valutazione Rapida Comportamenti' })).toBeVisible();
  const behaviorStatus = page.getByRole('button', { name: 'Ottimale 🌟', exact: true }).first();
  await assertAtLeast44(behaviorStatus, 'behavior status control');

  await page.screenshot({ path: path.join(evidenceDir, 'ux-trust-01-uxt-a-mobile.png'), fullPage: false });
  fs.writeFileSync(
    path.join(evidenceDir, 'ux-trust-01-uxt-a-mobile.json'),
    JSON.stringify({
      candidateSha: process.env.CANDIDATE_SHA || null,
      viewport: { width: 390, height: 844 },
      vaultBox: vaultWithNavBox,
      navBox,
      pageErrors,
      consoleErrors
    }, null, 2) + '\n'
  );

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
  await context.close();
});

test('UXT-A preserves full desktop Vault controls — desktop 1280x900', async ({ browser }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));

  await setupFreshUxVault(page);

  const desktopAutoLock = page.locator('#vault-auto-lock-desktop');
  const desktopVault = desktopAutoLock.locator('..');
  await expect(desktopVault).toBeVisible();
  await expect(page.locator('#vault-auto-lock-mobile')).toBeHidden();
  await expect(desktopVault.getByRole('button', { name: 'Blocca Registro', exact: true })).toBeVisible();
  await expect(desktopAutoLock).toHaveValue('15');

  await page.screenshot({ path: path.join(evidenceDir, 'ux-trust-01-uxt-a-desktop.png'), fullPage: false });
  expect(pageErrors).toEqual([]);
  await context.close();
});
