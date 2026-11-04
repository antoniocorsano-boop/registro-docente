const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const CLASS_NAME = 'Classe Sintetica REG-NAV-01';
const STUDENT_NAME = 'Rossi Mario';
const OTHER_STUDENT_NAME = 'Bianchi Anna';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, trace: 'retain-on-failure' });
test.setTimeout(120000);

async function closeSaveNotice(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await heading.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  }
}

async function fromDrawer(page, label) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const menu = page.getByRole('complementary');
  await menu.getByRole('button', { name: label, exact: true }).click();
}

async function prepareSyntheticClass(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill('reg-nav-01-test-only');
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();

  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: 'Gestione Elenco Alunni: ' + CLASS_NAME })).toBeVisible();
  await closeSaveNotice(page);

  const shield = page.locator('button[title^="Privacy Shield"]');
  await expect(shield).toBeVisible();
  await shield.click();

  await page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)').fill(STUDENT_NAME);
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(page.getByText(STUDENT_NAME, { exact: true })).toBeVisible();
  await closeSaveNotice(page);
  await page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)').fill(OTHER_STUDENT_NAME);
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await expect(page.getByText(OTHER_STUDENT_NAME, { exact: true })).toBeVisible();
  await closeSaveNotice(page);

  await fromDrawer(page, 'Oggi');
  await page.getByRole('button', { name: 'Apri classe ' + CLASS_NAME, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Panoramica Sezione: ' + CLASS_NAME })).toBeVisible();
}

async function expectNavigation(page, tab) {
  await expect(page).toHaveURL(new RegExp('[?&]tab=' + tab + '(&|$)'));
  await expect.poll(() => page.evaluate(() => history.state?.tab)).toBe(tab);
  const activeClass = await page.evaluate(() => history.state?.classId);
  expect(activeClass).toBeTruthy();
}

test.describe('REG-NAV-01 / NAV-S1 — ritorno da superfici specialistiche', () => {
  test('Storico → Nuova valutazione → Indietro ripristina Storico', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await prepareSyntheticClass(page);
    await fromDrawer(page, 'Storico prove');
    await expect(page.getByRole('heading', { name: 'Storico Prove Registrate: ' + CLASS_NAME })).toBeVisible();
    await expectNavigation(page, 'storico');

    await page.getByRole('button', { name: /Nuova Valutazione/ }).first().click();
    await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();
    await expectNavigation(page, 'voti'); // RED: cambia solo lo stato React

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Storico Prove Registrate: ' + CLASS_NAME })).toBeVisible();
    await expectNavigation(page, 'storico');
    expect(errors).toEqual([]);
  });

  for (const source of ['Analisi', 'Tabellone']) {
    test(source + ' → Scheda alunno → Indietro preserva la classe e la superficie originale', async ({ page }) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await prepareSyntheticClass(page);
      await page.locator('main').getByRole('button', { name: source, exact: true }).click();
      const sourceTab = source === 'Analisi' ? 'analytics' : 'tabellone';
      await expectNavigation(page, sourceTab);

      if (source === 'Analisi') {
        await page.getByTestId('mobile-analytics-student-detail').locator('summary').click();
        await page.getByTestId('mobile-analytics-student-detail')
          .getByRole('button', { name: /Rossi Mario/ }).click();
      } else {
        await page.locator('main').getByRole('button', { name: /Rossi Mario/ }).first().click();
      }
      await expect(page.getByRole('heading', { name: /Scheda Alunno & Profilo delle Competenze/ })).toBeVisible();
      await expectNavigation(page, 'report'); // RED: URL/history restano sulla superficie di origine

      await page.goBack({ waitUntil: 'domcontentloaded' });
      if (source === 'Analisi') {
        await expect(page.getByRole('heading', { name: /Analisi medie/ })).toBeVisible();
      } else {
        await expect(page.getByRole('heading', { name: 'Tabellone Classe: ' + CLASS_NAME })).toBeVisible();
      }
      await expectNavigation(page, sourceTab);
      expect(errors).toEqual([]);
    });
  }

  test('Scheda alunno dal menu → seconda selezione → Analisi → Indietro conserva lo studente', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await prepareSyntheticClass(page);
    await fromDrawer(page, 'Scheda alunno');
    await expect(page.getByRole('heading', { name: /Scheda Alunno & Profilo delle Competenze/ })).toBeVisible();
    await expectNavigation(page, 'report');

    const selector = page.locator('main select').first();
    await selector.selectOption({ label: OTHER_STUDENT_NAME });
    await expect(selector.locator('option:checked')).toHaveText(OTHER_STUDENT_NAME);
    const selectedId = await selector.locator('option:checked').getAttribute('value');
    expect(selectedId).toBeTruthy();

    // Browser history carries an opaque token, never the student identifier.
    const entry = await page.evaluate(() => history.state);
    expect(entry.__registroSpecialistTargetEntry).toEqual(expect.any(String));
    expect(JSON.stringify(entry)).not.toContain(selectedId);

    await fromDrawer(page, 'Analisi');
    await expectNavigation(page, 'analytics');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expectNavigation(page, 'report');
    await expect(selector.locator('option:checked')).toHaveText(OTHER_STUDENT_NAME);
    expect(errors).toEqual([]);
  });

  test('Indietro e Avanti ripristinano lo studente corretto fra più schede aperte', async ({ page }) => {
    await prepareSyntheticClass(page);
    await page.locator('main').getByRole('button', { name: 'Analisi', exact: true }).click();
    const detail = page.getByTestId('mobile-analytics-student-detail');
    await detail.locator('summary').click();
    await detail.getByRole('button', { name: /Rossi Mario/ }).click();
    const reportHeading = page.getByRole('heading', { name: /Scheda Alunno & Profilo delle Competenze/ });
    await expect(reportHeading).toBeVisible();
    const selector = page.locator('main select').first();
    await expect(selector.locator('option:checked')).toHaveText(STUDENT_NAME);
    await expectNavigation(page, 'report');

    await page.locator('nav').getByRole('button', { name: 'Analisi', exact: true }).click();
    await expectNavigation(page, 'analytics');
    await detail.locator('summary').click();
    await detail.getByRole('button', { name: /Bianchi Anna/ }).click();
    await expect(reportHeading).toBeVisible();
    await expect(selector.locator('option:checked')).toHaveText(OTHER_STUDENT_NAME);
    await expectNavigation(page, 'report');
    // Only an opaque entry token belongs to history; selection IDs remain in vault-session memory.
    const selectedId = await selector.locator('option:checked').getAttribute('value');
    const stateText = await page.evaluate(() => JSON.stringify(history.state));
    expect(stateText).not.toContain(OTHER_STUDENT_NAME);
    expect(selectedId).toBeTruthy();
    expect(stateText).not.toContain(selectedId);

    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expectNavigation(page, 'analytics');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expectNavigation(page, 'report');
    await expect(selector.locator('option:checked')).toHaveText(STUDENT_NAME); // RED: stato globale ancora su B

    await page.goForward({ waitUntil: 'domcontentloaded' });
    await expectNavigation(page, 'analytics');
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await expectNavigation(page, 'report');
    await expect(selector.locator('option:checked')).toHaveText(OTHER_STUDENT_NAME);
  });

});
