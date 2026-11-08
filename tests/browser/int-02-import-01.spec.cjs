const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const CLASS_NAME = 'Classe Sintetica IMPORT-01';
const STUDENT_NAME = 'Studente Sintetico IMPORT-01';
const PASSWORD = 'synthetic-import-01-vault';

test.use({ viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' });
test.setTimeout(120000);

async function openDrawerItem(page, name) {
  await page.getByTestId('header01-brand-navigation').click();
  await page.getByRole('complementary', { name: 'Navigazione del Registro' })
    .getByRole('button', { name, exact: true }).click();
}

async function closeSavedNotice(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await heading.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  }
}

test('IMPORT-01 mobile: teacher scope, explicit confirmation, durable import and unchanged retry', async ({ page }) => {
  const dialogMessages = [];
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();

  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closeSavedNotice(page);
  const privacyShield = page.getByRole('button', { name: /LIM Shield Attivo/ });
  if (await privacyShield.isVisible().catch(() => false)) await privacyShield.click();

  await page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)').fill(STUDENT_NAME);
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  // The mobile list can mask names; the form resets only after the durable save.
  await expect(page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)')).toHaveValue('');
  await closeSavedNotice(page);

  await page.goto(`${baseURL}/?mode=student&test=energia&class=${encodeURIComponent(CLASS_NAME)}`, {
    waitUntil: 'domcontentloaded'
  });
  await expect(page.getByRole('heading', { name: 'Sblocca Registro' })).toBeVisible();
  await page.locator('#vault-password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  await expect(page.getByRole('heading', { name: "A cosa serve l'energia" })).toBeVisible();
  await page.getByPlaceholder('es. Rossi Maria').fill(STUDENT_NAME);
  await page.getByRole('button', { name: /Inizia Flashcard/ }).click();
  for (let question = 1; question <= 10; question += 1) {
    await expect(page.getByText(`Domanda ${question} di 10`, { exact: true })).toBeVisible();
    await page.locator('button.w-full.text-left').first().click();
    if (question < 10) await page.getByRole('button', { name: /Prossima Scheda/ }).click();
  }
  await page.getByRole('button', { name: /Completa e Consegna/ }).click();
  await expect(page.getByRole('heading', { name: 'Flashcard Completata con Successo!' })).toBeVisible();
  await page.getByRole('button', { name: 'Torna al Registro', exact: true }).click();

  await openDrawerItem(page, 'Verifiche online');
  await page.getByRole('button', { name: 'Esiti & Item Analysis (1)', exact: true }).click();
  await expect(page.getByRole('heading', {
    name: 'Consegne Ricevute dagli Alunni (1)', exact: true
  })).toBeVisible();

  const importButton = page.getByTestId('import-01-confirmed-scope');
  await expect(importButton).toBeVisible();
  await expect(importButton).toBeDisabled();
  await expect(page.getByLabel('Classe per importazione esiti')).toHaveValue('');
  await expect(page.getByLabel('Verifica per importazione esiti')).toHaveValue('');
  await expect(page.getByLabel('Periodo per importazione esiti')).toHaveValue('');

  await page.getByLabel('Classe per importazione esiti').selectOption({ label: CLASS_NAME });
  await page.getByLabel('Verifica per importazione esiti').selectOption('energia');
  await expect(importButton).toBeDisabled();
  await page.getByLabel('Periodo per importazione esiti').selectOption('Q1');
  await expect(importButton).toBeDisabled();
  await page.getByLabel('UDA di destinazione per importazione esiti').selectOption('none');
  await expect(importButton).toBeEnabled();

  let cancelNextImport = false;
  page.on('dialog', async dialog => {
    dialogMessages.push({ type: dialog.type(), message: dialog.message() });
    if (cancelNextImport && dialog.type() === 'confirm') {
      cancelNextImport = false;
      await dialog.dismiss();
      return;
    }
    await dialog.accept();
  });
  await importButton.click();
  await expect.poll(() => dialogMessages.some(d =>
    d.type === 'confirm' && d.message.includes('Nuove valutazioni: 1')
    && d.message.includes(`Classe: ${CLASS_NAME}`)
    && d.message.includes("Verifica: A cosa serve l'energia")
    && d.message.includes('Periodo: Q1')
    && d.message.includes('UDA di destinazione scelta: Nessuna')
    && d.message.includes('non certifica la provenienza storica')
  )).toBe(true);
  await expect.poll(() => dialogMessages.some(d =>
    d.type === 'alert' && d.message.includes('Importazione completata con successo! 1')
  )).toBe(true);
  await closeSavedNotice(page);

  await importButton.click();
  await expect.poll(() => dialogMessages.some(d =>
    d.type === 'alert' && d.message.includes('Nessuna nuova valutazione importabile')
  )).toBe(true);

  // A7: changing a source test invalidates both dependent choices.
  await page.getByLabel('Verifica per importazione esiti').selectOption('');
  await expect(page.getByLabel('Periodo per importazione esiti')).toHaveValue('');
  await expect(page.getByLabel('UDA di destinazione per importazione esiti')).toHaveValue('');
  await expect(importButton).toBeDisabled();

  await page.getByLabel('Verifica per importazione esiti').selectOption('energia');
  await page.getByLabel('Periodo per importazione esiti').selectOption('Q1');
  await page.getByLabel('UDA di destinazione per importazione esiti').selectOption('none');
  // Changing class invalidates source test, period and destination UDA.
  await page.getByLabel('Classe per importazione esiti').selectOption('');
  await expect(page.getByLabel('Verifica per importazione esiti')).toHaveValue('');
  await expect(page.getByLabel('Periodo per importazione esiti')).toHaveValue('');
  await expect(page.getByLabel('UDA di destinazione per importazione esiti')).toHaveValue('');
  await expect(importButton).toBeDisabled();

  // A3: create another synthetic submission for the SAME student, then
  // dismiss confirmation. The existing grade must remain untouched.
  await page.goto(`${baseURL}/?mode=student&test=energia&class=${encodeURIComponent(CLASS_NAME)}`, {
    waitUntil: 'domcontentloaded'
  });
  await expect(page.getByRole('heading', { name: 'Sblocca Registro' })).toBeVisible();
  await page.locator('#vault-password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  await expect(page.getByRole('heading', { name: "A cosa serve l'energia" })).toBeVisible();
  await page.getByPlaceholder('es. Rossi Maria').fill(STUDENT_NAME);
  await page.getByRole('button', { name: /Inizia Flashcard/ }).click();
  for (let question = 1; question <= 10; question += 1) {
    await expect(page.getByText(`Domanda ${question} di 10`, { exact: true })).toBeVisible();
    await page.locator('button.w-full.text-left').first().click();
    if (question < 10) await page.getByRole('button', { name: /Prossima Scheda/ }).click();
  }
  await page.getByRole('button', { name: /Completa e Consegna/ }).click();
  await expect(page.getByRole('heading', { name: 'Flashcard Completata con Successo!' })).toBeVisible();
  await page.getByRole('button', { name: 'Torna al Registro', exact: true }).click();
  await openDrawerItem(page, 'Verifiche online');
  await page.getByRole('button', { name: 'Esiti & Item Analysis (2)', exact: true }).click();
  await expect(page.getByRole('heading', {
    name: 'Consegne Ricevute dagli Alunni (2)', exact: true
  })).toBeVisible();

  const selectImportScope = async () => {
    await page.getByLabel('Classe per importazione esiti').selectOption({ label: CLASS_NAME });
    await page.getByLabel('Verifica per importazione esiti').selectOption('energia');
    await page.getByLabel('Periodo per importazione esiti').selectOption('Q1');
    await page.getByLabel('UDA di destinazione per importazione esiti').selectOption('none');
    await expect(importButton).toBeEnabled();
  };
  await selectImportScope();

  const checkCancelledPreview = async () => {
    cancelNextImport = true;
    const countBefore = dialogMessages.length;
    await importButton.click();
    const newDialogs = dialogMessages.slice(countBefore);
    expect(newDialogs.some(d => d.type === 'confirm'
      && d.message.includes('Nuove valutazioni: 1')
      && d.message.includes('Già presenti e non modificate: 1')
      && d.message.includes('Consegne escluse da verificare: 0')
    )).toBe(true);
    expect(newDialogs.some(d => d.type === 'alert'
      && d.message.includes('Importazione completata'))).toBe(false);
  };

  await checkCancelledPreview();
  // Reopening the preview must still find the same new submission: a
  // cancelled confirmation did not write any new grade.
  await checkCancelledPreview();

  // A5 + A3 durable boundary: after a hard reload the first import remains,
  // while the cancelled second submission remains unimported.
  await page.reload({ waitUntil: 'domcontentloaded' });
  const unlockHeading = page.getByRole('heading', { name: 'Sblocca Registro' });
  if (await unlockHeading.isVisible().catch(() => false)) {
    await page.locator('#vault-password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  }
  const importsHeading = page.getByRole('heading', {
    name: 'Consegne Ricevute dagli Alunni (2)', exact: true
  });
  if (!(await importsHeading.isVisible().catch(() => false))) {
    await openDrawerItem(page, 'Verifiche online');
    await page.getByRole('button', { name: 'Esiti & Item Analysis (2)', exact: true }).click();
  }
  await expect(importsHeading).toBeVisible();
  await selectImportScope();
  await checkCancelledPreview();

  const overflow = await page.evaluate(() =>
    Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await fs.mkdir(evidenceDir, { recursive: true });
  await page.screenshot({
    path: path.join(evidenceDir, 'int-02-import-01-mobile-390.png'),
    fullPage: true
  });
});
