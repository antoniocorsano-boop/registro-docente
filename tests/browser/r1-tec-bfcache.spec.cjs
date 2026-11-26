const { test, expect } = require('@playwright/test');
const { navigationButton } = require('./header01-navigation.cjs');

const base = process.env.BASE_URL || 'http://127.0.0.1:4173';
const password = 'r1-tec-synthetic-cache';
const protectedHeading = page => page.getByRole('heading', { name: 'Sblocca Registro' });
const calculate = page => page.getByRole('button', { name: 'Calcola Affinità Semantica' });

test.use({ launchOptions: {
  ignoreDefaultArgs: ['--disable-back-forward-cache'],
  ...(process.env.R1_CHROMIUM_EXECUTABLE ? { executablePath: process.env.R1_CHROMIUM_EXECUTABLE } : {}),
} });
test.setTimeout(45000);

async function open(page, android = false) {
  const errors = [];
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') await dialog.accept('CANCELLA');
    else if (dialog.type() === 'confirm') await dialog.accept();
    else { errors.push(dialog.message()); await dialog.dismiss(); }
  });
  await page.addInitScript(({ android }) => {
    window.r1Document = crypto.randomUUID();
    window.r1Shows = [];
    window.addEventListener('pageshow', event => {
      if (event.isTrusted) window.r1Shows.push(event.persisted);
    });
    const network = window.fetch.bind(window);
    window.r1Calls = 0;
    window.r1Pending = [];
    window.fetch = async (input, options) => {
      const url = new URL(input instanceof Request ? input.url : input, location.href);
      if (url.origin === 'http://127.0.0.1:8080') {
        window.r1Calls++;
        if (window.r1Hold) await new Promise(resolve => window.r1Pending.push(resolve));
        return Response.json({ data: [{ embedding: [1, 2] }], model: 'synthetic' });
      }
      if (url.origin === location.origin && !url.pathname.startsWith('/api/embeddings')) return network(input, options);
      throw Error('Unexpected network destination in synthetic qualification');
    };
    if (android) {
      let epoch = 0;
      let foreground = true;
      window.r1NativeTransition = active => {
        if (!active && foreground) epoch++;
        foreground = active;
        document.dispatchEvent(new Event('registro-session-change'));
      };
      window.Capacitor = { getPlatform: () => 'android', Plugins: { RegistroSession: {
        getState: async () => ({ epoch, foreground }),
        authorize: async input => { if (!foreground || input.epoch !== epoch) throw Error('Stale epoch'); },
        revoke: async () => {},
        acknowledgeShield: async () => {},
      } } };
    }
  }, { android });
  await page.goto(base);
  await page.locator('input[name="archive-mode"][value="demo"]').check();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', { name: 'Avvia la prova' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
  return errors;
}

async function menu(page, name) {
  await navigationButton(page).first().click();
  await page.getByRole('complementary').getByRole('button', { name, exact: true }).click();
}

async function playground(page) {
  await menu(page, 'Impostazioni');
  await page.locator('summary').filter({ hasText: 'Impostazioni avanzate e integrazioni' }).click();
  await expect(calculate(page)).toBeVisible();
}

const transition = (page, type, persisted = true) => page.evaluate(({ type, persisted }) => {
  window.dispatchEvent(new PageTransitionEvent(type, { persisted }));
}, { type, persisted });

test('persisted return reopens embeddings on the same authenticated production root', async ({ page }) => {
  const errors = await open(page);
  await playground(page);
  await calculate(page).click();
  await expect.poll(() => page.evaluate(() => window.r1Calls)).toBe(2);
  const documentId = await page.evaluate(() => window.r1Document);
  await transition(page, 'pagehide');
  await transition(page, 'pageshow');
  await calculate(page).click();
  await expect.poll(() => page.evaluate(() => window.r1Calls), { timeout: 3000 }).toBe(4);
  expect(await page.evaluate(() => window.r1Document)).toBe(documentId);
  expect(errors).toEqual([]);
});

test('older replies stay revoked; duplicate and ordinary events do not rotate the new session', async ({ page }) => {
  const errors = await open(page);
  await playground(page);
  await page.evaluate(() => { window.r1Hold = true; });
  await calculate(page).click();
  await expect.poll(() => page.evaluate(() => window.r1Pending.length)).toBe(2);
  await transition(page, 'pagehide');
  await transition(page, 'pagehide');
  await transition(page, 'pageshow', false);
  await transition(page, 'pageshow');
  await page.evaluate(() => { window.r1Pending.splice(0).forEach(release => release()); });
  await expect.poll(() => errors.length).toBe(1);
  expect(errors[0]).toMatch(/sessione.*revocata/i);
  await expect(page.getByText('100.0%', { exact: true })).toHaveCount(0);

  await calculate(page).click();
  await expect.poll(() => page.evaluate(() => window.r1Pending.length)).toBe(2);
  await transition(page, 'pageshow');
  await transition(page, 'pageshow', false);
  await page.evaluate(() => { window.r1Pending.splice(0).forEach(release => release()); });
  await expect(page.getByText('100.0%', { exact: true })).toBeVisible();
  expect(errors).toHaveLength(1);
});

test('expired auto-lock is enforced before any semantic request on return', async ({ page }) => {
  await open(page);
  await playground(page);
  await transition(page, 'pagehide');
  await page.evaluate(() => {
    const now = Date.now.bind(Date);
    Date.now = () => now() + 16 * 60_000;
  });
  await transition(page, 'pageshow');
  await expect(protectedHeading(page)).toBeVisible();
  await expect(calculate(page)).toHaveCount(0);
  expect(await page.evaluate(() => window.r1Calls)).toBe(0);
});

test('manual lock and completed reset cannot be revived by persisted returns', async ({ page }) => {
  await open(page);
  await transition(page, 'pagehide');
  await menu(page, 'Blocca ed esci');
  await expect(protectedHeading(page)).toBeVisible();
  await transition(page, 'pageshow');
  await expect(protectedHeading(page)).toBeVisible();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
  await menu(page, 'Privacy');
  await transition(page, 'pagehide');
  await page.getByRole('button', { name: 'Reset Totale Sicuro', exact: true }).click();
  const setup = page.getByRole('heading', { name: 'Configura archivio protetto' });
  await expect(setup).toBeVisible();
  await transition(page, 'pageshow');
  await expect(setup).toBeVisible();
  expect(await page.evaluate(() => window.r1Calls)).toBe(0);
});

test('Android persisted return requires existing suspension authentication', async ({ page }) => {
  await open(page, true);
  await playground(page);
  await page.getByPlaceholder('Testo A...').fill('Bozza sintetica preservata');
  await transition(page, 'pagehide');
  await transition(page, 'pageshow');
  await expect(protectedHeading(page)).toBeVisible();
  await transition(page, 'pageshow');
  await expect(protectedHeading(page)).toBeVisible();
  expect(await page.evaluate(() => window.r1Calls)).toBe(0);
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', { name: 'Sblocca Registro' }).click();
  await expect(page.getByPlaceholder('Testo A...')).toHaveValue('Bozza sintetica preservata');
  await calculate(page).click();
  await expect.poll(() => page.evaluate(() => window.r1Calls)).toBe(2);

  await transition(page, 'pagehide');
  await page.evaluate(() => window.r1NativeTransition(false));
  await expect(protectedHeading(page)).toBeVisible();
  await transition(page, 'pageshow');
  await expect(protectedHeading(page)).toBeVisible();
  expect(await page.evaluate(() => window.r1Calls)).toBe(2);
});

test('real browser history attests persisted return or records a reload', async ({ page }, testInfo) => {
  const errors = await open(page);
  await playground(page);
  const documentId = await page.evaluate(() => window.r1Document);
  await page.goto(new URL('/vendor/jspdf.LICENSE.txt', base).href);
  await page.goBack({ waitUntil: 'commit' });
  await expect.poll(() => page.evaluate(() => window.r1Shows.length)).toBeGreaterThan(0);
  const actual = await page.evaluate(() => ({ id: window.r1Document, shows: window.r1Shows }));
  const sameDocument = actual.id === documentId;
  const persisted = actual.shows.at(-1);
  await testInfo.attach('real-history', {
    body: JSON.stringify({ sameDocument, persisted }), contentType: 'application/json',
  });
  console.log('R1-TEC-01b real history', JSON.stringify({ sameDocument, persisted }));
  if (persisted) {
    expect(sameDocument).toBe(true);
    await expect(calculate(page)).toBeVisible();
    await calculate(page).click();
    await expect.poll(() => page.evaluate(() => window.r1Calls)).toBe(2);
    expect(errors).toEqual([]);
    await page.goForward({ waitUntil: 'commit' });
    await expect(page).toHaveURL(/\/vendor\/jspdf\.LICENSE\.txt$/);
  } else {
    expect(sameDocument).toBe(false);
    await expect(protectedHeading(page)).toBeVisible();
  }
});
