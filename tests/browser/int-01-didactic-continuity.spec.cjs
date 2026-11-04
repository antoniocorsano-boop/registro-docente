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
  return page.getByRole('region', { name: /^(Continuità didattica|Programmazione corrente)$/ });
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
  const isMobile = (page.viewportSize()?.width ?? 1280) < 640;
  if (!isMobile) {
    await expect(continuity(page)).toContainText('Cornice:');
    await expect(continuity(page)).toContainText('classe 2');
    await expect(continuity(page)).not.toContainText('Cornice: profilo non disponibile');
  }
  const planningStatus = page.getByRole('status', { name: 'Stato della programmazione' });
  await expect(planningStatus).toContainText('Programmazione disponibile');
  if (isMobile) {
    const details = page.getByRole('button', { name: 'Dettagli e modifica' });
    await expect(details).toHaveAttribute('aria-expanded', 'false');
    await expect(continuity(page)).toContainText('Apri UDA');
    const arena = page.getByRole('button', { name: 'Apri strumenti Arena' });
    await expect(arena).toContainText('Da collegare');
    await expect(arena).toHaveAttribute('aria-expanded', 'false');
    await arena.click();
    await expect(arena).toHaveAttribute('aria-expanded', 'true');
    await arena.click();
    await details.click();
    await expect(details).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('group', { name: 'Sezioni programmazione' })).toBeVisible();
    await details.click();
  } else {
    await expect(planningStatus).toContainText('Curricolo Arena da collegare');
  }
  await expect(page.getByText('Configura il profilo reale prima di collegare il curricolo Arena.')).toHaveCount(0);
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
  const planning = page.getByRole('region', { name: 'Pianificazione UDA' });
  await expect(planning.getByRole('button', { name: 'Tutte le Classi', exact: true })).toHaveCount(0);
  await expect(planning.getByLabel('Classe corrente UDA')).toContainText(CLASS_NAME);
  await expect(planning.getByLabel('Classe corrente nel cronoprogramma')).toContainText(CLASS_NAME);
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
  if (!mobile) await expect(continuity(page)).toContainText('Cornice: profilo non disponibile');
  await expect(page.getByRole('status', { name: 'Stato della programmazione' }))
    .toContainText('Programmazione da configurare');
  if (mobile) await expect(page.getByRole('group', { name: 'Sezioni programmazione' })).toBeVisible();

  await createPlanningProfile(page);
  await page.screenshot({
    path: evidencePath(mobile ? 'int-01-mobile-planning.png' : 'int-01-desktop-planning.png'),
    fullPage: true
  });

  const openUda = continuity(page).getByRole('button', { name: 'Apri UDA', exact: true });
  if (mobile) await assertSafeMobile(page, openUda);
  await openUda.click();
  await expect(page).toHaveURL(/tab=uda-gantt/);
  await page.goBack();
  await expect(continuity(page)).toContainText('Apri UDA');
  await page.goForward();
  await expect(page).toHaveURL(/tab=uda-gantt/);
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
  await expect(analysis.getByRole('combobox', { name: 'Filtra classe UDA' })).toHaveCount(0);
  await expect(analysis.getByLabel('Classe corrente nel cronoprogramma')).toContainText(CLASS_NAME);
  await expect(analysis.getByRole('button', { name: NEXT_CLASS_NAME, exact: true })).toHaveCount(0);
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

test.describe('INT-01: non-saved Programmazione draft on mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('offers stay/save/discard and keeps the active class', async ({ page }) => {
    await configureVault(page, 'int-01-mobile-guard');
    await createSyntheticClass(page, CLASS_NAME);
    const router = await openPreparaForClass(page);
    await router.getByRole('button', { name: /^Definisci la cornice/ }).click();
    await createPlanningProfile(page);
    const details = page.getByRole('button', { name: 'Dettagli e modifica' });
    await details.click();
    await page.getByRole('button', { name: 'Profilo', exact: true }).click();
    const profile = page.getByRole('region', { name: 'Profilo programmazione' });
    await profile.getByRole('button', { name: 'Modifica', exact: true }).click();
    await profile.getByRole('textbox', { name: 'Coorte' }).fill('2026-grade-2-saved-via-guard');
    await details.click();
    await continuity(page).getByRole('button', { name: 'Apri UDA', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Modifiche non salvate' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Rimani nella Programmazione' }).focus();
    await page.keyboard.press('Tab');
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
    await dialog.getByRole('button', { name: 'Rimani nella Programmazione' }).click();
    await details.click();
    await expect(profile.getByRole('textbox', { name: 'Coorte' })).toHaveValue('2026-grade-2-saved-via-guard');
    await details.click();
    await continuity(page).getByRole('button', { name: 'Apri UDA', exact: true }).click();
    await dialog.getByRole('button', { name: 'Salva e continua' }).click();
    await closeSaveConfirmation(page);
    await expect(page.getByRole('heading', { name: 'Unità didattiche', exact: true })).toBeVisible();
    await continuity(page).getByRole('button', { name: 'Apri Programmazione' }).click();
    await details.click();
    await page.getByRole('button', { name: 'Profilo', exact: true }).click();
    await profile.getByRole('button', { name: 'Modifica', exact: true }).click();
    await expect(profile.getByRole('textbox', { name: 'Coorte' })).toHaveValue('2026-grade-2-saved-via-guard');
    await profile.getByRole('textbox', { name: 'Coorte' }).fill('2026-grade-2-discarded');
    await details.click();
    await fromDrawer(page, 'Oggi');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Continua senza salvare' }).click();
    await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
    // Oggi intentionally clears class authority: reselect it through Prepara before verifying
    // that a discarded draft never overwrote the committed profile.
    const returnRouter = await openPreparaForClass(page);
    await returnRouter.getByRole('button', { name: /^Definisci la cornice/ }).click();
    await details.click();
    await page.getByRole('button', { name: 'Profilo', exact: true }).click();
    await profile.getByRole('button', { name: 'Modifica', exact: true }).click();
    await expect(profile.getByRole('textbox', { name: 'Coorte' })).toHaveValue('2026-grade-2-saved-via-guard');
  });
});

test.describe('INT-01 mobile: guarded history Back', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('cancel preserves the original history stack, and confirmation performs one Back', async ({ page }) => {
    await configureVault(page, 'int-01-browser-back-draft');
    await createSyntheticClass(page, CLASS_NAME);
    const router = await openPreparaForClass(page);
    await router.getByRole('button', { name: /^Definisci la cornice/ }).click();
    await createPlanningProfile(page);
    const details = page.getByRole('button', { name: 'Dettagli e modifica' });
    await details.click();
    const profile = page.getByRole('region', { name: 'Profilo programmazione' });
    await profile.getByRole('button', { name: 'Modifica', exact: true }).click();
    await profile.getByRole('textbox', { name: 'Coorte' }).fill('2026-draft-history');
    await details.click();
    const planningUrl = page.url();
    await page.goBack();
    const prompt = page.getByRole('dialog', { name: 'Modifiche non salvate' });
    await expect(prompt).toBeVisible();
    await expect(page).toHaveURL(planningUrl);
    await prompt.getByRole('button', { name: 'Rimani nella Programmazione' }).click();
    await expect(page).toHaveURL(planningUrl);
    await page.goBack();
    await expect(prompt).toBeVisible();
    await prompt.getByRole('button', { name: 'Continua senza salvare' }).click();
    await expect(page).not.toHaveURL(planningUrl);
  });
});

test.describe('INT-01 mobile: guarded Forward traversal', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('restores the origin when dirty and replays exactly one Forward after confirmation', async ({ page }) => {
    await configureVault(page, 'int-01-forward-guard');
    await createSyntheticClass(page, CLASS_NAME);
    const router = await openPreparaForClass(page);
    await router.getByRole('button', { name: /^Definisci la cornice/ }).click();
    await createPlanningProfile(page);
    const planningUrl = page.url();
    await continuity(page).getByRole('button', { name: 'Apri UDA', exact: true }).click();
    const udaUrl = page.url();
    await page.goBack();
    await expect(page).toHaveURL(planningUrl);
    const details = page.getByRole('button', { name: 'Dettagli e modifica' });
    await details.click();
    const profile = page.getByRole('region', { name: 'Profilo programmazione' });
    await profile.getByRole('button', { name: 'Modifica', exact: true }).click();
    await profile.getByRole('textbox', { name: 'Coorte' }).fill('2026-unsaved-forward');
    await details.click();
    await page.goForward();
    const confirmExit = page.getByRole('dialog', { name: 'Modifiche non salvate' });
    await expect(confirmExit).toBeVisible();
    await expect(page).toHaveURL(planningUrl);
    await confirmExit.getByRole('button', { name: 'Rimani nella Programmazione' }).click();
    await expect(page).toHaveURL(planningUrl);
    await page.goForward();
    await expect(confirmExit).toBeVisible();
    await confirmExit.getByRole('button', { name: 'Continua senza salvare' }).click();
    await expect(page).toHaveURL(udaUrl);
    await expect(page.getByRole('heading', { name: 'Unità didattiche', exact: true })).toBeVisible();
  });
});

test.describe('INT-01 mobile: pending decision during verified browser Back', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  for (const withoutNavigationIndex of [false, true]) {
    test(`supersedes a pending UDA push with verified Back ${withoutNavigationIndex ? 'without' : 'with'} Navigation API`, async ({ page }) => {
      if (withoutNavigationIndex) {
        await page.addInitScript(() => {
          Object.defineProperty(window, 'navigation', { configurable: true, value: undefined });
        });
      }
      await configureVault(page, `int-01-verified-pending-back-${withoutNavigationIndex ? 'marked' : 'native'}`);
      await createSyntheticClass(page, CLASS_NAME);
      const router = await openPreparaForClass(page);
      await router.getByRole('button', { name: /^Definisci la cornice/ }).click();
      await createPlanningProfile(page);

      // Record the actual previous entry and preserve the forward branch.
      const planningUrl = page.url();
      await page.goBack();
      const previousUrl = page.url();
      expect(previousUrl).not.toBe(planningUrl);
      await page.goForward();
      await expect(page).toHaveURL(planningUrl);

      const details = page.getByRole('button', { name: 'Dettagli e modifica' });
      await details.click();
      const profile = page.getByRole('region', { name: 'Profilo programmazione' });
      await profile.getByRole('button', { name: 'Modifica', exact: true }).click();
      await profile.getByRole('textbox', { name: 'Coorte' }).fill('2026-unsaved-pending-verified');
      await details.click();

      await continuity(page).getByRole('button', { name: 'Apri UDA', exact: true }).click();
      const confirmation = page.getByRole('dialog', { name: 'Modifiche non salvate' });
      await expect(confirmation).toBeVisible();
      await expect(page).toHaveURL(planningUrl);

      // Hold only the app's asynchronous return to the verified origin.
      // This exposes the race between the browser Back and its restore popstate.
      await page.evaluate(() => {
        const nativeGo = window.history.go.bind(window.history);
        window.__int01ReleaseRestore = null;
        window.history.go = delta => {
          if (delta > 0 && window.__int01ReleaseRestore === null) {
            window.__int01ReleaseRestore = () => nativeGo(delta);
            return;
          }
          nativeGo(delta);
        };
        window.__int01RestoreNativeGo = () => { window.history.go = nativeGo; };
      });
      await page.goBack();
      await expect(page).toHaveURL(previousUrl);
      await expect.poll(() => page.evaluate(() => typeof window.__int01ReleaseRestore)).toBe('function');
      await expect(confirmation).toBeVisible();
      await expect(confirmation.getByRole('status')).toContainText('Ripristino della Programmazione');
      for (const label of ['Salva e continua', 'Continua senza salvare', 'Rimani nella Programmazione']) {
        await expect(confirmation.getByRole('button', { name: label })).toBeDisabled();
      }
      const lengthWhileRestoring = await page.evaluate(() => history.length);
      // Even a scripted click must not execute the obsolete UDA action.
      await confirmation.getByRole('button', { name: 'Continua senza salvare' }).evaluate(button => button.click());
      await expect(page).toHaveURL(previousUrl);
      expect(await page.evaluate(() => history.length)).toBe(lengthWhileRestoring);
      await page.evaluate(() => {
        const release = window.__int01ReleaseRestore;
        window.__int01RestoreNativeGo?.();
        window.__int01ReleaseRestore = null;
        release?.();
      });
      await expect(page).toHaveURL(planningUrl);
      await expect(confirmation.getByRole('status')).toHaveCount(0);
      for (const label of ['Salva e continua', 'Continua senza salvare', 'Rimani nella Programmazione']) {
        await expect(confirmation.getByRole('button', { name: label })).toBeEnabled();
      }
      const lengthBeforeConfirmation = await page.evaluate(() => history.length);

      await confirmation.getByRole('button', { name: 'Continua senza salvare' }).click();
      await expect(confirmation).toBeHidden();
      await expect(page).toHaveURL(previousUrl);
      await expect(continuity(page)).toHaveCount(0);
      expect(await page.evaluate(() => history.length)).toBe(lengthBeforeConfirmation);

      // A real Back preserves the Programmazione forward entry; a stale UDA
      // push would truncate it and change the confirmed destination.
      await page.goForward();
      await expect(page).toHaveURL(planningUrl);
      await expect(continuity(page)).toContainText('Apri UDA');
    });
  }
});

test.describe('INT-01 mobile: explicit discard on same-class Programmazione history', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  for (const withoutNavigationIndex of [false, true]) {
    test(`discards the dirty editor across same-profile history ${withoutNavigationIndex ? 'without' : 'with'} Navigation API`, async ({ page }) => {
      if (withoutNavigationIndex) {
        await page.addInitScript(() => {
          Object.defineProperty(window, 'navigation', { configurable: true, value: undefined });
        });
      }
      await configureVault(page, `int-01-same-profile-discard-${withoutNavigationIndex ? 'marked' : 'native'}`);
      await createSyntheticClass(page, CLASS_NAME);
      const router = await openPreparaForClass(page);
      await router.getByRole('button', { name: /^Definisci la cornice/ }).click();
      await createPlanningProfile(page);

      const originalPlanningEntryId = await page.evaluate(() => history.state?.__tramaHistoryEntryId);
      const originalUrl = page.url();
      await continuity(page).getByRole('button', { name: 'Apri UDA', exact: true }).click();
      await continuity(page).getByRole('button', { name: 'Apri Programmazione' }).click();
      await expect(page).toHaveURL(originalUrl);
      expect(await page.evaluate(() => history.state?.__tramaHistoryEntryId)).not.toBe(originalPlanningEntryId);

      const details = page.getByRole('button', { name: 'Dettagli e modifica' });
      await details.click();
      await page.getByRole('button', { name: 'Profilo', exact: true }).click();
      const profile = page.getByRole('region', { name: 'Profilo programmazione' });
      await profile.getByRole('button', { name: 'Modifica', exact: true }).click();
      const cohort = profile.getByRole('textbox', { name: 'Coorte' });
      const persistedCohort = await cohort.inputValue();
      await cohort.fill('2026-unsaved-must-discard');
      await details.click();

      const lengthBefore = await page.evaluate(() => history.length);
      await page.evaluate(() => history.go(-2));
      const confirmation = page.getByRole('dialog', { name: 'Modifiche non salvate' });
      await expect(confirmation).toBeVisible();
      await expect(page).toHaveURL(originalUrl);
      await confirmation.getByRole('button', { name: 'Continua senza salvare' }).click();
      await expect(confirmation).toBeHidden();
      await expect(page).toHaveURL(originalUrl);
      expect(await page.evaluate(() => history.state?.__tramaHistoryEntryId)).toBe(originalPlanningEntryId);
      expect(await page.evaluate(() => history.length)).toBe(lengthBefore);
      await details.click();
      // Discard returns the editor to read mode; re-open its controls before
      // comparing the exact persisted value rather than a stale DOM input.
      await profile.getByRole('button', { name: 'Modifica', exact: true }).click();
      await expect(profile.getByRole('textbox', { name: 'Coorte' })).toHaveValue(persistedCohort);
      await details.click();

      // The discarded editor must not prompt again on the next legitimate exit.
      await continuity(page).getByRole('button', { name: 'Apri UDA', exact: true }).click();
      await expect(confirmation).toHaveCount(0);
      await expect(page).toHaveURL(/tab=uda-gantt/);
    });
  }
});

test.describe('INT-01: multi-entry unmarked history', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('checks the exact origin before permitting a dirty draft to be discarded', async ({ page }) => {
    await configureVault(page, 'int-01-legacy-multi-step');
    await createSyntheticClass(page, CLASS_NAME);
    const router = await openPreparaForClass(page);
    // Model two old unmarked history entries before the new Programmazione entry.
    await page.evaluate(() => {
      history.pushState({ legacy: 'first' }, '', '?legacy=first');
      history.pushState({ legacy: 'second' }, '', '?legacy=second');
    });
    await router.getByRole('button', { name: /^Definisci la cornice/ }).click();
    await createPlanningProfile(page);
    const originalUrl = page.url();
    const details = page.getByRole('button', { name: 'Dettagli e modifica' });
    await details.click();
    const profile = page.getByRole('region', { name: 'Profilo programmazione' });
    await profile.getByRole('button', { name: 'Modifica', exact: true }).click();
    await profile.getByRole('textbox', { name: 'Coorte' }).fill('2026-draft-legacy');
    await details.click();
    await page.evaluate(() => history.go(-2));
    const dialog = page.getByRole('dialog', { name: 'Modifiche non salvate' });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(originalUrl);
    await dialog.getByRole('button', { name: 'Rimani nella Programmazione' }).click();
    await details.click();
    await expect(profile.getByRole('textbox', { name: 'Coorte' })).toHaveValue('2026-draft-legacy');
  });
});

test.describe('INT-01 mobile: dirty draft starting from a legacy unmarked history entry', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('stamps the clean legacy origin and restores it before asking to leave', async ({ page }) => {
    await configureVault(page, 'int-01-legacy-unmarked-origin');
    await createSyntheticClass(page, CLASS_NAME);
    const router = await openPreparaForClass(page);
    await router.getByRole('button', { name: /^Definisci la cornice/ }).click();
    await createPlanningProfile(page);
    const classId = await page.evaluate(() => history.state?.classId);
    const planningUrl = page.url();
    await page.evaluate(({ classId, planningUrl }) => {
      history.pushState({ classId, tab: 'programmazione', legacy: 'unmarked-origin' },
        '', planningUrl + (planningUrl.includes('?') ? '&' : '?') + 'legacy=origin');
      history.pushState({ classId, tab: 'uda-gantt', legacy: 'later-entry' },
        '', planningUrl + (planningUrl.includes('?') ? '&' : '?') + 'legacy=later');
    }, { classId, planningUrl });
    await page.goBack();
    const unmarkedOriginUrl = page.url();
    await expect(page.getByRole('status', { name: 'Stato della programmazione' })).toContainText('Programmazione disponibile');
    await expect.poll(() => page.evaluate(() => history.state?.__tramaHistoryEntryId?.length > 0)).toBe(true);
    await expect.poll(() => page.evaluate(() => history.state?.__tramaHistoryPosition ?? null)).toBeNull();

    const details = page.getByRole('button', { name: 'Dettagli e modifica' });
    await details.click();
    const profile = page.getByRole('region', { name: 'Profilo programmazione' });
    await profile.getByRole('button', { name: 'Modifica', exact: true }).click();
    await profile.getByRole('textbox', { name: 'Coorte' }).fill('2026-unmarked-origin-draft');
    await details.click();

    await page.goBack();
    const dialog = page.getByRole('dialog', { name: 'Modifiche non salvate' });
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(unmarkedOriginUrl);
    await dialog.getByRole('button', { name: 'Rimani nella Programmazione' }).click();
    await expect(page).toHaveURL(unmarkedOriginUrl);
    await details.click();
    await expect(profile.getByRole('textbox', { name: 'Coorte' })).toHaveValue('2026-unmarked-origin-draft');
  });
});

test.describe('INT-01 mobile: legacy browser without Navigation API index', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('browser Back replaces a pending UDA action with the actual legacy destination', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'navigation', { configurable: true, value: undefined });
    });
    await configureVault(page, 'int-01-no-index-pending-action');
    await createSyntheticClass(page, CLASS_NAME);
    const router = await openPreparaForClass(page);
    await router.getByRole('button', { name: /^Definisci la cornice/ }).click();
    await createPlanningProfile(page);
    const classId = await page.evaluate(() => history.state?.classId);
    const planningUrl = page.url();
    await page.evaluate(({ classId, planningUrl }) => {
      history.pushState({ classId, tab: 'uda-gantt', legacy: 'actual-destination' },
        '', planningUrl + '&legacy=recovery-destination');
      history.pushState({ classId, tab: 'programmazione', legacy: 'dirty-origin' },
        '', planningUrl + '&legacy=recovery-origin');
    }, { classId, planningUrl });
    await page.goBack();
    const destinationUrl = page.url();
    await page.goForward();
    const originUrl = page.url();
    await expect(page.getByRole('status', { name: 'Stato della programmazione' })).toContainText('Programmazione disponibile');
    await expect.poll(() => page.evaluate(() => history.state?.__tramaHistoryPosition ?? null)).toBeNull();

    const details = page.getByRole('button', { name: 'Dettagli e modifica' });
    await details.click();
    const profile = page.getByRole('region', { name: 'Profilo programmazione' });
    await profile.getByRole('button', { name: 'Modifica', exact: true }).click();
    await profile.getByRole('textbox', { name: 'Coorte' }).fill('2026-dirty-pending-recovery');
    await details.click();

    // A normal app click opens the first decision, but must not navigate yet.
    await continuity(page).getByRole('button', { name: 'Apri UDA', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Modifiche non salvate' });
    await expect(confirmation).toBeVisible();
    await expect(page).toHaveURL(originUrl);

    // The browser now moves to a different entry while that decision is open.
    // Old code kept the original UDA push callback instead of the real target.
    await page.goBack();
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByText(/cronologia in avanti potrebbe essere sostituita/)).toBeVisible();
    await expect(page).toHaveURL(destinationUrl);
    const lengthAtDestination = await page.evaluate(() => history.length);

    await confirmation.getByRole('button', { name: 'Continua senza salvare' }).click();
    await expect(confirmation).toBeHidden();
    await expect(page).toHaveURL(destinationUrl);
    await expect(page.getByRole('heading', { name: 'Unità didattiche', exact: true })).toBeVisible();
    expect(await page.evaluate(() => history.length)).toBe(lengthAtDestination);
  });

  test('Forward from unmarked dirty origin offers an explicit decision instead of hanging', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'navigation', { configurable: true, value: undefined });
    });
    await configureVault(page, 'int-01-no-native-forward');
    await createSyntheticClass(page, CLASS_NAME);
    const router = await openPreparaForClass(page);
    await router.getByRole('button', { name: /^Definisci la cornice/ }).click();
    await createPlanningProfile(page);
    expect(await page.evaluate(() => window.navigation?.currentEntry?.index ?? null)).toBeNull();
    const classId = await page.evaluate(() => history.state?.classId);
    const planningUrl = page.url();
    await page.evaluate(({ classId, planningUrl }) => {
      history.pushState({ classId, tab: 'programmazione', legacy: 'origin' },
        '', planningUrl + '&legacy=no-index-origin');
      history.pushState({ classId, tab: 'uda-gantt', legacy: 'later' },
        '', planningUrl + '&legacy=no-index-later');
    }, { classId, planningUrl });
    await page.goBack();
    const originUrl = page.url();
    await expect.poll(() => page.evaluate(() => history.state?.__tramaHistoryEntryId?.length > 0)).toBe(true);

    const details = page.getByRole('button', { name: 'Dettagli e modifica' });
    await details.click();
    const profile = page.getByRole('region', { name: 'Profilo programmazione' });
    await profile.getByRole('button', { name: 'Modifica', exact: true }).click();
    await profile.getByRole('textbox', { name: 'Coorte' }).fill('2026-no-index-forward');
    await details.click();

    await page.goForward();
    const prompt = page.getByRole('dialog', { name: 'Modifiche non salvate' });
    await expect(prompt).toBeVisible();
    await expect(prompt.getByText(/cronologia in avanti potrebbe essere sostituita/)).toBeVisible();
    await prompt.getByRole('button', { name: 'Rimani nella Programmazione' }).click();
    await expect(page).toHaveURL(originUrl);
    await details.click();
    await expect(profile.getByRole('textbox', { name: 'Coorte' })).toHaveValue('2026-no-index-forward');
  });

  test('unknown coordinates survive app pushes; a mixed multi-entry Back never guesses delta', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'navigation', { configurable: true, value: undefined });
    });
    await configureVault(page, 'int-01-no-index-epochs');
    await createSyntheticClass(page, CLASS_NAME);
    const router = await openPreparaForClass(page);
    await router.getByRole('button', { name: /^Definisci la cornice/ }).click();
    await createPlanningProfile(page);
    const classId = await page.evaluate(() => history.state?.classId);
    const planningUrl = page.url();
    await page.evaluate(({ classId, planningUrl }) => {
      history.pushState({ classId, tab: 'dashboard', __tramaHistoryPosition: 4, legacy: 'old-epoch' },
        '', planningUrl + '&legacy=old-marked');
      history.pushState({ classId, tab: 'programmazione', legacy: 'unknown' },
        '', planningUrl + '&legacy=unknown');
    }, { classId, planningUrl });
    await page.goBack(); // Clean arrival at older marked entry.
    await page.goForward(); // Clean arrival at unmarked Programmazione.
    const unmarkedUrl = page.url();
    await expect.poll(() => page.evaluate(() => history.state?.__tramaHistoryPosition ?? null)).toBeNull();
    await continuity(page).getByRole('button', { name: 'Apri UDA', exact: true }).click();
    await expect.poll(() => page.evaluate(() => history.state?.__tramaHistoryPosition ?? null)).toBeNull();
    await page.goBack();
    await expect(page).toHaveURL(unmarkedUrl);

    const details = page.getByRole('button', { name: 'Dettagli e modifica' });
    await details.click();
    const profile = page.getByRole('region', { name: 'Profilo programmazione' });
    await profile.getByRole('button', { name: 'Modifica', exact: true }).click();
    await profile.getByRole('textbox', { name: 'Coorte' }).fill('2026-unknown-coordinate');
    await details.click();
    await page.evaluate(() => history.go(-1)); // Marked entry from a different coordinate epoch.
    const prompt = page.getByRole('dialog', { name: 'Modifiche non salvate' });
    await expect(prompt).toBeVisible();
    await expect(prompt.getByText(/cronologia in avanti potrebbe essere sostituita/)).toBeVisible();
    await prompt.getByRole('button', { name: 'Rimani nella Programmazione' }).click();
    await expect(page).toHaveURL(unmarkedUrl);
    await details.click();
    await expect(profile.getByRole('textbox', { name: 'Coorte' })).toHaveValue('2026-unknown-coordinate');
  });
});
