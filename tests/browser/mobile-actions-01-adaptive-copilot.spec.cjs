const { test, expect } = require('@playwright/test');
const { navigationButton, closeMobileDrawerWithEscape } = require('./header01-navigation.cjs');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const password = 'mobile-actions-01-synthetic-only';

async function prepare(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('input[name="archive-mode"][value="demo"]').check();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', { name: 'Avvia la prova' }).click();
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
  test(`MOBILE-ACTIONS-01 contextual in-flow launcher, no overlap or irrelevant entry at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 700 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await prepare(page);
    const navigation = page.locator('nav').filter({ has: page.getByRole('button', { name: 'Tabellone', exact: true }) });
    const trigger = page.getByTestId('library-copilot-trigger');
    const lock = page.getByTestId('header01-lock');
    await expect(trigger).toHaveCount(0);
    await navigation.getByRole('button', { name: 'Riepilogo', exact: true }).click();
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText('Copilota');
    expect(await trigger.evaluate(el => getComputedStyle(el).position)).toBe('relative');
    const box = await trigger.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(48);
    expect(box.height).toBeGreaterThanOrEqual(48);
    await expectNoOverlap(trigger, lock);
    await expectNoOverlap(trigger, page.locator('main'));
    await trigger.click();
    const deck = page.getByTestId('copilot-deck');
    await expect(deck).toBeVisible();
    await expect(trigger).toHaveCount(0);
    await deck.evaluate(panel => { const filler = document.createElement('div'); filler.setAttribute('data-test-only','copilot-scroll-filler'); filler.style.height='1200px'; panel.appendChild(filler); panel.scrollTop=180; });
    await page.getByRole('button', { name: 'Chiudi opportunità del Copilota' }).click();
    await expect(trigger).toBeVisible();
    await navigation.getByRole('button', { name: 'Tabellone', exact: true }).click();
    await expect(trigger).toHaveCount(0);
    await page.getByRole('group',{name:'Vista Tabellone'}).getByRole('button',{name:'Storico',exact:true}).click();
    await expect(trigger).toHaveCount(0);
    await navigation.getByRole('button', { name: 'Analisi', exact: true }).click();
    await expect(trigger).toHaveCount(0);
    await navigation.getByRole('button', { name: 'Comportamento', exact: true }).click();
    await expect(trigger).toHaveCount(0);
    await expect(lock).toBeVisible();
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
    const lock = page.getByTestId('header01-lock');
    const privacy = page.getByTestId('header01-privacy');
    const trigger = page.getByTestId('library-copilot-trigger');
    await expect(trigger).toBeHidden();
    await expect(lock).toBeVisible();
    await expect(privacy).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(save).toBeVisible();
    await expectNoOverlap(save, lock);
    await expectNoOverlap(save, privacy);
    await expectNoOverlap(save, navigation);

    const fit = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth
    }));
    expect(fit.scrollWidth).toBeLessThanOrEqual(fit.innerWidth + 1);

    // Keep one-tap locking visible, and verify the secondary setting in the drawer.
    await navigationButton(page).click();
    const settings = page.getByTestId('header01-auto-lock');
    await expect(settings).toBeVisible();
    await settings.selectOption('30');
    await expect(settings).toHaveValue('30');
    await expect(lock).toBeVisible();
    await closeMobileDrawerWithEscape(page);

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
  await expect(page.getByTestId('library-copilot-trigger')).toHaveCount(0);
  await page.getByRole('button', {name:'Riepilogo', exact:true}).first().click();
  const trigger = page.getByTestId('library-copilot-trigger');
  await expect(trigger).toBeVisible();
  await expect(trigger).toContainText('Copilota');
  await expect(page.getByRole('button', { name: 'Blocca Registro', exact: true })).toBeVisible();
  await trigger.click();
  await expect(page.getByTestId('copilot-deck')).toBeVisible();
  await context.close();
});
