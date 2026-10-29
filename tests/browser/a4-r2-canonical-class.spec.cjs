const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';

async function setupFreshVault(page, password) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(password);
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
  await drawer.getByRole('button', { name: 'Classi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
}

async function deleteClassByName(page, className) {
  const manage = page.getByRole('button', { name: `Gestisci classe ${className}`, exact: true });
  await expect(manage).toBeVisible();
  await manage.click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: `Elimina classe ${className}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Apri classe ${className}`, exact: true })).toHaveCount(0);
}

async function openTeacherFirstComposer(page) {
  const trigger = page.getByTestId('library-copilot-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const deck = page.getByTestId('copilot-deck');
  await expect(deck).toBeVisible();
  await deck.getByRole('button', { name: 'Parla con il Copilota', exact: true }).click();
  const composer = page.getByTestId('library-copilot-composer');
  await expect(composer).toBeVisible();
  return composer;
}

function blockPrePlayRemoteCalls(page, remoteCalls) {
  return page.route('**/api/copilot/**', async route => {
    remoteCalls.push(route.request().url());
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'A4_R2_PRE_PLAY_REMOTE_CALL_FORBIDDEN' }) });
  });
}

test.use({ viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' });
test.setTimeout(120000);

test('A4-R2A legacy ordinal UDA is available through the real compact Registro class without a duplicate class target', async ({ page }) => {
  const remoteCalls = [];
  await blockPrePlayRemoteCalls(page, remoteCalls);
  await setupFreshVault(page, 'a4-r2-canonical-class-browser-1');
  await deleteClassByName(page, '3ª A - Secondaria I Grado');
  await createClassAndReturnHome(page, '3A');

  const composer = await openTeacherFirstComposer(page);
  await composer.getByPlaceholder('Per esempio: attività per le classi prime').fill('Attività per 3A');
  await composer.locator('button[type="submit"]').click();

  await expect(composer.getByText('Su quale lavoro?', { exact: true })).toBeVisible();
  await expect(composer.getByText(/Per 3A non c’è ancora una UDA disponibile/)).toHaveCount(0);
  const contextSelect = composer.getByTestId('library-copilot-context-select');
  await expect(contextSelect).toBeVisible();
  await expect(contextSelect.locator('option').filter({ hasText: 'UDA 1: Transizione Energetica e Fonti Rinnovabili' })).toHaveCount(1);
  await expect(composer.getByRole('button', { name: '3ª A', exact: true })).toHaveCount(0);
  await expect(remoteCalls).toEqual([]);
});

test('A4-R2A two real records with the same semantic class fail closed and require explicit reconciliation', async ({ page }) => {
  const remoteCalls = [];
  await blockPrePlayRemoteCalls(page, remoteCalls);
  await setupFreshVault(page, 'a4-r2-canonical-class-browser-2');
  await createClassAndReturnHome(page, '1A');
  await createClassAndReturnHome(page, '1ª A');

  const composer = await openTeacherFirstComposer(page);
  await composer.getByPlaceholder('Per esempio: attività per le classi prime').fill('Attività per le classi prime');
  await composer.locator('button[type="submit"]').click();

  const classChoice = composer.getByTestId('teacher-first-class-choice');
  await expect(classChoice).toBeVisible();
  await expect(classChoice.getByRole('button', { name: '1A', exact: true })).toBeVisible();
  await expect(classChoice.getByRole('button', { name: '1ª A', exact: true })).toBeVisible();
  await classChoice.getByRole('button', { name: '1A', exact: true }).click();
  await expect(composer.getByText(/coincide con un’altra identità di classe nel Registro/)).toBeVisible();
  await expect(composer.getByTestId('library-copilot-context-select')).toHaveCount(0);
  await expect(remoteCalls).toEqual([]);
});

test('A4-R2A mixed ordinal and compact class references preserve every requested real class without exposing alias duplicates', async ({ page }) => {
  const remoteCalls = [];
  await blockPrePlayRemoteCalls(page, remoteCalls);
  await setupFreshVault(page, 'a4-r2-canonical-class-browser-3');
  await deleteClassByName(page, '3ª A - Secondaria I Grado');
  await createClassAndReturnHome(page, '3A');
  await createClassAndReturnHome(page, '3C');

  const composer = await openTeacherFirstComposer(page);
  await composer.getByPlaceholder('Per esempio: attività per le classi prime').fill('Attività per 3ª A e 3C');
  await composer.locator('button[type="submit"]').click();

  const classChoice = composer.getByTestId('teacher-first-class-choice');
  await expect(classChoice).toBeVisible();
  await expect(classChoice.getByRole('button', { name: '3A', exact: true })).toBeVisible();
  await expect(classChoice.getByRole('button', { name: '3C', exact: true })).toBeVisible();
  await expect(classChoice.getByRole('button', { name: '3ª A', exact: true })).toHaveCount(0);
  await expect(classChoice.getByRole('button')).toHaveCount(2);
  await expect(remoteCalls).toEqual([]);
});

