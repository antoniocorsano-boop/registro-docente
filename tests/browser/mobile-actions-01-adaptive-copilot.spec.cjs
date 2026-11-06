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

    // Gestione alunni is a writing surface where the launcher is intentionally
    // suppressed. Use the read-only Tabellone for adaptive visibility tests.
    const navigation = page.locator('nav').filter({ has: page.getByRole('button', { name: 'Tabellone', exact: true }) });
    await navigation.getByRole('button', { name: 'Tabellone', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Tabellone Classe:/ })).toBeVisible();
    const trigger = page.getByTestId('library-copilot-trigger');
    const lock = page.getByRole('button', { name: 'Blocca Registro', exact: true });
    const vault = lock.locator('..');
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
    // Slow 4px events must accumulate; a single large scroll jump is insufficient evidence.
    await page.evaluate(async () => {
      for (let y = 4; y <= 400; y += 4) {
        window.scrollTo(0, y);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    });
    await expect(trigger).toBeHidden();
    await expect(lock).toBeVisible();
    await page.evaluate(async () => {
      for (let y = 396; y >= 120; y -= 4) {
        window.scrollTo(0, y);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    });
    await expect(trigger).toBeVisible();

    // The period filter is an editable select on a permitted read-only surface.
    const periodSelect = page.locator('select').filter({ has: page.locator('option[value="ALL"]') });
    await expect(periodSelect).toBeVisible();
    await periodSelect.focus();
    await expect(trigger).toBeHidden();
    await periodSelect.blur();
    await expect(trigger).toBeVisible();

    await trigger.click();
    const deck = page.getByTestId('copilot-deck');
    await expect(deck).toBeVisible();
    await expect(trigger).toHaveCount(0);
    await expect(lock).toBeVisible();
    // Scrolling inside the Copilota overlay must not hide the launcher after closing.
    await deck.evaluate(async panel => {
      const syntheticFiller = document.createElement('div');
      syntheticFiller.style.height = '1200px';
      syntheticFiller.setAttribute('data-test-only', 'copilot-scroll-filler');
      panel.appendChild(syntheticFiller);
      for (let y = 10; y <= 180; y += 10) {
        panel.scrollTop = y;
        panel.dispatchEvent(new Event('scroll', { bubbles: false }));
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
    });
    await page.getByRole('button', { name: 'Chiudi opportunità del Copilota' }).click();
    await expect(trigger).toBeVisible();
    expect(errors).toEqual([]);
    await context.close();
  });
}

async function expectNoOverlap(a, b) {
  const first = await a.boundingBox();
  const second = await b.boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  const overlapWidth = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));
  const overlapHeight = Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));
  expect(overlapWidth * overlapHeight).toBe(0);
}

for (const width of [390, 320]) {
  test(`MOBILE-ACTIONS-01/B professional save stays unobstructed and Vault remains directly accessible at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 700 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await prepare(page);

    const navigation = page.locator('nav').filter({ has: page.getByRole('button', { name: 'Tabellone', exact: true }) });
    await navigation.getByRole('button', { name: 'Valutazioni', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();

    const save = page.getByRole('button', { name: 'Salva Valutazioni di Classe', exact: true });
    const lock = page.getByRole('button', { name: 'Blocca Registro', exact: true });
    const settings = page.getByRole('button', { name: 'Imposta blocco automatico', exact: true });
    const trigger = page.getByTestId('library-copilot-trigger');
    await expect(trigger).toBeHidden();
    await expect(lock).toBeVisible();
    await expect(settings).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(save).toBeVisible();
    await expectNoOverlap(save, lock);
    await expectNoOverlap(save, settings);
    await expectNoOverlap(save, navigation);

    const fit = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth
    }));
    expect(fit.scrollWidth).toBeLessThanOrEqual(fit.innerWidth + 1);

    await settings.click();
    await expect(page.getByRole('combobox', { name: 'Blocco automatico Registro' })).toBeVisible();
    await expect(lock).toBeVisible();
    await settings.click();

    // Focus in the editing field does not resurrect a floating trigger over Save.
    const title = page.getByPlaceholder('es. Verifica su Fonti Rinnovabili');
    await title.focus();
    await expect(trigger).toBeHidden();
    await title.blur();
    await expect(trigger).toBeHidden();
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
