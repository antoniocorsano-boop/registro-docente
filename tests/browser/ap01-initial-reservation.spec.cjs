const { test, expect } = require('@playwright/test');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
test.use({ viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' });
test.setTimeout(120000);

/**
 * AUDIT-PRE-01 / AP-01: real IndexedDB concurrency on two same-origin tabs.
 * Both creators cross the first metadata read before either may reserve STAGING.
 * One and only one may become the owner. All data and credentials are synthetic.
 */
test('AP-01: two simultaneous initial configurations cannot replace each other', async ({ context }) => {
  await context.addInitScript(() => {
    const prototype = SubtleCrypto.prototype;
    const actual = prototype.deriveKey;
    Object.defineProperty(prototype, 'deriveKey', {
      configurable: true, writable: true,
      value: function (...args) {
        if (args[0]?.name !== 'PBKDF2' || sessionStorage.getItem('ap01-release') === '1') {
          return actual.apply(this, args);
        }
        window.__ap01Waiting = true;
        return new Promise((resolve, reject) => {
          window.__ap01Release = () => {
            sessionStorage.setItem('ap01-release', '1');
            actual.apply(this, args).then(resolve, reject);
          };
        });
      }
    });
  });

  const first = await context.newPage();
  const second = await context.newPage();
  const pages = [first, second];
  const passwords = ['synthetic-ap01-one', 'synthetic-ap01-two'];

  await Promise.all(pages.map(page => page.goto(baseURL, { waitUntil: 'domcontentloaded' })));
  await Promise.all(pages.map(page =>
    expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible()
  ));
  for (let i = 0; i < 2; i++) {
    await pages[i].locator('input[name="archive-mode"][value="demo"]').check();
    await pages[i].locator('#vault-password').fill(passwords[i]);
  }
  await Promise.all(pages.map(page => page.getByRole('button', { name: 'Avvia la prova' }).click()));

  // Both already read absent metadata; their PBKDF2 work has been paused.
  await expect.poll(async () => Promise.all(pages.map(page =>
    page.evaluate(() => window.__ap01Waiting === true))), { timeout: 30000 }
  ).toEqual([true, true]);
  await Promise.all(pages.map(page => page.evaluate(() => window.__ap01Release())));

  // A visible Home is not a terminal outcome for the competing tab.
  // Wait for BOTH submissions: one completes and the rival explicitly
  // refuses setup or returns to a protected, non-authorized state.
  const outcome = async page => {
    if (await page.getByRole('heading', { name: 'Le mie classi' }).isVisible()) {
      return 'success';
    }
    if (await page.getByRole('heading', { name: 'Sicurezza non disponibile' }).isVisible() ||
        await page.getByRole('heading', { name: 'Sblocca Registro' }).isVisible()) {
      return 'refused';
    }
    const formRejected = await page.getByRole('heading', { name: 'Configura archivio protetto' }).isVisible() &&
      await page.locator('p.text-rose-300').isVisible() &&
      await page.getByRole('button', { name: 'Avvia la prova' }).isEnabled();
    return formRejected ? 'refused' : 'pending';
  };
  await expect.poll(async () =>
    (await Promise.all(pages.map(outcome))).sort(),
  { timeout: 60000 }).toEqual(['refused', 'success']);
  const outcomes = await Promise.all(pages.map(outcome));
  expect(outcomes.filter(value => value === 'success')).toHaveLength(1);
  expect(outcomes.filter(value => value === 'refused')).toHaveLength(1);
  const owner = outcomes.indexOf('success');
  expect(owner).toBeGreaterThanOrEqual(0);

  const physical = await pages[owner].evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('registro-docente-secure-vault', 1);
      req.onupgradeneeded = () => { req.transaction?.abort(); reject(Error('Unexpected upgrade')); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(['metadata', 'records'], 'readonly');
        const meta = tx.objectStore('metadata').get('current');
        const keys = tx.objectStore('records').getAllKeys();
        tx.oncomplete = () => resolve({ state: meta.result?.state, keys: keys.result });
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  expect(physical.state).toBe('ACTIVE');
  expect(physical.keys).toHaveLength(10);

  // Durable owner can reopen; the rival password must not decrypt the winner.
  await pages[owner].reload({ waitUntil: 'domcontentloaded' });
  await expect(pages[owner].getByRole('heading', { name: 'Sblocca Registro' })).toBeVisible();
  await pages[owner].locator('#vault-password').fill(passwords[1 - owner]);
  await pages[owner].getByRole('button', { name: 'Sblocca Registro' }).click();
  await expect(pages[owner].getByRole('heading', { name: 'Le mie classi' })).toHaveCount(0);
  await pages[owner].locator('#vault-password').fill(passwords[owner]);
  await pages[owner].getByRole('button', { name: 'Sblocca Registro' }).click();
  await expect(pages[owner].getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
});


test('F3-CPL-03: a revoked migration during PBKDF2 cannot reserve an archive', async ({ page }) => {
  const sourceKey = 'registro_docente_data_v35';
  const legacy = JSON.stringify({ classes: [], currentClassId: null });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [sourceKey, legacy]);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Proteggi i dati esistenti' })).toBeVisible();

  await page.evaluate(() => {
    const original = SubtleCrypto.prototype.deriveKey;
    let held = false;
    Object.defineProperty(SubtleCrypto.prototype, 'deriveKey', {
      configurable: true, writable: true,
      value: function (...args) {
        if (args[0]?.name !== 'PBKDF2' || held) return original.apply(this, args);
        held = true;
        window.__f3KdfHeld = true;
        return new Promise((resolve, reject) => {
          window.__f3KdfRelease = () => original.apply(this, args).then(resolve, reject);
        });
      }
    });
  });

  await page.locator('#vault-password').fill('synthetic-f3-revoked-migration');
  await page.getByRole('button', { name: 'Proteggi i dati esistenti' }).click();
  await expect.poll(() => page.evaluate(() => window.__f3KdfHeld === true),
    { timeout: 30000 }).toBe(true);

  // The browser's pagehide invalidates the Root's archive authority while
  // real PBKDF2 is in flight; the crypto result must not reserve STAGING.
  await page.evaluate(() => {
    window.dispatchEvent(new Event('pagehide'));
    window.__f3KdfRelease();
  });
  await expect(page.getByRole('heading', { name: 'Proteggi i dati esistenti' }))
    .toBeVisible({ timeout: 60000 });
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), sourceKey)).toBe(legacy);

  const physical = await page.evaluate(async () => {
    const name = 'registro-docente-secure-vault';
    if (!(await indexedDB.databases()).some(item => item.name === name)) {
      return { state: null, keys: [] };
    }
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        request.transaction?.abort();
        reject(Error('Unexpected database upgrade'));
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(['metadata', 'records'], 'readonly');
        const metadata = tx.objectStore('metadata').get('current');
        const keys = tx.objectStore('records').getAllKeys();
        tx.oncomplete = () => resolve({ state: metadata.result?.state ?? null, keys: keys.result });
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  });
  expect(physical).toEqual({ state: null, keys: [] });
});
