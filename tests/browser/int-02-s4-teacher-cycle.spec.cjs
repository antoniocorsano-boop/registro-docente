const { test, expect } = require('@playwright/test');
const { navigationButton, privacyButton, settleOggiNavigation } = require('./header01-navigation.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4173';
const CLASS_NAME = '2C Sintetica S4c';
const STUDENT_NAME = 'Studente Sintetico S4c';
const TEST_TITLE = 'S4c prova del ciclo energetico';
const QUESTION = 'Quale unita misura la potenza elettrica?';
const PASSWORD = 'synthetic-s4c-cycle-only';
const EVIDENCE = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');

test.use({ viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' });
test.setTimeout(240000);

async function closeSaveNotice(page) {
  const notice = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await notice.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(notice).toBeHidden();
  }
}

async function fromDrawer(page, label) {
  await navigationButton(page).click();
  const drawer = page.getByRole('complementary', { name: 'Navigazione del Registro' });
  await drawer.getByRole('button', { name: label, exact: true }).click();
  if (label === 'Oggi') await settleOggiNavigation(page);
}

async function checkMobileWidth(page, width) {
  await page.setViewportSize({ width, height: width === 320 ? 700 : 844 });
  await expect.poll(async () => page.evaluate(() =>
    Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
    document.documentElement.clientWidth
  )).toBeLessThanOrEqual(1);
}

async function capture(page, name) {
  await fs.mkdir(EVIDENCE, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE, name), fullPage: true, animations: 'disabled' });
}

test('INT-02/S4c: Prepara, test salvato, consegna, Registra e Rivedi mantengono classe e consenso', async ({ page }) => {
  const pageErrors = [];
  const dialogLog = [];
  let cancelImport = true;
  page.on('pageerror', error => pageErrors.push(error.message));

  // Every actor and source in this browser test is synthetic. No remote provider.
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();

  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: 'Gestione Elenco Alunni: ' + CLASS_NAME })).toBeVisible();
  await closeSaveNotice(page);
  const shield = privacyButton(page);
  if (await shield.isVisible().catch(() => false)) await shield.click();
  const studentInput = page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)');
  await studentInput.fill(STUDENT_NAME);
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(studentInput).toHaveValue('');
  await closeSaveNotice(page);

  await fromDrawer(page, 'Oggi');
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Prepara', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Per continuare con Prepara, scegli una classe.');
  await page.getByRole('button', { name: 'Apri classe ' + CLASS_NAME, exact: true }).click();
  const preparation = page.getByRole('region', { name: 'Prepara per ' + CLASS_NAME });
  await expect(preparation).toBeVisible();
  await preparation.getByRole('button', { name: /^Prepara una verifica/ }).click();
  await expect(page).toHaveURL(/tab=verifiche-online/);
  await expect(page.getByLabel('Test per condivisione')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Copia Link per Studenti' })).toBeDisabled();

  // A manual teacher action creates one new test, no source, UDA or ID inferred
  // from the class context. S3c's mocked Copilota -> unsaved editor contract
  // is qualified independently in int-02-s3c02-copilot-assessment.spec.cjs.
  await page.getByRole('button', { name: 'Editor Verifiche & UDA' }).click();
  const quick = page.locator('details').filter({ hasText: 'Oppure incolla rapidamente domande' });
  if (!(await quick.evaluate(node => node.open))) await quick.locator('summary').click();
  await quick.getByPlaceholder('Titolo della verifica (es. Disegno Tecnico e Assonometrie)').fill(TEST_TITLE);
  await quick.locator('textarea').fill(
    '1. ' + QUESTION + '\na) Watt [CORRETTA]\nb) Joule'
  );
  page.once('dialog', dialog => dialog.accept());
  await quick.getByRole('button', { name: 'Genera Test da Testo' }).click();
  await expect(page.getByRole('heading', { name: TEST_TITLE, exact: true })).toBeVisible();
  await capture(page, 'int-02-s4c-01-verifica-salvata-390.png');

  await page.getByRole('button', { name: 'Condivisione Padlet' }).click();
  const classSelect = page.getByLabel('Classe Destinataria');
  const shareSelect = page.getByLabel('Test per condivisione');
  await expect(shareSelect).toHaveValue('');
  await classSelect.selectOption({ label: CLASS_NAME });
  await expect(page.getByRole('button', { name: 'Copia Link per Studenti' })).toBeDisabled();
  // Option labels also include the number of questions. Resolve the
  // one intended test by its displayed title, then select its actual ID.
  const chosenOption = shareSelect.locator('option').filter({ hasText: TEST_TITLE });
  await expect(chosenOption).toHaveCount(1);
  const testId = await chosenOption.getAttribute('value');
  expect(testId).toBeTruthy();
  expect(testId).not.toBe('energia');
  await shareSelect.selectOption(testId);
  await expect(shareSelect).toHaveValue(testId);
  await expect(page.getByRole('button', { name: 'Prova come Alunno (Flashcard)' })).toBeEnabled();
  await checkMobileWidth(page, 320);
  await checkMobileWidth(page, 390);
  await capture(page, 'int-02-s4c-02-condivisione-consapevole-390.png');

  // Student delivery is an explicit separate navigation, not a consequence
  // of selecting a test, and does not grant authority to import a grade.
  await page.goto(BASE + '/?mode=student&test=' + encodeURIComponent(testId)
    + '&class=' + encodeURIComponent(CLASS_NAME), { waitUntil: 'domcontentloaded' });
  const unlock = page.getByRole('heading', { name: 'Sblocca Registro' });
  if (await unlock.isVisible().catch(() => false)) {
    await page.locator('#vault-password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  }
  await expect(page.getByRole('heading', { name: TEST_TITLE, exact: true })).toBeVisible();
  await page.getByPlaceholder('es. Rossi Maria').fill(STUDENT_NAME);
  await page.getByRole('button', { name: /Inizia Flashcard/ }).click();
  await expect(page.getByText('Domanda 1 di 1', { exact: true })).toBeVisible();
  await page.locator('button.w-full.text-left').first().click();
  await page.getByRole('button', { name: /Completa e Consegna/ }).click();
  await expect(page.getByRole('heading', { name: 'Flashcard Completata con Successo!' })).toBeVisible();
  await page.getByRole('button', { name: 'Torna al Registro', exact: true }).click();

  // Registra authorizes an outcome route, never an import by navigation.
  await fromDrawer(page, 'Oggi');
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Registra', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Per continuare con Registra, scegli una classe.');
  await page.getByRole('button', { name: 'Apri classe ' + CLASS_NAME, exact: true }).click();
  const record = page.getByRole('region', { name: 'Registra per ' + CLASS_NAME });
  await expect(record).toBeVisible();
  await record.getByRole('button', { name: 'Esiti verifica online', exact: true }).click();
  const importButton = page.getByTestId('import-01-confirmed-scope');
  await expect(importButton).toBeVisible();
  await expect(importButton).toBeDisabled();
  await page.getByLabel('Classe per importazione esiti').selectOption({ label: CLASS_NAME });
  await page.getByLabel('Verifica per importazione esiti').selectOption(testId);
  await page.getByLabel('Periodo per importazione esiti').selectOption('Q1');
  await expect(importButton).toBeDisabled();
  await page.getByLabel('UDA di destinazione per importazione esiti').selectOption('none');
  await expect(importButton).toBeEnabled();
  await capture(page, 'int-02-s4c-03-importazione-da-confermare-390.png');

  page.on('dialog', async dialog => {
    dialogLog.push({ type: dialog.type(), text: dialog.message() });
    if (dialog.type() === 'confirm' && cancelImport) {
      cancelImport = false;
      await dialog.dismiss();
    } else await dialog.accept();
  });
  await importButton.click();
  expect(dialogLog.some(d => d.type === 'confirm'
    && d.text.includes('Nuove valutazioni: 1')
    && d.text.includes('UDA di destinazione scelta: Nessuna'))).toBe(true);
  expect(dialogLog.some(d => d.type === 'alert'
    && d.text.includes('Importazione completata'))).toBe(false);

  // Only the second, independently confirmed action can create the grade.
  await expect(importButton).toBeEnabled();
  await importButton.click();
  await expect.poll(() => dialogLog.some(d => d.type === 'alert'
    && d.text.includes('Importazione completata con successo! 1'))).toBe(true);
  await closeSaveNotice(page);
  const savedRecord = page.getByRole('region', { name: 'Registra per ' + CLASS_NAME });
  await expect(savedRecord).toContainText('Registrazione completata');

  // Confirmed import ends in the Record router, not the online-test surface.
  // First inspect the real, same-class Rivedi handoff.
  await savedRecord.getByRole('button', { name: 'Rivedi', exact: true }).click();
  const review = page.getByRole('region', { name: 'Rivedi la classe ' + CLASS_NAME });
  await expect(review).toBeVisible();
  await expect(review).toContainText("L'ordine delle superfici riflette il tipo di evidenza appena registrata");
  await expect(review.getByRole('button', { name: /^Storico/ })).toBeVisible();
  await capture(page, 'int-02-s4c-04-rivedi-esiti-390.png');
  await checkMobileWidth(page, 320);
  await checkMobileWidth(page, 390);
  await review.getByRole('button', { name: /^Storico/ }).click();
  const mission = page.getByRole('complementary', { name: 'Sessione Rivedi per la classe ' + CLASS_NAME });
  await expect(mission).toContainText('Superficie corrente: Storico');
  await expect(page.getByRole('heading', { name: 'Storico Prove Registrate: ' + CLASS_NAME })).toBeVisible();

  // Reimport is a new explicit professional action: reopen Verifiche and
  // re-establish all four choices. An unchanged submission must not write.
  await fromDrawer(page, 'Verifiche online');
  await page.getByRole('button', { name: 'Esiti & Item Analysis (1)', exact: true }).click();
  const retryImport = page.getByTestId('import-01-confirmed-scope');
  await expect(retryImport).toBeDisabled();
  await page.getByLabel('Classe per importazione esiti').selectOption({ label: CLASS_NAME });
  await page.getByLabel('Verifica per importazione esiti').selectOption(testId);
  await page.getByLabel('Periodo per importazione esiti').selectOption('Q1');
  await page.getByLabel('UDA di destinazione per importazione esiti').selectOption('none');
  await expect(retryImport).toBeEnabled();
  const successfulImportsBeforeRetry = dialogLog.filter(d => d.type === 'alert'
    && d.text.includes('Importazione completata con successo!')).length;
  await retryImport.click();
  await expect.poll(() => dialogLog.some(d => d.type === 'alert'
    && d.text.includes('Nessuna nuova valutazione importabile'))).toBe(true);
  expect(dialogLog.filter(d => d.type === 'alert'
    && d.text.includes('Importazione completata con successo!')).length)
    .toBe(successfulImportsBeforeRetry);
  expect(pageErrors).toEqual([]);
  await fs.writeFile(path.join(EVIDENCE, 'int-02-s4c-synthetic-manifest.json'), JSON.stringify({
    candidateSha: process.env.CANDIDATE_SHA || 'local',
    synthetic: true,
    provider: 'not-called',
    className: CLASS_NAME,
    scenario: 'Prepara → Verifiche → Condivisione → consegna → Registra → Rivedi',
    images: [
      'int-02-s4c-01-verifica-salvata-390.png',
      'int-02-s4c-02-condivisione-consapevole-390.png',
      'int-02-s4c-03-importazione-da-confermare-390.png',
      'int-02-s4c-04-rivedi-esiti-390.png'
    ]
  }, null, 2));
});
