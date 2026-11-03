const { test, expect } = require('@playwright/test');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const CLASS_NAME = '2Z';
const NEXT_CLASS_NAME = '3Z';
const UDA_TITLE = 'INT-01 Agricoltura sostenibile';
const OTHER_UDA_TITLE = 'INT-01 Energia e sostenibilità';

test.use({ trace: 'retain-on-failure' });

function evidencePath(name) {
  return path.resolve(process.env.EVIDENCE_DIR || '.', name);
}

async function configureVault(page, password) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
}

async function closeSaveConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await heading.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(heading).toBeHidden();
  }
}

async function fromDrawer(page, label) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const drawer = page.getByRole('complementary')
    .filter({ has: page.getByRole('button', { name: label, exact: true }) });
  await drawer.getByRole('button', { name: label, exact: true }).click();
}

async function createSyntheticClass(page, name) {
  page.once('dialog', dialog => dialog.accept(name));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: 'Gestione Elenco Alunni: ' + name })).toBeVisible();
  await closeSaveConfirmation(page);
  await fromDrawer(page, 'Oggi');
}

async function openPreparaForClass(page) {
  await page.getByRole('button', { name: 'Prepara', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Per continuare con Prepara, scegli una classe.');
  await page.getByRole('button', { name: 'Apri classe ' + CLASS_NAME, exact: true }).click();
  const router = page.getByRole('region', { name: 'Prepara per ' + CLASS_NAME });
  await expect(router).toBeVisible();
  return router;
}

function continuity(page) {
  return page.getByRole('region', { name: 'Continuità didattica' });
}

async function createPlanningProfile(page) {
  const profile = page.getByRole('region', { name: 'Profilo programmazione' });
  await expect(profile).toBeVisible();
  await expect(profile.getByRole('textbox', { name: 'Disciplina' })).toHaveValue('tecnologia');
  await expect(profile.getByText(/Denominazione nelle impostazioni: Tecnologia & Disegno Tecnico/)).toBeVisible();
  await profile.getByRole('spinbutton', { name: 'Classe/livello' }).fill('2');

  await page.getByRole('button', { name: 'Calendario e normativa' }).click();
  const calendar = page.getByRole('region', { name: 'Calendario e normativa' });
  await calendar.getByLabel('Inizio lezioni').fill('2026-09-14');
  await calendar.getByLabel('Fine lezioni').fill('2027-06-08');
  await expect(calendar.getByText('2 h/settimana · 66 h/anno')).toBeVisible();
  // National entitlement is already defined: local allocation is optional, not a hidden save prerequisite.
  await expect(calendar.getByRole('spinbutton', { name: /Monte ore locale annuale/ })).toHaveValue('');

  await page.getByRole('button', { name: 'Organizzazione' }).click();
  const organization = page.getByRole('region', { name: 'Organizzazione programmazione' });
  await organization.getByRole('button', { name: /Aggiungi periodo/ }).click();
  await organization.locator('input[type="date"]').nth(0).fill('2026-09-14');
  await organization.locator('input[type="date"]').nth(1).fill('2027-06-08');

  await page.getByRole('button', { name: 'Salva profilo', exact: true }).click();
  await closeSaveConfirmation(page);
  await expect(continuity(page)).toContainText('Cornice:');
  await expect(continuity(page)).toContainText('classe 2');
  await expect(continuity(page)).not.toContainText('Cornice: profilo non disponibile');
}

async function createUda(page) {
  await expect(page.getByRole('heading', { name: 'Unità didattiche', exact: true })).toBeVisible();
  await expect(continuity(page)).not.toContainText('UDA:');
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nuova Unità Didattica (UDA)' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Titolo', { exact: true }).fill(UDA_TITLE);
  const selects = dialog.locator('select');
  await selects.nth(0).selectOption({ label: CLASS_NAME });
  await selects.nth(2).selectOption('2');
  await dialog.getByRole('spinbutton', { name: 'Durata Mesi', exact: true }).fill('2');
  await dialog.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await closeSaveConfirmation(page);
  await expect(page.getByRole('status')).toContainText('creata con successo');
  await expect(continuity(page)).not.toContainText('UDA:');

  // UdaWorkspaceView is the authoritative first-level UDA surface.
  // Explicitly select the card before entering the legacy planning dossier.
  await page.getByRole('button', { name: 'Gestisci in Pianificazione', exact: true }).click();
  await expect(page.getByRole('heading', { name: UDA_TITLE })).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi Fascicolo' }).click();
  await expect(continuity(page)).toContainText('UDA: ' + UDA_TITLE);
}

async function assertSafeMobile(page, button) {
  await expect(button).toBeVisible();
  const rect = await button.boundingBox();
  expect(rect).not.toBeNull();
  expect(rect.height).toBeGreaterThanOrEqual(44);
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth
  }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.viewport + 1);
}

async function runJourney(page, { mobile }) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await configureVault(page, mobile ? 'int-01-mobile' : 'int-01-desktop');
  await createSyntheticClass(page, CLASS_NAME);
  if (!mobile) await createSyntheticClass(page, NEXT_CLASS_NAME);

  const router = await openPreparaForClass(page);
  await router.getByRole('button', { name: /^Definisci la cornice/ }).click();
  await expect(continuity(page)).toContainText('Classe ' + CLASS_NAME);
  await expect(continuity(page)).toContainText('Cornice: profilo non disponibile');

  await createPlanningProfile(page);
  await page.screenshot({
    path: evidencePath(mobile ? 'int-01-mobile-planning.png' : 'int-01-desktop-planning.png'),
    fullPage: true
  });

  const openUda = continuity(page).getByRole('button', { name: 'Apri UDA', exact: true });
  if (mobile) await assertSafeMobile(page, openUda);
  await openUda.click();
  await createUda(page);

  if (!mobile) {
    // The legacy specialist must create an UDA for the active (not first)
    // class, despite its locked class dropdown.
    const planning = page.getByRole('region', { name: 'Pianificazione UDA' });
    await planning.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
    const legacyModal = planning.locator('div.fixed.inset-0.z-50').filter({
      hasText: 'Nuova Unità Didattica (UDA)'
    });
    await expect(legacyModal).toBeVisible();
    await expect(legacyModal.locator('select').first()).toBeDisabled();
    await expect(legacyModal.locator('select').first()).toHaveValue(CLASS_NAME);
    await legacyModal.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità')
      .fill('INT-01 Creazione UDA per classe attiva');
    await legacyModal.getByRole('button', { name: 'Crea UDA', exact: true }).click();
    await closeSaveConfirmation(page);
    await expect(legacyModal).toHaveCount(0);
    await expect(planning.getByRole('row').filter({
      hasText: 'INT-01 Creazione UDA per classe attiva'
    })).toBeVisible();
  }

  const openPlanning = continuity(page).getByRole('button', { name: 'Apri Programmazione' });
  if (mobile) await assertSafeMobile(page, openPlanning);
  await page.screenshot({
    path: evidencePath(mobile ? 'int-01-mobile-uda.png' : 'int-01-desktop-uda.png'),
    fullPage: true
  });
  await openPlanning.click();
  await expect(continuity(page)).toContainText('UDA: ' + UDA_TITLE);
  await expect(continuity(page)).toContainText('Classe ' + CLASS_NAME);
  await page.screenshot({
    path: evidencePath(mobile ? 'int-01-mobile-return.png' : 'int-01-desktop-return.png'),
    fullPage: true
  });

  await continuity(page).getByRole('button', { name: 'Apri UDA' }).click();
  await expect(page.getByRole('heading', { name: UDA_TITLE })).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi Fascicolo' }).click();
  await expect(continuity(page)).toContainText('UDA: ' + UDA_TITLE);

  // Independent-review regression: an explicit selection from Analysis must
  // replace the shared UDA focus and open exactly one Gantt sheet.
  await page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'UDA', exact: true }).click();
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  const otherDialog = page.getByRole('dialog', { name: 'Nuova Unità Didattica (UDA)' });
  await otherDialog.getByLabel('Titolo', { exact: true }).fill(OTHER_UDA_TITLE);
  const otherSelects = otherDialog.locator('select');
  await otherSelects.nth(0).selectOption({ label: CLASS_NAME });
  await otherSelects.nth(2).selectOption('2');
  await otherDialog.getByRole('spinbutton', { name: 'Durata Mesi', exact: true }).fill('2');
  await otherDialog.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await closeSaveConfirmation(page);
  await page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'Analisi', exact: true }).click();

  const analysis = page.getByRole('region', { name: 'Analisi UDA' });
  await expect(analysis).toBeVisible();
  const secondaryClassFilter = analysis.getByRole('combobox', { name: 'Filtra classe UDA' });
  await expect(secondaryClassFilter).toBeDisabled();
  await expect(secondaryClassFilter).toHaveValue(CLASS_NAME);
  const otherRow = analysis.getByRole('row').filter({ hasText: OTHER_UDA_TITLE });
  await otherRow.getByText(OTHER_UDA_TITLE).click();
  await expect(analysis.getByRole('dialog', { name: 'Scheda UDA nel cronoprogramma' })).toBeVisible();
  await expect(analysis.getByRole('dialog')).toHaveCount(1);
  await analysis.getByRole('dialog', { name: 'Scheda UDA nel cronoprogramma' })
    .getByRole('button', { name: 'Chiudi', exact: true }).click();
  await expect(analysis.getByRole('dialog')).toHaveCount(0);
  await expect(continuity(page)).toContainText('UDA: ' + OTHER_UDA_TITLE);
  await continuity(page).getByRole('button', { name: 'Apri Programmazione' }).click();
  await expect(continuity(page)).toContainText('UDA: ' + OTHER_UDA_TITLE);

  if (!mobile) {
    const quickSwitch = page.locator('select[title="Cambia rapidamente classe attiva"]');
    await expect(quickSwitch).toBeVisible();
    await quickSwitch.selectOption({ label: NEXT_CLASS_NAME });
    // Selecting a different class intentionally closes the specialist mission
    // and lands on its Dashboard. The old UDA focus must not be restored.
    await expect(continuity(page)).toHaveCount(0);
    await expect.poll(() => quickSwitch.evaluate(select =>
      select.selectedOptions[0]?.textContent?.trim() ?? ''
    )).toBe(NEXT_CLASS_NAME);
    await fromDrawer(page, 'Programmazione didattica');
    await expect(continuity(page)).toContainText('Classe ' + NEXT_CLASS_NAME);
    await expect(continuity(page)).not.toContainText('UDA: ' + UDA_TITLE);
  }
  expect(errors).toEqual([]);
}

test.describe('INT-01 desktop: Programmazione ↔ UDA ↔ lezione', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  test('preserves an explicit teaching target but never chooses one automatically', async ({ page }) => {
    await runJourney(page, { mobile: false });
  });
});

test.describe('INT-01 mobile: Programmazione ↔ UDA', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('keeps one scoped class and accessible handoff controls', async ({ page }) => {
    await runJourney(page, { mobile: true });
  });
});
