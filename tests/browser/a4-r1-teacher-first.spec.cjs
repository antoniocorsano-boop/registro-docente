const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const vaultPassword = 'a4-r1-teacher-first-browser';

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

async function createClassAndReturnHome(page, className) {
  page.once('dialog', dialog => dialog.accept(className));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${className}` })).toBeVisible();
  await closePersistenceConfirmation(page);

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const drawer = page.getByRole('complementary');
  const classesButton = drawer.getByRole('button', { name: 'Classi', exact: true });
  await expect(classesButton).toBeVisible();
  await classesButton.click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

test.use({ viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' });
test.setTimeout(120000);

test('A4-R1 authentic teacher phrase is locally framed, disambiguated and mobile-safe before Play', async ({ page }) => {
  const remoteCalls = [];
  await page.route('**/api/copilot/**', async route => {
    remoteCalls.push(route.request().url());
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'A4_R1_PRE_PLAY_REMOTE_CALL_FORBIDDEN' })
    });
  });

  await setupFreshVault(page);
  await createClassAndReturnHome(page, '1A');
  await createClassAndReturnHome(page, '1C');

  const trigger = page.getByTestId('library-copilot-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();

  const deck = page.getByTestId('copilot-deck');
  await expect(deck).toBeVisible();
  await expect(page.getByTestId('library-copilot-trigger')).toHaveCount(0);
  await expect(deck.getByText('Non vedo qualcosa di urgente adesso. Posso comunque aiutarti con una classe, una UDA o un materiale.', { exact: true })).toBeVisible();
  await expect(deck.getByText('Nessuna opportunità forte in questo gruppo.', { exact: true })).toHaveCount(0);

  await expect(page.getByRole('button', { name: 'Blocca Registro', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Imposta blocco automatico', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Blocco automatico Registro')).toHaveCount(0);

  await deck.getByRole('button', { name: 'Parla con il Copilota', exact: true }).click();
  const composer = page.getByTestId('library-copilot-composer');
  await expect(composer).toBeVisible();
  await expect(page.getByTestId('library-copilot-trigger')).toHaveCount(0);
  await expect(composer.getByText('Cosa vuoi fare?', { exact: true })).toBeVisible();
  await expect(composer.getByText('Fonte della Biblioteca', { exact: true })).toHaveCount(0);
  await expect(composer.getByText('Contesto didattico', { exact: true })).toHaveCount(0);

  await composer.getByPlaceholder('Per esempio: attività per le classi prime').fill('Attività per le classi prime');
  await composer.locator('button[type="submit"]').click();

  const classChoice = composer.getByTestId('teacher-first-class-choice');
  await expect(classChoice).toBeVisible();
  await expect(classChoice.getByText('Per quale classe?', { exact: true })).toBeVisible();
  await expect(classChoice.getByRole('button', { name: '1A', exact: true })).toBeVisible();
  await expect(classChoice.getByRole('button', { name: '1C', exact: true })).toBeVisible();
  await expect(remoteCalls).toEqual([]);

  await classChoice.getByRole('button', { name: '1A', exact: true }).click();
  await expect(composer.getByText('Su quale lavoro?', { exact: true })).toBeVisible();
  await expect(composer.getByText('Da quale materiale vuoi partire?', { exact: true })).toHaveCount(0);
  await expect(remoteCalls).toEqual([]);
});
