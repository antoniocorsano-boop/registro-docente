const { test, expect } = require('@playwright/test');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const CLASS_NAME = '2C Sintetica FLOW-03B';
const STUDENT_NAME = 'Rossi Mario';
const EVALUATION_TITLE = 'Valutazione FLOW-03B';

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

async function disablePrivacyShield(page) {
  const shield = page.locator('button[title^="Privacy Shield"]').first();
  await expect(shield).toBeVisible();
  await shield.click();
}

async function openOggiFromDrawer(page) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const drawer = page.getByRole('complementary');
  const oggi = drawer.getByRole('button', { name: 'Oggi', exact: true });
  await expect(oggi).toBeVisible();
  await oggi.click();
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
}

async function createSyntheticClassWithStudent(page) {
  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' })).toBeHidden();
  await disablePrivacyShield(page);

  const studentInput = page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)');
  await studentInput.fill(STUDENT_NAME);
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(studentInput).toHaveValue('');
  await expect(page.getByText(STUDENT_NAME, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' })).toBeHidden();
  await openOggiFromDrawer(page);
}

async function openRecordFromOggi(page) {
  await page.getByRole('button', { name: 'Registra', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Per continuare con Registra, scegli una classe.');
  await page.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true }).click();
  const record = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
  await expect(record).toBeVisible();
  await expect(record).toContainText('Bozza temporanea — non ancora registrata');
  return record;
}

async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function assertNoFixedOverlap(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();

  const overlaps = await page.evaluate((targetBox) => {
    const target = {
      left: targetBox.x,
      top: targetBox.y,
      right: targetBox.x + targetBox.width,
      bottom: targetBox.y + targetBox.height
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

async function assertActiveRecordFocus(page, record) {
  const overview = page.locator('[data-testid="flow03b-class-overview"]');
  const floatingCopilot = page.locator('[data-testid="library-copilot-trigger"]');
  const inlineCopilot = record.getByRole('button', { name: 'Copilota', exact: true });

  await expect(overview).toBeVisible();
  await expect(overview).toHaveJSProperty('open', false);
  await expect(floatingCopilot).toBeHidden();
  await expect(inlineCopilot).toBeVisible();
  const copilotBox = await inlineCopilot.boundingBox();
  expect(copilotBox).not.toBeNull();
  expect(copilotBox.height).toBeGreaterThanOrEqual(44);

  const note = record.getByLabel('Nota di sessione', { exact: true });
  await expect(note).toBeVisible();
  await assertNoFixedOverlap(page, note);
}

async function openEvaluationAndAssertMission(page, record) {
  await record.getByRole('button', { name: 'Valutazione', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();

  const mission = page.getByRole('region', { name: `Missione Registra per ${CLASS_NAME}` });
  await expect(mission).toBeVisible();
  await expect(mission.getByRole('button', { name: 'Copilota', exact: true })).toBeVisible();
  await expect(mission.getByRole('button', { name: 'Torna a Registra', exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="library-copilot-trigger"]')).toBeHidden();
  return mission;
}

async function saveEvaluation(page) {
  await page.getByPlaceholder('es. Verifica su Fonti Rinnovabili').fill(EVALUATION_TITLE);
  await page.getByRole('button', { name: 'Tutti 8', exact: true }).click();
  await page.getByRole('button', { name: 'Salva Valutazioni di Classe', exact: true }).click();

  const savedRecord = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
  await expect(savedRecord).toContainText('Registrazione completata');
  await expect(page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' })).toBeHidden();
  return savedRecord;
}

async function assertSavedStateRestoresAmbientUi(page) {
  const overview = page.locator('[data-testid="flow03b-class-overview"]');
  await expect(overview).toHaveJSProperty('open', true);
  await expect(page.locator('[data-testid="library-copilot-trigger"]')).toBeVisible();
}

async function assertContextualReview(page, savedRecord) {
  await savedRecord.getByRole('button', { name: 'Rivedi', exact: true }).click();
  const review = page.getByRole('region', { name: 'Continua: Rivedi' });
  await expect(review).toBeVisible();
  await expect(review).toContainText('Prima destinazione consigliata: Tabellone.');

  const labels = await review.locator('button').allTextContents();
  const orderedDestinations = labels
    .map(label => label.trim())
    .filter(label => ['Tabellone', 'Analisi', 'Storico', 'Scheda alunno'].includes(label));
  expect(orderedDestinations).toEqual(['Tabellone', 'Analisi', 'Storico', 'Scheda alunno']);
}

test.describe('FLOW-03B desktop qualification', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('focuses active Registra, keeps backup maintenance quiet and contextualizes Rivedi', async ({ page }) => {
    const pageErrors = installPageErrorCollector(page);
    await configureVault(page, 'flow-03b-desktop');
    await createSyntheticClassWithStudent(page);

    const record = await openRecordFromOggi(page);
    await assertActiveRecordFocus(page, record);
    await assertNoHorizontalOverflow(page);

    await openEvaluationAndAssertMission(page, record);
    const savedRecord = await saveEvaluation(page);
    await assertSavedStateRestoresAmbientUi(page);
    await assertContextualReview(page, savedRecord);

    await page.screenshot({ path: evidencePath('flow-03b-desktop-review.png'), fullPage: true });
    expect(pageErrors).toEqual([]);
  });
});

test.describe('FLOW-03B mobile qualification', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps primary recording controls unobscured at 390x844', async ({ page }) => {
    const pageErrors = installPageErrorCollector(page);
    await configureVault(page, 'flow-03b-mobile');
    await createSyntheticClassWithStudent(page);

    const record = await openRecordFromOggi(page);
    await assertActiveRecordFocus(page, record);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: evidencePath('flow-03b-mobile-active-record.png'), fullPage: true });

    const mission = await openEvaluationAndAssertMission(page, record);
    await assertNoHorizontalOverflow(page);
    for (const label of ['Copilota', 'Torna a Registra']) {
      const button = mission.getByRole('button', { name: label, exact: true });
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }

    const savedRecord = await saveEvaluation(page);
    await assertSavedStateRestoresAmbientUi(page);
    await assertContextualReview(page, savedRecord);
    await assertNoHorizontalOverflow(page);
    expect(pageErrors).toEqual([]);
  });
});
