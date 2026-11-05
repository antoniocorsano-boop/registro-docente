const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const password = 'mobile-actions-01-synthetic-only';

async function prepare(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept('Classe sintetica Mobile Actions'));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: /Gestione Elenco Alunni/ })).toBeVisible();
  const notice = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await notice.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  }
}

for (const width of [390, 320]) {
  test(`MOBILE-ACTIONS-01 trigger compact, separate from Vault, auto-hides on downward scroll and form focus at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 700 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await prepare(page);

    const trigger = page.getByTestId('library-copilot-trigger');
    const lock = page.getByRole('button', { name: 'Blocca Registro', exact: true });
    const vault = lock.locator('..');
    const navigation = page.locator('nav').filter({ has: page.getByRole('button', { name: 'Tabellone', exact: true }) });
    await expect(trigger).toBeVisible();
    await expect(lock).toBeVisible();
    const initial = await trigger.boundingBox();
    const security = await vault.boundingBox();
    const nav = await navigation.boundingBox();
    expect(initial).not.toBeNull();
    expect(security).not.toBeNull();
    expect(nav).not.toBeNull();
    expect(initial.width).toBeGreaterThanOrEqual(48);
    expect(initial.height).toBeGreaterThanOrEqual(48);
    expect(initial.x + initial.width).toBeLessThan(security.x);
    expect(initial.y + initial.height).toBeLessThanOrEqual(nav.y + 1);

    // Synthetic geometry only; no professional entries are modified.
    await page.evaluate(() => {
      document.querySelector('main').style.minHeight = '2400px';
      window.scrollTo(0, 0);
    });
    await page.evaluate(() => window.scrollTo(0, 550));
    await expect(trigger).toBeHidden();
    await expect(lock).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 120));
    await expect(trigger).toBeVisible();

    const input = page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)');
    await input.focus();
    await expect(trigger).toBeHidden();
    await input.blur();
    await expect(trigger).toBeVisible();

    await trigger.click();
    await expect(page.getByTestId('copilot-deck')).toBeVisible();
    await expect(trigger).toHaveCount(0);
    await expect(lock).toBeVisible();
    await page.getByRole('button', { name: 'Chiudi opportunità del Copilota' }).click();
    await expect(trigger).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('MOBILE-ACTIONS-01 desktop retains labelled Copilota trigger and direct security action', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await prepare(page);
  const trigger = page.getByTestId('library-copilot-trigger');
  await expect(trigger).toBeVisible();
  await expect(trigger).toContainText('Copilota');
  await expect(page.getByRole('button', { name: 'Blocca Registro', exact: true })).toBeVisible();
  await trigger.click();
  await expect(page.getByTestId('copilot-deck')).toBeVisible();
  await context.close();
});
