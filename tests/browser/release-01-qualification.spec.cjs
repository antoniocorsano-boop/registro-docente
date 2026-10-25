const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const candidateSha = process.env.CANDIDATE_SHA || 'unknown';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');
const vaultPassword = 'release-01-qualification-only';

const CLASS_NAME = 'Classe Sintetica RELEASE-01';
const STUDENT_NAME = 'Studente Sintetico RELEASE-01';
const EVALUATION_TITLE = 'Valutazione RELEASE-01';
const UDA_TITLE = 'UDA Sintetica RELEASE-01';
const ONLINE_TEST_TITLE = "A cosa serve l'energia";

test.setTimeout(120000);

async function setupFreshVault(page, targetURL = baseURL) {
  await page.goto(targetURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function unlockVault(page, expectedHeading = 'Le mie classi') {
  await expect(page.getByRole('heading', { name: 'Sblocca Registro' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  await expect(page.getByRole('heading', { name: expectedHeading })).toBeVisible();
}

async function closePersistenceConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  await expect(heading).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(heading).toBeHidden();
}

async function disablePrivacyShield(page) {
  const activeShield = page.getByRole('button', { name: /LIM Shield Attivo/ });
  if (await activeShield.isVisible().catch(() => false)) {
    await activeShield.click();
  }
}

function primaryWorkflowButton(page, label) {
  const workflowHub = page.getByRole('button', { name: 'Riepilogo', exact: true }).locator('..');
  return workflowHub.getByRole('button', { name: label, exact: true });
}

function desktopStudentRegion(page) {
  return page.locator('div.hidden.md\\:block').filter({
    has: page.getByText(STUDENT_NAME, { exact: true })
  });
}

async function selectSyntheticClassFromHome(page) {
  const classButton = page.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true });
  await expect(classButton).toBeVisible();
  await classButton.click();
  await expect(primaryWorkflowButton(page, 'Riepilogo')).toBeVisible();
}

async function openDrawerDestination(page, label) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: label, exact: true }).click();
}

async function answerThroughFinalQuestion(page) {
  for (let question = 1; question <= 10; question += 1) {
    await expect(page.getByText(`Domanda ${question} di 10`, { exact: true })).toBeVisible();
    await page.locator('button.w-full.text-left').first().click();
    if (question < 10) {
      await page.getByRole('button', { name: /Prossima Scheda/ }).click();
    }
  }
  await expect(page.getByRole('button', { name: /Completa e Consegna/ })).toBeVisible();
}

async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    rootScrollWidth: document.documentElement.scrollWidth
  }));
  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  return metrics;
}

function studentPortalURL() {
  return `${baseURL}/?mode=student&test=energia&class=${encodeURIComponent(CLASS_NAME)}`;
}

async function verifyTeacherSubmissionReceipt(page) {
  await disablePrivacyShield(page);
  await openDrawerDestination(page, 'Verifiche online');
  const resultsTab = page.getByRole('button', { name: 'Esiti & Item Analysis (1)', exact: true });
  await expect(resultsTab).toBeVisible();
  await resultsTab.click();
  await expect(page.getByRole('heading', { name: 'Consegne Ricevute dagli Alunni (1)', exact: true })).toBeVisible();

  const submissionRow = page.locator('tbody tr')
    .filter({ has: page.getByText(STUDENT_NAME, { exact: true }) })
    .filter({ has: page.getByText(CLASS_NAME, { exact: true }) })
    .filter({ has: page.getByText(ONLINE_TEST_TITLE, { exact: true }) });
  await expect(submissionRow).toHaveCount(1);
  await expect(submissionRow).toBeVisible();
  await expect(submissionRow.getByText(STUDENT_NAME, { exact: true })).toBeVisible();
  await expect(submissionRow.getByText(CLASS_NAME, { exact: true })).toBeVisible();
  await expect(submissionRow.getByText(ONLINE_TEST_TITLE, { exact: true })).toBeVisible();
}

test('RELEASE-01 integrated teacher journey survives reload and lock-unlock — desktop 1280x900', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const checkpoints = [];

  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await setupFreshVault(page);
  checkpoints.push('vault-configured');

  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);
  await disablePrivacyShield(page);

  const studentInput = page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)');
  await studentInput.fill(STUDENT_NAME);
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(page.getByText(STUDENT_NAME, { exact: true })).toBeVisible();
  checkpoints.push('class-and-student-committed');

  await primaryWorkflowButton(page, 'Valutazioni').click();
  await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();
  await page.getByPlaceholder('es. Verifica su Fonti Rinnovabili').fill(EVALUATION_TITLE);
  await page.getByRole('button', { name: 'Tutti 8', exact: true }).click();
  await page.getByRole('button', { name: 'Salva Valutazioni di Classe', exact: true }).click();
  await closePersistenceConfirmation(page);
  await expect(page.getByText(EVALUATION_TITLE, { exact: true })).toBeVisible();
  checkpoints.push('evaluation-committed');

  await primaryWorkflowButton(page, 'Comportamento').click();
  await expect(page.getByRole('heading', { name: 'Valutazione Rapida Comportamenti' })).toBeVisible();
  await page.getByRole('button', { name: '👍 Tutti Costruttivo', exact: true }).click();
  await page.getByRole('button', { name: 'Salva Registro Comportamenti', exact: true }).click();
  await closePersistenceConfirmation(page);
  await expect(primaryWorkflowButton(page, 'Riepilogo')).toBeVisible();
  checkpoints.push('behavior-committed');

  await primaryWorkflowButton(page, 'Tabellone').click();
  await expect(page.getByRole('heading', { name: `Tabellone Classe: ${CLASS_NAME}` })).toBeVisible();
  const tabelloneDesktop = desktopStudentRegion(page);
  await expect(tabelloneDesktop).toHaveCount(1);
  await expect(tabelloneDesktop).toBeVisible();
  await expect(tabelloneDesktop.locator(`th[title="${EVALUATION_TITLE}"]`)).toBeVisible();
  const tabelloneStudentRow = tabelloneDesktop.locator('tbody tr').filter({
    has: page.getByText(STUDENT_NAME, { exact: true })
  });
  await expect(tabelloneStudentRow).toHaveCount(1);
  await expect(tabelloneStudentRow).toBeVisible();
  await expect(tabelloneStudentRow.getByText('8', { exact: true })).toBeVisible();
  checkpoints.push('tabellone-continuity');

  await primaryWorkflowButton(page, 'Analisi').click();
  await expect(page.getByRole('heading', { name: 'Analisi medie & fasce analitiche' })).toBeVisible();
  const analyticsDesktop = desktopStudentRegion(page);
  await expect(analyticsDesktop).toHaveCount(1);
  await expect(analyticsDesktop).toBeVisible();
  const analyticsStudentRow = analyticsDesktop.locator('tbody tr').filter({
    has: page.getByText(STUDENT_NAME, { exact: true })
  });
  await expect(analyticsStudentRow).toHaveCount(1);
  await expect(analyticsStudentRow).toBeVisible();
  await expect(analyticsStudentRow.getByText(STUDENT_NAME, { exact: true })).toBeVisible();
  await expect(analyticsStudentRow.locator('td').nth(3)).toContainText('8,0');
  checkpoints.push('analytics-continuity');

  await openDrawerDestination(page, 'Scheda alunno');
  await expect(page.getByRole('heading', { name: 'Scheda Alunno & Profilo delle Competenze' })).toBeVisible();
  const reportSelect = page.locator('select').filter({
    has: page.locator('option', { hasText: STUDENT_NAME })
  });
  await expect(reportSelect).toHaveCount(1);
  const reportOptions = await reportSelect.locator('option').allTextContents();
  expect(reportOptions).toContain(STUDENT_NAME);
  await expect(page.getByText('8,0', { exact: true }).first()).toBeVisible();
  checkpoints.push('student-report-continuity');

  await openDrawerDestination(page, 'UDA');
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuova Unità Didattica (UDA)' })).toBeVisible();
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(UDA_TITLE);
  const udaClassSelect = page.getByRole('dialog').getByRole('combobox', { name: 'Classe', exact: true });
  await expect(udaClassSelect).toBeVisible();
  await udaClassSelect.selectOption({ label: CLASS_NAME });
  await expect(udaClassSelect).toHaveValue(CLASS_NAME);
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(`Nuova UDA "${UDA_TITLE}" creata con successo`, { exact: true })).toBeVisible();
  await expect(page.getByText(UDA_TITLE, { exact: true }).first()).toBeVisible();
  checkpoints.push('uda-committed-to-synthetic-class');

  await page.goto(studentPortalURL(), { waitUntil: 'domcontentloaded' });
  await unlockVault(page, ONLINE_TEST_TITLE);
  const classSelect = page.locator('label').filter({ hasText: /^Classe$/ }).locator('..').locator('select');
  await expect(classSelect).toHaveValue(CLASS_NAME);
  await page.getByPlaceholder('es. Rossi Maria').fill(STUDENT_NAME);
  await page.getByRole('button', { name: /Inizia Flashcard/ }).click();
  await answerThroughFinalQuestion(page);
  await page.getByRole('button', { name: /Completa e Consegna/ }).click();
  await expect(page.getByRole('heading', { name: 'Flashcard Completata con Successo!' })).toBeVisible();
  await page.getByRole('button', { name: 'Torna al Registro', exact: true }).click();
  await verifyTeacherSubmissionReceipt(page);
  checkpoints.push('online-submission-identity-committed');

  await page.screenshot({
    path: path.join(evidenceDir, 'release-01-before-reload.png'),
    fullPage: true
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await unlockVault(page);
  await selectSyntheticClassFromHome(page);
  checkpoints.push('reload-unlock-and-class-reselected');

  await page.getByRole('button', { name: 'Blocca Registro', exact: true }).click();
  await unlockVault(page);
  await selectSyntheticClassFromHome(page);
  await disablePrivacyShield(page);
  checkpoints.push('manual-lock-unlock-and-class-reselected');

  await openDrawerDestination(page, 'Gestione alunni');
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await expect(page.getByText(STUDENT_NAME, { exact: true })).toBeVisible();

  await primaryWorkflowButton(page, 'Tabellone').click();
  await expect(page.getByRole('heading', { name: `Tabellone Classe: ${CLASS_NAME}` })).toBeVisible();
  const terminalTabelloneDesktop = desktopStudentRegion(page);
  await expect(terminalTabelloneDesktop).toHaveCount(1);
  await expect(terminalTabelloneDesktop).toBeVisible();
  await expect(terminalTabelloneDesktop.locator(`th[title="${EVALUATION_TITLE}"]`)).toBeVisible();
  const terminalStudentRow = terminalTabelloneDesktop.locator('tbody tr').filter({
    has: page.getByText(STUDENT_NAME, { exact: true })
  });
  await expect(terminalStudentRow).toHaveCount(1);
  await expect(terminalStudentRow).toBeVisible();
  await expect(terminalStudentRow.getByText('8', { exact: true })).toBeVisible();

  await primaryWorkflowButton(page, 'Comportamento').click();
  await expect(page.getByRole('heading', { name: 'Valutazione Rapida Comportamenti' })).toBeVisible();
  const constructive = page.getByRole('button', { name: 'Costruttivo 👍', exact: true });
  await expect(constructive).toHaveClass(/ring-2/);

  await openDrawerDestination(page, 'UDA');
  await expect(page.getByText(UDA_TITLE, { exact: true }).first()).toBeVisible();

  await verifyTeacherSubmissionReceipt(page);
  checkpoints.push('terminal-persistence-and-submission-identity-verified');

  const overflow = await assertNoHorizontalOverflow(page);
  await page.screenshot({
    path: path.join(evidenceDir, 'release-01-terminal-persistence.png'),
    fullPage: true
  });

  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);

  const receipt = {
    candidateSha,
    result: 'PASS',
    viewport: { width: 1280, height: 900 },
    syntheticData: {
      className: CLASS_NAME,
      studentName: STUDENT_NAME,
      evaluationTitle: EVALUATION_TITLE,
      grade: '8',
      behavior: 'Costruttivo 👍',
      udaTitle: UDA_TITLE,
      udaClassName: CLASS_NAME,
      onlineSubmissionStudent: STUDENT_NAME,
      onlineSubmissionClass: CLASS_NAME,
      onlineSubmissionTest: ONLINE_TEST_TITLE
    },
    checkpoints,
    persistence: {
      reloadUnlock: true,
      manualLockUnlock: true,
      classReselectedAfterReload: true,
      classReselectedAfterManualLock: true,
      class: true,
      student: true,
      evaluation: true,
      analyticsAnnualAverage: '8,0',
      behavior: true,
      uda: true,
      submission: true,
      submissionIdentity: true
    },
    overflow,
    consoleErrors,
    pageErrors
  };

  await fs.writeFile(path.join(evidenceDir, 'release-01.json'), JSON.stringify(receipt, null, 2));
  await context.close();
});
