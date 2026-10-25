const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const vaultPassword = 'ux-trust-01-qualification-only';
const CLASS_NAME = 'Classe Sintetica UXT-A';

test.setTimeout(120000);

async function setupFreshVault(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function closePersistenceConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  await expect(heading).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(heading).toBeHidden();
}

test('UXT-A compact Vault stays touch-safe above mobile workflow navigation — 390x844', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error instanceof Error ? error.message : String(error)));

  await setupFreshVault(page);

  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);

  const autoLock = page.locator('#vault-auto-lock-mobile');
  const lockButton = page.locator('button[aria-label="Blocca Registro"]');
  const cluster = autoLock.locator('..');
  const bottomNavButton = page.getByRole('button', { name: 'Riepilogo', exact: true });

  await expect(autoLock).toBeVisible();
  await expect(lockButton).toBeVisible();
  await expect(bottomNavButton).toBeVisible();

  const clusterBox = await cluster.boundingBox();
  const autoLockBox = await autoLock.boundingBox();
  const lockBox = await lockButton.boundingBox();
  const navBox = await bottomNavButton.locator('..').boundingBox();

  expect(clusterBox).not.toBeNull();
  expect(autoLockBox).not.toBeNull();
  expect(lockBox).not.toBeNull();
  expect(navBox).not.toBeNull();

  expect(clusterBox.width).toBeLessThanOrEqual(200);
  expect(autoLockBox.height).toBeGreaterThanOrEqual(44);
  expect(lockBox.width).toBeGreaterThanOrEqual(44);
  expect(lockBox.height).toBeGreaterThanOrEqual(44);
  expect(clusterBox.y + clusterBox.height).toBeLessThanOrEqual(navBox.y + 1);

  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  expect(pageErrors).toEqual([]);
  await context.close();
});

test('UXT-A desktop Vault controls preserve auto-lock and manual lock semantics — 1280x900', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error instanceof Error ? error.message : String(error)));

  await setupFreshVault(page);

  const autoLock = page.locator('#vault-auto-lock-desktop');
  const lockButton = page.getByRole('button', { name: 'Blocca Registro', exact: true });

  await expect(autoLock).toBeVisible();
  await expect(lockButton).toBeVisible();
  await autoLock.selectOption('30');
  await expect(autoLock).toHaveValue('30');

  await lockButton.click();
  await expect(page.getByRole('heading', { name: 'Sblocca Registro' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
  await expect(page.locator('#vault-auto-lock-desktop')).toHaveValue('30');

  expect(pageErrors).toEqual([]);
  await context.close();
});


test('UXT-B encrypted backup shortcut and sufficiency denominator are truthful — desktop 1280x900', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error instanceof Error ? error.message : String(error)));

  const className = 'Classe Sintetica UXT-B';
  const studentA = 'Studente Valutato UXT-B';
  const studentB = 'Studente Non Valutato UXT-B';
  const evaluationTitle = 'Valutazione Sintetica UXT-B';

  await setupFreshVault(page);

  page.once('dialog', dialog => dialog.accept(className));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${className}` })).toBeVisible();
  await closePersistenceConfirmation(page);

  const activeShield = page.getByRole('button', { name: /LIM Shield Attivo/ });
  await expect(activeShield).toBeVisible();
  await activeShield.click();

  const studentInput = page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)');
  await studentInput.fill(studentA);
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(page.getByText(studentA, { exact: true })).toBeVisible();
  await studentInput.fill(studentB);
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(page.getByText(studentB, { exact: true })).toBeVisible();

  const workflowHub = page.getByRole('button', { name: 'Riepilogo', exact: true }).locator('..');
  await workflowHub.getByRole('button', { name: 'Valutazioni', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();
  await page.getByPlaceholder('es. Verifica su Fonti Rinnovabili').fill(evaluationTitle);

  const studentARow = page.getByText(studentA, { exact: true }).locator('..').locator('..');
  await studentARow.locator('input[type="text"]').fill('8');
  await page.getByRole('button', { name: 'Salva Valutazioni di Classe', exact: true }).click();
  await closePersistenceConfirmation(page);
  await expect(page.getByText(evaluationTitle, { exact: true })).toBeVisible();

  const workflowHubAfterSave = page.getByRole('button', { name: 'Riepilogo', exact: true }).locator('..');
  await workflowHubAfterSave.getByRole('button', { name: 'Riepilogo', exact: true }).click();
  await expect(page.getByRole('heading', { name: `Panoramica Sezione: ${className}` })).toBeVisible();
  await expect(page.getByText('2 alunni iscritti', { exact: true })).toBeVisible();

  const sufficiencyCard = page.getByText('Tasso Sufficienze', { exact: true }).locator('..');
  await expect(sufficiencyCard.getByText('100%', { exact: true })).toBeVisible();
  await expect(sufficiencyCard.getByText('1 su 1 con media disponibile', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Riepilogo', exact: true }).locator('xpath=../..').getByRole('button', { name: 'Classi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Sintesi', exact: true }).click();
  await expect(page.getByText(/Ultimo backup cifrato:/)).toBeVisible();
  const encryptedBackupShortcut = page.getByRole('main').getByRole('button', { name: 'Esporta backup cifrato', exact: true });
  await expect(encryptedBackupShortcut).toBeVisible();
  await encryptedBackupShortcut.click();
  await expect(page.getByRole('heading', { name: /Privacy First & Protezione dei dati/ })).toBeVisible();

  expect(pageErrors).toEqual([]);
  await context.close();
});

test('UXT-C strong competency profile stays relative while below-threshold evidence is absolute — desktop 1280x900', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error instanceof Error ? error.message : String(error)));

  const className = 'Classe Sintetica UXT-C';
  const strongStudent = 'Profilo Forte UXT-C';
  const weakStudent = 'Profilo Sotto Soglia UXT-C';

  await setupFreshVault(page);

  page.once('dialog', dialog => dialog.accept(className));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${className}` })).toBeVisible();
  await closePersistenceConfirmation(page);

  const activeShield = page.getByRole('button', { name: /LIM Shield Attivo/ });
  await expect(activeShield).toBeVisible();
  await activeShield.click();

  const studentInput = page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)');
  await studentInput.fill(strongStudent);
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(page.getByText(strongStudent, { exact: true })).toBeVisible();
  await studentInput.fill(weakStudent);
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(page.getByText(weakStudent, { exact: true })).toBeVisible();

  const workflowHub = page.getByRole('button', { name: 'Riepilogo', exact: true }).locator('..');
  await workflowHub.getByRole('button', { name: 'Valutazioni', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();

  const evaluationForm = page.locator('form');
  const typeSelect = evaluationForm.locator('label').filter({ hasText: 'Tipologia Prova' }).locator('..').locator('select');
  await typeSelect.selectOption('test');
  await evaluationForm.getByPlaceholder('es. Verifica su Fonti Rinnovabili').fill('CAD avanzato UXT-C');
  await evaluationForm.getByText(strongStudent, { exact: true }).locator('..').locator('..').locator('input[type="text"]').fill('9.4');
  await evaluationForm.getByText(weakStudent, { exact: true }).locator('..').locator('..').locator('input[type="text"]').fill('5.4');
  await page.getByRole('button', { name: 'Salva Valutazioni di Classe', exact: true }).click();
  await closePersistenceConfirmation(page);
  await expect(page.getByText('CAD avanzato UXT-C', { exact: true })).toBeVisible();

  const workflowHubAfterFirstEvaluation = page.getByRole('button', { name: 'Riepilogo', exact: true }).locator('..');
  await workflowHubAfterFirstEvaluation.getByRole('button', { name: 'Valutazioni', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();
  const secondEvaluationForm = page.locator('form');
  const secondTypeSelect = secondEvaluationForm.locator('label').filter({ hasText: 'Tipologia Prova' }).locator('..').locator('select');
  await secondTypeSelect.selectOption('orale');
  await secondEvaluationForm.getByPlaceholder('es. Verifica su Fonti Rinnovabili').fill('Colloquio tecnico UXT-C');
  await secondEvaluationForm.getByText(strongStudent, { exact: true }).locator('..').locator('..').locator('input[type="text"]').fill('9.1');
  await secondEvaluationForm.getByText(weakStudent, { exact: true }).locator('..').locator('..').locator('input[type="text"]').fill('7.2');
  await page.getByRole('button', { name: 'Salva Valutazioni di Classe', exact: true }).click();
  await closePersistenceConfirmation(page);
  await expect(page.getByText('Colloquio tecnico UXT-C', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Scheda alunno', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Scheda Alunno & Profilo delle Competenze' })).toBeVisible();

  const reportSelect = page.locator('select').filter({
    has: page.locator('option', { hasText: strongStudent })
  });
  await expect(reportSelect).toHaveCount(1);
  await reportSelect.selectOption({ label: strongStudent });

  const evidenceSummary = page.locator('summary').filter({ hasText: 'Profilo interno di evidenze' });
  await expect(evidenceSummary).toBeVisible();
  await evidenceSummary.click();

  await expect(page.getByText('Area da Consolidare:', { exact: true })).toBeHidden();
  await expect(page.getByText('Area di crescita relativa:', { exact: true })).toBeVisible();
  await expect(page.getByText('3/6 con evidenze', { exact: true })).toBeVisible();

  await reportSelect.selectOption({ label: weakStudent });
  await expect(page.getByText('Area da Consolidare:', { exact: true })).toBeVisible();
  await expect(page.getByText('Area di crescita relativa:', { exact: true })).toBeHidden();
  await expect(page.getByText('3/6 con evidenze', { exact: true })).toBeVisible();

  expect(pageErrors).toEqual([]);
  await context.close();
});

test('UXT-D active UDA without formal evidence stays watch while an ended gap is critical — desktop 1280x900', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error instanceof Error ? error.message : String(error)));

  const className = 'Classe Sintetica UXT-D';
  const activeUdaTitle = 'UDA Attiva UXT-D';
  const endedUdaTitle = 'UDA Conclusa UXT-D';

  await setupFreshVault(page);

  page.once('dialog', dialog => dialog.accept(className));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${className}` })).toBeVisible();
  await closePersistenceConfirmation(page);

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'UDA', exact: true }).click();

  const createUda = async ({ title, startMonth, duration }) => {
    await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nuova Unità Didattica (UDA)' })).toBeVisible();
    await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(title);
    const classSelect = page.getByLabel('Classe', { exact: true });
    await classSelect.selectOption({ label: className });
    await page.locator('label').filter({ hasText: 'Mese Inizio' }).locator('..').locator('select').selectOption(String(startMonth));
    const durationInput = page.locator('label').filter({ hasText: 'Durata Mesi' }).locator('..').locator('input[type="number"]');
    await durationInput.fill(String(duration));
    await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
    await expect(page.getByText(`Nuova UDA "${title}" creata con successo`, { exact: true })).toBeVisible();
  };

  await createUda({ title: activeUdaTitle, startMonth: 1, duration: 3 });
  await createUda({ title: endedUdaTitle, startMonth: 0, duration: 1 });

  await page.getByRole('button', { name: /Gap Analysis Competenze/ }).click();
  await expect(page.getByRole('heading', { name: /Gap Analysis Competenze & Verifiche Oggettive/ })).toBeVisible();

  const activeCard = page.getByText(activeUdaTitle, { exact: true }).last().locator('xpath=ancestor::div[contains(@class,"rounded-xl") and contains(@class,"border")][1]');
  const endedCard = page.getByText(endedUdaTitle, { exact: true }).last().locator('xpath=ancestor::div[contains(@class,"rounded-xl") and contains(@class,"border")][1]');

  await expect(activeCard.getByText('DA MONITORARE', { exact: true })).toBeVisible();
  await expect(activeCard.getByText(/GAP CRITICO/)).toHaveCount(0);
  await expect(activeCard.getByText('Prossimo passo: Monitora la copertura e collega evidenze coerenti man mano che emergono.', { exact: true })).toBeVisible();

  await expect(endedCard.getByText(/CRITIC/)).toBeVisible();

  expect(pageErrors).toEqual([]);
  await context.close();
});


test('UXT-E mobile analytics keeps class summary first and student detail disclosed without page overflow — mobile 390x844', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error instanceof Error ? error.message : String(error)));

  await setupFreshVault(page);
  page.once('dialog', dialog => dialog.accept('Classe Sintetica UXT-E'));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await closePersistenceConfirmation(page);
  await page.getByRole('button', { name: 'Riepilogo', exact: true }).click();
  await page.getByRole('main').getByRole('button', { name: 'Analisi', exact: true }).click();
  await expect(page.getByText('Analisi medie & fasce analitiche', { exact: true })).toBeVisible();

  const studentDetail = page.getByTestId('mobile-analytics-student-detail');
  await expect(studentDetail).toBeVisible();
  await expect(studentDetail.locator('summary')).toContainText('Dettaglio alunni');
  await expect(studentDetail.getByPlaceholder('Cerca alunno')).toBeHidden();
  await studentDetail.locator('summary').click();
  await expect(studentDetail.getByPlaceholder('Cerca alunno')).toBeVisible();
  await expect(studentDetail.getByRole('combobox')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(pageErrors).toEqual([]);
  await context.close();
});

test('UXT-E desktop analytics retains the dense student table — desktop 1280x900', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error instanceof Error ? error.message : String(error)));

  await setupFreshVault(page);
  page.once('dialog', dialog => dialog.accept('Classe Desktop UXT-E'));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await closePersistenceConfirmation(page);
  await page.getByRole('button', { name: 'Riepilogo', exact: true }).click();
  await page.getByRole('main').getByRole('button', { name: 'Analisi', exact: true }).click();

  const denseTable = page.locator('table').filter({ hasText: 'MEDIA ANNO' });
  await expect(denseTable).toBeVisible();
  await expect(page.getByTestId('mobile-analytics-student-detail')).toBeHidden();
  expect(pageErrors).toEqual([]);
  await context.close();
});
