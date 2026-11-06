const { test, expect } = require('@playwright/test');
const { navigationButton, privacyButton, settleOggiNavigation } = require('./header01-navigation.cjs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const CLASS_NAME = '2C Sintetica FLOW-03';
const STUDENT_NAME = 'Rossi Mario';
const UDA_TITLE = 'UDA FLOW-03 Energia e sistemi';
const RAPID_NOTE = 'Osservazione temporanea FLOW-03: riprendere il passaggio sul rendimento energetico.';
const LESSON_TOPIC = 'Bilancio energetico del sistema tecnico';
const STANDALONE_EVALUATION_TITLE = 'Valutazione autonoma FLOW-03';

function evidencePath(name) {
  const dir = process.env.EVIDENCE_DIR;
  return dir ? path.resolve(dir, name) : name;
}

function installPageErrorCollector(page) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error instanceof Error ? error.message : String(error)));
  return pageErrors;
}

async function configureVault(page, password) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
}

async function closePersistenceConfirmationIfPresent(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await heading.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(heading).toBeHidden();
  }
}

async function disablePrivacyShield(page) {
  const shield = privacyButton(page);
  await expect(shield).toBeVisible();
  await shield.click();
}

async function openOggiFromDrawer(page) {
  await navigationButton(page).click();
  const drawer = page.getByRole('complementary');
  const oggi = drawer.getByRole('button', { name: 'Oggi', exact: true });
  await expect(oggi).toBeVisible();
  await oggi.click();
  await settleOggiNavigation(page);
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
}

async function createSyntheticClassWithStudent(page) {
  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmationIfPresent(page);
  await disablePrivacyShield(page);

  const studentInput = page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)');
  await studentInput.fill(STUDENT_NAME);
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(page.getByText(STUDENT_NAME, { exact: true })).toBeVisible();
  await closePersistenceConfirmationIfPresent(page);
  await expect(studentInput).toHaveValue('');
  await openOggiFromDrawer(page);
}

async function openPreparationRouter(page) {
  await page.getByRole('button', { name: 'Prepara', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Per continuare con Prepara, scegli una classe.');
  await page.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true }).click();
  const router = page.getByRole('region', { name: `Prepara per ${CLASS_NAME}` });
  await expect(router).toBeVisible();
  return router;
}

async function createSyntheticUda(page) {
  const router = await openPreparationRouter(page);
  await router.getByRole('button', { name: /^Sviluppa UDA o lezione/ }).click();
  await expect(page.getByRole('heading', { name: 'Unità didattiche', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Nuova Unità Didattica (UDA)' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Titolo', { exact: true }).fill(UDA_TITLE);
  const selects = dialog.locator('select');
  const classSelect = selects.nth(0);
  const startMonthSelect = selects.nth(2);
  await expect(classSelect).toBeVisible();
  await classSelect.selectOption({ label: CLASS_NAME });
  await expect(classSelect).toHaveValue(CLASS_NAME);
  await expect(startMonthSelect).toBeVisible();
  await startMonthSelect.selectOption('2');
  await expect(startMonthSelect).toHaveValue('2');
  const durationInput = dialog.getByRole('spinbutton', { name: 'Durata Mesi', exact: true });
  await durationInput.fill('2');
  await expect(durationInput).toHaveValue('2');
  await dialog.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await closePersistenceConfirmationIfPresent(page);
  await expect(page.getByRole('status')).toContainText(`Nuova UDA "${UDA_TITLE}" creata con successo`);
  await openOggiFromDrawer(page);
}

async function prepareScenario(page, password) {
  await configureVault(page, password);
  await createSyntheticClassWithStudent(page);
  await createSyntheticUda(page);
}

async function selectPendingClass(page, actionLabel) {
  await expect(page.getByRole('status')).toContainText(`Per continuare con ${actionLabel}, scegli una classe.`);
  await page.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true }).click();
}

async function openRecordFromOggi(page) {
  await page.getByRole('button', { name: 'Registra', exact: true }).click();
  await selectPendingClass(page, 'Registra');
  const record = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
  await expect(record).toBeVisible();
  await expect(record).toContainText(CLASS_NAME);
  await expect(record).toContainText('Bozza temporanea — non ancora registrata');
  return record;
}

async function openConductFromOggi(page) {
  await page.getByRole('button', { name: 'Conduci', exact: true }).click();
  await selectPendingClass(page, 'Conduci');
  const panel = page.getByRole('region', { name: `Conduci per ${CLASS_NAME}` });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(UDA_TITLE);
  return panel;
}

async function assertSelectedClassStillVisible(page) {
  const quickSwitcher = page.locator('select[title="Cambia rapidamente classe attiva"]');
  if (await quickSwitcher.isVisible().catch(() => false)) {
    await expect.poll(() => quickSwitcher.evaluate(select =>
      select.selectedOptions[0]?.textContent?.trim() ?? ''
    )).toBe(CLASS_NAME);
    return;
  }

  await expect.poll(async () => {
    const labels = page.getByText(CLASS_NAME, { exact: true });
    const count = await labels.count();
    for (let index = 0; index < count; index += 1) {
      if (await labels.nth(index).isVisible()) return true;
    }
    return false;
  }).toBe(true);
}

async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function assertCriticalControlsTouchSafe(record) {
  for (const label of ['Chiudi Registra', 'Valutazione', 'Comportamento', 'Esiti verifica online', 'Attività / nota UDA']) {
    const button = record.getByRole('button', { name: label, exact: true });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
}

async function assertStagedNoteTextareaUnobscured(page, record) {
  const textarea = record.getByLabel('Nota di sessione', { exact: true });
  await textarea.scrollIntoViewIfNeeded();
  const box = await textarea.boundingBox();
  expect(box).not.toBeNull();

  const overlaps = await page.evaluate((textareaBox) => {
    const target = {
      left: textareaBox.x,
      top: textareaBox.y,
      right: textareaBox.x + textareaBox.width,
      bottom: textareaBox.y + textareaBox.height
    };
    const intersects = (a, b) => !(
      a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom
    );

    return [...document.querySelectorAll('body *')]
      .filter(element => {
        const style = getComputedStyle(element);
        return style.position === 'fixed' && style.visibility !== 'hidden' && style.display !== 'none';
      })
      .map(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      })
      .filter(rect => intersects(target, rect));
  }, box);

  expect(overlaps).toEqual([]);
}

async function assertNoAutomaticMutation(page) {
  await page.waitForTimeout(120);
  await expect(page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' })).toBeHidden();
}

async function assertRecordMission(page, evidenceLabel) {
  const mission = page.getByRole('region', { name: `Missione Registra per ${CLASS_NAME}` });
  await expect(mission).toBeVisible();
  await expect(mission).toContainText(`Stai registrando · ${CLASS_NAME}`);
  await expect(mission).toContainText(evidenceLabel);
  const returnButton = mission.getByRole('button', { name: 'Torna a Registra', exact: true });
  await expect(returnButton).toBeVisible();
  const box = await returnButton.boundingBox();
  expect(box).not.toBeNull();
  expect(box.height).toBeGreaterThanOrEqual(44);
  return mission;
}

async function handoffConductToRecord(page, panel) {
  const note = panel.getByLabel('Nota rapida', { exact: true });
  await note.fill(RAPID_NOTE);
  await expect(note).toHaveValue(RAPID_NOTE);
  await panel.getByRole('button', { name: 'Vai a Registra', exact: true }).click();

  const record = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
  await expect(record).toBeVisible();
  await expect(record.getByLabel('Nota di sessione', { exact: true })).toHaveValue(RAPID_NOTE);
  await expect(record).toContainText('Bozza temporanea — non ancora registrata');
  await assertNoAutomaticMutation(page);
  return record;
}

async function openEvaluationFromRecord(page, record) {
  await record.getByRole('button', { name: 'Valutazione', exact: true }).click();
  await expect(page.getByText('Nuova Valutazione di Classe', { exact: true })).toBeVisible();
  const udaSelect = page.getByLabel('Collega a UDA Curricolare', { exact: true });
  await expect(udaSelect).toBeVisible();
  await expect.poll(() => udaSelect.locator('option:checked').textContent()).toContain(UDA_TITLE);
  await assertSelectedClassStillVisible(page);
  await assertNoAutomaticMutation(page);
  return assertRecordMission(page, 'Valutazione');
}

async function openBehaviourFromRecord(page, record) {
  await record.getByRole('button', { name: 'Comportamento', exact: true }).click();
  await expect(page.getByText('Valutazione Rapida Comportamenti', { exact: true })).toBeVisible();
  const defaultStatus = page.getByRole('button', { name: 'Ottimale 🌟', exact: true }).first();
  await expect(defaultStatus).toBeVisible();
  await expect(defaultStatus).not.toHaveClass(/ring-2/);
  await assertSelectedClassStillVisible(page);
  await assertNoAutomaticMutation(page);
  return assertRecordMission(page, 'Comportamento');
}

async function openOnlineOutcomesFromRecord(page, record) {
  await record.getByRole('button', { name: 'Esiti verifica online', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Importa Voti nel Registro', exact: true })).toBeVisible();
  await assertSelectedClassStillVisible(page);
  await assertNoAutomaticMutation(page);

  await page.getByRole('button', { name: /Condivisione Padlet/ }).click();
  const classSelect = page.getByLabel('Classe Destinataria', { exact: true });
  await expect(classSelect).toHaveValue(CLASS_NAME);
  await assertNoAutomaticMutation(page);
  return assertRecordMission(page, 'Esiti verifica online');
}

// Conduci → Registra → Valutazione, so the UDA context is explicit and safe.
test.describe('FLOW-03 desktop qualification', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Registra → Valutazione keeps explicit class/UDA context without writing', async ({ page }) => {
  const pageErrors = installPageErrorCollector(page);
  await prepareScenario(page, 'flow-03-desktop');
  const conduct = await openConductFromOggi(page);
  const record = await handoffConductToRecord(page, conduct);
  await assertSelectedClassStillVisible(page);
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: evidencePath('flow-03-desktop-record.png'), fullPage: true });

  let mission = await openEvaluationFromRecord(page, record);
  await page.screenshot({ path: evidencePath('flow-03-desktop-evaluation-mission.png'), fullPage: true });

  await mission.getByRole('button', { name: 'Torna a Registra', exact: true }).click();
  const returnedRecord = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
  await expect(returnedRecord).toBeVisible();
  await expect(returnedRecord.getByLabel('Nota di sessione', { exact: true })).toHaveValue(RAPID_NOTE);
  await page.screenshot({ path: evidencePath('flow-03-desktop-return-to-record.png'), fullPage: true });

  mission = await openEvaluationFromRecord(page, returnedRecord);
  await expect(mission).toBeVisible();

  // Ordinary navigation must invalidate Registra before a later standalone evaluation.
  await navigationButton(page).click();
  const drawer = page.getByRole('complementary');
  await drawer.getByRole('button', { name: 'Storico prove', exact: true }).click();
  await expect(mission).toBeHidden();
  await expect(page.getByRole('heading', { name: `Storico Prove Registrate: ${CLASS_NAME}` })).toBeVisible();
  await page.getByRole('button', { name: /Nuova Valutazione/ }).click();
  await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();
  await expect(mission).toBeHidden();
  await page.getByPlaceholder('es. Verifica su Fonti Rinnovabili').fill(STANDALONE_EVALUATION_TITLE);
  await page.getByRole('button', { name: 'Tutti 8', exact: true }).click();
  await page.getByRole('button', { name: 'Salva Valutazioni di Classe', exact: true }).click();
  await closePersistenceConfirmationIfPresent(page);
  await expect(page.getByRole('heading', { name: `Storico Prove Registrate: ${CLASS_NAME}` })).toBeVisible();
  await expect(page.getByText(STANDALONE_EVALUATION_TITLE, { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: `Registra per ${CLASS_NAME}` })).toBeHidden();
  await page.screenshot({ path: evidencePath('flow-03-desktop-standalone-evaluation.png'), fullPage: true });
  expect(pageErrors).toEqual([]);
});
});

test.describe('FLOW-03B desktop post-record UX qualification', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('keeps backup maintenance quiet and contextualizes Rivedi after an evaluation save', async ({ page }) => {
    const pageErrors = installPageErrorCollector(page);
    await prepareScenario(page, 'flow-03b-desktop-review');

    const conduct = await openConductFromOggi(page);
    const record = await handoffConductToRecord(page, conduct);
    const overview = page.locator('[data-testid="flow03b-class-overview"]');
    const floatingCopilot = page.locator('[data-testid="library-copilot-trigger"]');
    await expect(overview).toHaveJSProperty('open', false);
    await expect(floatingCopilot).toBeHidden();
    await expect(record.getByRole('button', { name: 'Copilota', exact: true })).toBeVisible();

    const mission = await openEvaluationFromRecord(page, record);
    await expect(mission.getByRole('button', { name: 'Copilota', exact: true })).toBeVisible();
    await expect(floatingCopilot).toBeHidden();

    await page.getByPlaceholder('es. Verifica su Fonti Rinnovabili').fill('Valutazione FLOW-03B');
    await page.getByRole('button', { name: 'Tutti 8', exact: true }).click();
    await page.getByRole('button', { name: 'Salva Valutazioni di Classe', exact: true }).click();

    const savedRecord = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
    await expect(savedRecord).toContainText('Registrazione completata');
    await expect(page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' })).toBeHidden();
    await expect(overview).toHaveJSProperty('open', true);
    await expect(floatingCopilot).toBeVisible();

    await savedRecord.getByRole('button', { name: 'Rivedi', exact: true }).click();
    const review = page.getByRole('region', { name: `Rivedi la classe ${CLASS_NAME}` });
    await expect(review).toContainText("L'ordine delle superfici riflette il tipo di evidenza appena registrata");
    const expectedReviewOrder = ['Tabellone', 'Analisi', 'Storico', 'Scheda alunno'];
    const positionedReviewOptions = [];
    for (const label of expectedReviewOrder) {
      const option = review.getByRole('button', { name: new RegExp(`^${label}`) });
      await expect(option).toBeVisible();
      const box = await option.boundingBox();
      expect(box).not.toBeNull();
      positionedReviewOptions.push({ label, y: box.y });
    }
    expect(positionedReviewOptions.sort((a, b) => a.y - b.y).map(item => item.label)).toEqual(expectedReviewOrder);
    await page.screenshot({ path: evidencePath('flow-03b-desktop-review.png'), fullPage: true });
    expect(pageErrors).toEqual([]);
  });
});

test.describe('FLOW-03 direct Registra manual UDA qualification', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('carries the staged note only after the teacher explicitly selects a same-class UDA', async ({ page }) => {
  const pageErrors = installPageErrorCollector(page);
  await prepareScenario(page, 'flow-03-manual-uda');

  const record = await openRecordFromOggi(page);
  const stagedNote = record.getByLabel('Nota di sessione', { exact: true });
  await stagedNote.fill(RAPID_NOTE);
  await expect(stagedNote).toHaveValue(RAPID_NOTE);
  await record.getByRole('button', { name: 'Attività / nota UDA', exact: true }).click();

  await assertRecordMission(page, 'Attività / nota UDA');
  const chooser = page.getByRole('region', { name: 'Seleziona UDA per Registra' });
  await expect(chooser).toBeVisible();
  await expect(chooser.getByText(UDA_TITLE, { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Viste UDA' })).toBeHidden();
  await chooser.getByRole('button', { name: 'Scegli questa UDA', exact: true }).click();

  await expect(page.getByText('Registrazione rapida', { exact: true })).toBeVisible();
  await expect(page.getByText('Diario della registrazione', { exact: true })).toBeVisible();
  const topic = page.getByPlaceholder('Argomento o fase operativa svolta...');
  const notes = page.getByPlaceholder('Note professionali opzionali sulla lezione...');
  await expect(topic).toBeVisible();
  await expect(topic).toHaveValue('');
  await expect(notes).toHaveValue(RAPID_NOTE);
  const showDetails = page.getByRole('button', { name: 'Mostra dettagli UDA', exact: true });
  await expect(showDetails).toBeVisible();
  await page.screenshot({ path: evidencePath('flow-03-direct-focused-uda.png'), fullPage: true });

  await showDetails.click();
  const hideDetails = page.getByRole('button', { name: 'Nascondi dettagli UDA', exact: true });
  await expect(hideDetails).toBeVisible();
  await expect(topic).toHaveValue('');
  await expect(notes).toHaveValue(RAPID_NOTE);
  await hideDetails.click();
  await expect(showDetails).toBeVisible();

  await topic.fill(LESSON_TOPIC);
  const lessonForm = topic.locator('xpath=ancestor::form[1]');
  await lessonForm.getByRole('button', { name: 'Registra attività', exact: true }).click();
  await closePersistenceConfirmationIfPresent(page);

  const savedRecord = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
  await expect(savedRecord).toBeVisible();
  await expect(savedRecord).toContainText('Registrazione completata');
  await expect(savedRecord.getByRole('button', { name: 'Rivedi', exact: true })).toBeVisible();
  await page.screenshot({ path: evidencePath('flow-03-direct-manual-uda-saved.png'), fullPage: true });
  expect(pageErrors).toEqual([]);
});
});

test.describe('FLOW-03 ordinary UDA navigation invalidation qualification', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('ordinary navigation after closing focused UDA does not resurrect the recording mission', async ({ page }) => {
  const pageErrors = installPageErrorCollector(page);
  await prepareScenario(page, 'flow-03-uda-ordinary-navigation');

  const record = await openRecordFromOggi(page);
  await record.getByLabel('Nota di sessione', { exact: true }).fill(RAPID_NOTE);
  await record.getByRole('button', { name: 'Attività / nota UDA', exact: true }).click();
  const mission = await assertRecordMission(page, 'Attività / nota UDA');
  const chooser = page.getByRole('region', { name: 'Seleziona UDA per Registra' });
  await expect(chooser).toBeVisible();
  await chooser.getByRole('button', { name: 'Scegli questa UDA', exact: true }).click();
  await expect(page.getByText('Registrazione rapida', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Chiudi Fascicolo', exact: true }).click();
  await expect(page.getByText('Registrazione rapida', { exact: true })).toBeHidden();

  await navigationButton(page).click();
  const drawer = page.getByRole('complementary');
  await drawer.getByRole('button', { name: 'Storico prove', exact: true }).click();
  await expect(mission).toBeHidden();
  await expect(page.getByRole('heading', { name: `Storico Prove Registrate: ${CLASS_NAME}` })).toBeVisible();

  await navigationButton(page).click();
  await drawer.getByRole('button', { name: 'UDA', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Unità didattiche', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: `Missione Registra per ${CLASS_NAME}` })).toBeHidden();
  await expect(page.getByText('Registrazione rapida', { exact: true })).toBeHidden();
  await expect(page.getByRole('group', { name: 'Viste UDA' })).toBeVisible();
  await page.screenshot({ path: evidencePath('flow-03-desktop-uda-ordinary-return.png'), fullPage: true });
  expect(pageErrors).toEqual([]);
});
});

// Conduci → Registra → diario UDA
// Registra → Comportamento
// Registra → Esiti verifica online
test.describe('FLOW-03 mobile qualification', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('records one explicit UDA lesson, then offers review and keeps other specialist routes non-mutating', async ({ page }) => {
  const pageErrors = installPageErrorCollector(page);
  await prepareScenario(page, 'flow-03-mobile');

  const conduct = await openConductFromOggi(page);
  const record = await handoffConductToRecord(page, conduct);
  const flow03bOverview = page.locator('[data-testid="flow03b-class-overview"]');
  const flow03bFloatingCopilot = page.locator('[data-testid="library-copilot-trigger"]');
  await expect(flow03bOverview).toHaveJSProperty('open', false);
  await expect(flow03bFloatingCopilot).toBeHidden();
  const flow03bInlineCopilot = record.getByRole('button', { name: 'Copilota', exact: true });
  await expect(flow03bInlineCopilot).toBeVisible();
  const flow03bInlineCopilotBox = await flow03bInlineCopilot.boundingBox();
  expect(flow03bInlineCopilotBox).not.toBeNull();
  expect(flow03bInlineCopilotBox.height).toBeGreaterThanOrEqual(44);
  await assertSelectedClassStillVisible(page);
  await assertNoHorizontalOverflow(page);
  await assertCriticalControlsTouchSafe(record);
  await assertStagedNoteTextareaUnobscured(page, record);
  await page.screenshot({ path: evidencePath('flow-03-mobile-record.png'), fullPage: true });

  await record.getByRole('button', { name: 'Attività / nota UDA', exact: true }).click();
  const mission = await assertRecordMission(page, 'Attività / nota UDA');
  await expect(mission.getByRole('button', { name: 'Copilota', exact: true })).toBeVisible();
  await expect(flow03bFloatingCopilot).toBeHidden();
  await expect(page.getByText('Registrazione rapida', { exact: true })).toBeVisible();
  await expect(page.getByText('Diario della registrazione', { exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Viste UDA' })).toBeHidden();
  const topic = page.getByPlaceholder('Argomento o fase operativa svolta...');
  const notes = page.getByPlaceholder('Note professionali opzionali sulla lezione...');
  await expect(topic).toBeVisible();
  await expect(topic).toHaveValue(UDA_TITLE);
  await expect(notes).toHaveValue(RAPID_NOTE);
  await assertSelectedClassStillVisible(page);
  await assertNoAutomaticMutation(page);
  await assertNoHorizontalOverflow(page);
  const showDetails = page.getByRole('button', { name: 'Mostra dettagli UDA', exact: true });
  await expect(showDetails).toBeVisible();
  await page.screenshot({ path: evidencePath('flow-03-mobile-focused-uda.png'), fullPage: true });

  await showDetails.click();
  const hideDetails = page.getByRole('button', { name: 'Nascondi dettagli UDA', exact: true });
  await expect(hideDetails).toBeVisible();
  await expect(topic).toHaveValue(UDA_TITLE);
  await expect(notes).toHaveValue(RAPID_NOTE);
  await hideDetails.click();
  await expect(showDetails).toBeVisible();

  // Explicit return preserves the session-only draft, unlike ordinary navigation.
  await page.getByRole('button', { name: 'Chiudi Fascicolo', exact: true }).click();
  await expect(topic).toBeHidden();
  await mission.getByRole('button', { name: 'Torna a Registra', exact: true }).click();
  const returnedRecord = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
  await expect(returnedRecord).toBeVisible();
  await expect(returnedRecord.getByLabel('Nota di sessione', { exact: true })).toHaveValue(RAPID_NOTE);
  await returnedRecord.getByRole('button', { name: 'Attività / nota UDA', exact: true }).click();
  await expect(page.getByText('Registrazione rapida', { exact: true })).toBeVisible();
  await expect(topic).toBeVisible();
  await expect(topic).toHaveValue(UDA_TITLE);
  await expect(notes).toHaveValue(RAPID_NOTE);

  await topic.fill(LESSON_TOPIC);
  const lessonForm = topic.locator('xpath=ancestor::form[1]');
  await lessonForm.getByRole('button', { name: 'Registra attività', exact: true }).click();
  await closePersistenceConfirmationIfPresent(page);

  const savedRecord = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
  await expect(savedRecord).toBeVisible();
  await expect(savedRecord).toContainText('Registrazione completata');
  await expect(savedRecord.getByRole('button', { name: 'Rivedi', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' })).toBeHidden();
  await expect(flow03bOverview).toHaveJSProperty('open', true);
  await expect(flow03bFloatingCopilot).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await page.screenshot({ path: evidencePath('flow-03-mobile-uda-saved.png'), fullPage: true });

  await savedRecord.getByRole('button', { name: 'Rivedi', exact: true }).click();
  const review = page.getByRole('region', { name: `Rivedi la classe ${CLASS_NAME}` });
  await expect(review).toBeVisible();
  await expect(review).toContainText("L'ordine delle superfici riflette il tipo di evidenza appena registrata");
  const expectedLessonReviewOrder = ['UDA e diario', 'Tabellone', 'Analisi', 'Storico'];
  const positionedLessonReviewOptions = [];
  for (const label of expectedLessonReviewOrder) {
    const option = review.getByRole('button', { name: new RegExp(`^${label}`) });
    await expect(option).toBeVisible();
    const box = await option.boundingBox();
    expect(box).not.toBeNull();
    positionedLessonReviewOptions.push({ label, y: box.y });
  }
  expect(positionedLessonReviewOptions.sort((a, b) => a.y - b.y).map(item => item.label)).toEqual(expectedLessonReviewOrder);
  await page.screenshot({ path: evidencePath('flow-03-mobile-review.png'), fullPage: true });

  await openOggiFromDrawer(page);
  const behaviourRecord = await openRecordFromOggi(page);
  const behaviourMission = await openBehaviourFromRecord(page, behaviourRecord);
  await expect(behaviourMission).toBeVisible();

  await openOggiFromDrawer(page);
  const onlineRecord = await openRecordFromOggi(page);
  const onlineMission = await openOnlineOutcomesFromRecord(page, onlineRecord);
  await expect(onlineMission).toBeVisible();
  await page.screenshot({ path: evidencePath('flow-03-mobile-final.png'), fullPage: true });
  expect(pageErrors).toEqual([]);
});
});