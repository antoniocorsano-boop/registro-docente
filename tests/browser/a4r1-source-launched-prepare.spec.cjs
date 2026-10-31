const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const vaultPassword = 'a4-r1-source-launch-browser';
const CLASS_NAME = 'LSM Test A4-R1';
const UDA_TITLE = 'UDA LSM Test A4-R1';
const SOURCE_TITLE = 'Prova LSM — generatore didattico A4-R1';

test.use({ viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' });
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

async function openDrawerItem(page, label) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const item = page.getByRole('complementary').getByRole('button', { name: label, exact: true });
  await expect(item).toBeVisible();
  await item.click();
}

async function createSyntheticClass(page) {
  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);
}

async function createSyntheticUda(page) {
  await openDrawerItem(page, 'UDA');
  const udaToggle = page.getByRole('group', { name: 'Viste UDA' }).getByRole('button', { name: 'UDA', exact: true });
  if (await udaToggle.isVisible().catch(() => false)) await udaToggle.click();
  await page.getByRole('button', { name: 'Nuova UDA', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await page.getByPlaceholder('es. UDA 4: Energie Rinnovabili e Sostenibilità').fill(UDA_TITLE);
  await dialog.getByRole('combobox', { name: 'Classe', exact: true }).selectOption({ label: CLASS_NAME });
  await dialog.getByLabel('Ore previste').fill('1');
  await dialog.getByLabel('Mese Inizio').selectOption('9');
  await dialog.getByLabel('Durata Mesi').fill('1');
  await page.getByRole('button', { name: 'Crea UDA', exact: true }).click();
  await expect(page.getByText(UDA_TITLE, { exact: true }).first()).toBeVisible();
}

async function openLibrary(page) {
  await openDrawerItem(page, 'Biblioteca privata');
  await expect(page.getByRole('heading', { name: 'Biblioteca privata', exact: true })).toBeVisible();
}

async function addUnknownSyntheticSource(page) {
  await page.getByRole('button', { name: 'Aggiungi fonte', exact: true }).click();
  await page.getByRole('button', { name: 'Testo o idea', exact: true }).click();
  await page.getByLabel('Tipo').selectOption('concept');
  await page.getByLabel('Titolo').fill(SOURCE_TITLE);
  await page.getByLabel('Contenuto').fill('Una ruota dentata verde trasmette il movimento a un piccolo generatore didattico che produce energia elettrica.');
  await page.getByRole('button', { name: 'Salva in biblioteca', exact: true }).click();
  await expect(page.getByRole('heading', { name: SOURCE_TITLE, exact: true })).toBeVisible();
}

async function sourceCard(page) {
  const heading = page.getByRole('heading', { name: SOURCE_TITLE, exact: true });
  return heading.locator('xpath=ancestor::article');
}

test('A4-R1 source-launched PREPARE reaches local professional classification before any remote proposal', async ({ page }) => {
  let proposalCalls = 0;

  await page.route('**/api/copilot/intent/provider', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'intent provider intentionally unavailable in regression test' })
  }));
  await page.route('**/api/copilot/intent', route => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'intent provider intentionally unavailable in regression test' })
  }));
  await page.route('**/api/copilot/library-proposal**', route => {
    proposalCalls += 1;
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'remote proposal must not be called before explicit consent' })
    });
  });

  await setupFreshVault(page);
  await createSyntheticClass(page);
  await createSyntheticUda(page);
  await openLibrary(page);
  await addUnknownSyntheticSource(page);

  const card = await sourceCard(page);
  await card.getByRole('button', { name: 'Usa', exact: true }).click();
  const udaSelect = card.getByLabel('UDA corrente');
  if (!(await udaSelect.isVisible().catch(() => false))) {
    await card.getByRole('button', { name: 'Cambia', exact: true }).click();
  }
  await udaSelect.selectOption({ label: UDA_TITLE });
  await card.getByRole('button', { name: 'Usa con Copilota', exact: true }).click();

  const composer = page.getByTestId('library-copilot-composer');
  await expect(composer).toBeVisible();
  await composer.getByRole('button', { name: 'Preparare un’attività', exact: true }).click();
  await composer.getByRole('button', { name: 'Mostra le possibilità', exact: true }).click();

  const disclosure = composer.getByTestId('library-copilot-prepare-disclosure');
  await expect(disclosure).toBeVisible();
  await expect(disclosure.getByRole('button', {
    name: 'Classifica come materiale professionale',
    exact: true
  })).toBeVisible();
  expect(proposalCalls).toBe(0);
});
