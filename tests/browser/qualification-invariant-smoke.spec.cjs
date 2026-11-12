const { test, expect } = require('@playwright/test');
const { navigationButton, settleOggiNavigation } = require('./header01-navigation.cjs');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const vaultPassword = 'qualification-invariant-smoke';
const CLASS_NAME = '2C Sintetica QUAL-SMOKE';
const UDA_TITLE = 'UDA compatibilità QUAL-SMOKE';

test.use({ viewport: { width: 1280, height: 900 }, trace: 'retain-on-failure' });
test.setTimeout(60000);

async function assertNoRoutineBackupInterruption(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  await expect(heading).toBeHidden();
}

async function openDrawerItem(page, label) {
  await navigationButton(page).click();
  const item = page.getByRole('complementary').getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

test('QUAL-INVARIANT smoke preserves an exact descriptive local class binding through teacher-first Copilot selection', async ({ page }) => {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('input[name="archive-mode"][value="demo"]').check();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Avvia la prova' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();

  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await assertNoRoutineBackupInterruption(page);

  await openDrawerItem(page, 'UDA');
  const udaToggle = page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'UDA', exact: true });
  if (await udaToggle.isVisible().catch(() => false)) await udaToggle.click();
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(UDA_TITLE);
  await dialog.getByRole('combobox', { name: 'Classe', exact: true }).selectOption({ label: CLASS_NAME });
  await dialog.getByLabel('Mese Inizio').selectOption('0');
  await dialog.getByLabel('Durata Mesi').fill('10');
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(UDA_TITLE, { exact: true }).first()).toBeVisible();

  const trigger = page.getByTestId('library-copilot-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const deck = page.getByTestId('copilot-deck');
  await expect(deck).toBeVisible();
  await deck.getByRole('button', { name: 'Parla con il Copilota', exact: true }).click();

  const composer = page.getByTestId('library-copilot-composer');
  await expect(composer).toBeVisible();
  await composer.getByRole('button', { name: 'Preparare un’attività', exact: true }).click();

  const classChoice = composer.getByTestId('teacher-first-class-choice');
  await expect(classChoice).toBeVisible();
  await classChoice.getByRole('button', { name: CLASS_NAME, exact: true }).click();

  const contextSelect = composer.getByTestId('library-copilot-context-select');
  await expect(contextSelect).toBeVisible();
  const udaOption = contextSelect.locator('option').filter({ hasText: UDA_TITLE });
  await expect(udaOption).toHaveCount(1);
  expect(await udaOption.first().getAttribute('value')).toBeTruthy();
});

test('BETA-1 creates an empty professional archive offline and preserves it after reopening', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return url.origin === new URL(baseURL).origin ? route.continue() : route.abort();
  });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await expect(page.locator('#vault-password')).toHaveCount(0);
  await page.locator('input[name="archive-mode"][value="professional"]').check();
  await page.getByLabel('Istituto', { exact: true }).fill('Istituto sintetico');
  await page.getByLabel('Anno scolastico', { exact: true }).fill('2026/2027');
  await page.getByLabel('Docente', { exact: true }).fill('Docente sintetico');
  await page.getByLabel('Disciplina', { exact: true }).fill('Tecnologia');
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Crea il mio registro' }).click();
  await expect(page.getByText('Nessuna classe presente nel registro.', { exact: true })).toBeVisible();
  await context.setOffline(true);
  // Offline operation within the installed shell is exercised here; reloading
  // a dev-server page offline is not equivalent to Android's packaged assets.
  page.once('dialog', dialog => dialog.accept('Classe sintetica offline'));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: 'Gestione Elenco Alunni: Classe sintetica offline' })).toBeVisible();
  await context.setOffline(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Sblocca Registro' })).toBeVisible();
  await expect(page.locator('input[name="archive-mode"]')).toHaveCount(0);
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  await expect(page.getByRole('button', { name: 'Apri classe Classe sintetica offline', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Classi disponibili' }).getByText('1 sezioni', { exact: true })).toBeVisible();
});

test('BETA-1 historical restore and confirmed reset preserve the empty professional boundary', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  async function setupProfessional(school, password) {
    await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
    await expect(page.locator('input[name="archive-mode"]:checked')).toHaveCount(0);
    await page.locator('input[name="archive-mode"][value="professional"]').check();
    await page.getByLabel('Istituto', { exact: true }).fill(school);
    await page.getByLabel('Anno scolastico', { exact: true }).fill('2026/2027');
    await page.getByLabel('Docente', { exact: true }).fill('Docente sintetico');
    await page.getByLabel('Disciplina', { exact: true }).fill('Tecnologia');
    await page.locator('#vault-password').fill(password);
    await page.getByRole('button', { name: 'Crea il mio registro' }).click();
    await expect(page.getByText('Nessuna classe presente nel registro.', { exact: true })).toBeVisible();
  }
  await setupProfessional('Istituto sintetico iniziale', vaultPassword);
  await openDrawerItem(page, 'Privacy');
  const historical = {
    app: 'registro-docente', version: 2,
    classes: [{ id: 'legacy-synthetic', name: 'Classe storica sintetica', students: [], grades: [], behaviors: [] }],
    settings: { school: 'Istituto storico sintetico', year: '2026/2027', teacher: 'Docente storico sintetico', subject: 'Tecnologia', theme: 'cyan' },
    customTests: {}, udas: [], submissions: []
  };
  await page.locator('input[type="file"][accept=".json"]').setInputFiles({
    name: 'historical-synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(historical))
  });
  const dialogs = [];
  const acceptRestore = async d => { dialogs.push(d.message()); await d.accept(); };
  page.on('dialog', acceptRestore);
  await page.getByRole('button', { name: 'Decifra e Ripristina Registro' }).click();
  await expect(page.getByRole('button', { name: 'Apri classe Classe storica sintetica', exact: true })).toBeVisible();
  await expect.poll(() => dialogs.some(message => message.includes('Backup precedente importato'))).toBe(true);
  page.off('dialog', acceptRestore);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Sblocca Registro' })).toBeVisible();
  await page.locator('#vault-password').fill(vaultPassword);
  await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  await expect(page.getByRole('button', { name: 'Apri classe Classe storica sintetica', exact: true })).toBeVisible();
  await openDrawerItem(page, 'Verifiche online');
  await expect(page.getByRole('button', { name: 'Esiti & Item Analysis (0)', exact: true })).toBeVisible();
  await expect(page.getByText("A cosa serve l'energia", { exact: true })).toHaveCount(0);
  await openDrawerItem(page, 'Privacy');
  const reset = page.getByRole('button', { name: 'Reset Totale Sicuro', exact: true });
  page.once('dialog', d => d.dismiss());
  await reset.click();
  await expect(reset).toBeVisible();
  const resetDialogs = [];
  const confirmReset = async d => {
    resetDialogs.push(d.type());
    if (d.type() === 'prompt') await d.accept('CANCELLA');
    else await d.accept();
  };
  page.on('dialog', confirmReset);
  await reset.click();
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  page.off('dialog', confirmReset);
  expect(resetDialogs).toContain('confirm');
  expect(resetDialogs).toContain('prompt');
  await setupProfessional('Istituto sintetico nuovo', 'new-synthetic-password');
  await expect(page.getByRole('button', { name: 'Apri classe Classe storica sintetica', exact: true })).toHaveCount(0);
  await openDrawerItem(page, 'Impostazioni');
  await expect(page.getByPlaceholder('es. I.C. Vittorio De Sanctis')).toHaveValue('Istituto sintetico nuovo');
});
