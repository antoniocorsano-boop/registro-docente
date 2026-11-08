const { test, expect } = require('@playwright/test');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const projectionFixture = path.resolve(__dirname, '../docs/contracts/fixtures/docente-os-registro-teaching-projection-v1.json');
const CLASS_NAME = '1A';

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  trace: 'retain-on-failure'
});
test.setTimeout(120000);

async function configureSyntheticVault(page) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill('a4-r2b-task7-synthetic-only');
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
}

async function closeSavedNotice(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await heading.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
  }
}

async function openDrawerItem(page, label) {
  const mobileNavigation = page.getByTestId('header01-brand-navigation');
  if (await mobileNavigation.isVisible()) {
    await mobileNavigation.click();
  } else {
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
  }
  const drawer = page.locator('#registro-navigation-drawer');
  await drawer.getByRole('button', { name: label, exact: true }).click();
}

async function createClass(page, className) {
  page.once('dialog', dialog => dialog.accept(className));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: 'Gestione Elenco Alunni: ' + className })).toBeVisible();
  await closeSavedNotice(page);
}

async function openImport(page) {
  await openDrawerItem(page, 'Programmazione didattica');
  const region = page.getByRole('region', { name: 'Importazione proiezione Docente OS' });
  await expect(region).toBeVisible();
  const details = region.locator('details').first();
  await expect(details).not.toHaveAttribute('open');
  await details.locator('summary').first().click();
  await expect(details).toHaveAttribute('open', '');
  return region;
}

test('A4-R2B Task 7 — invalid JSON or unresolved class never authorizes projection write', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await configureSyntheticVault(page);
  const region = await openImport(page);
  const input = region.locator('input[type="file"]');
  await input.setInputFiles({
    name: 'invalid-synthetic.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{ invalid local JSON')
  });
  await expect(region.getByRole('alert')).toContainText('non è un JSON leggibile');
  await expect(region.getByRole('button', { name: 'Accetta e salva la proiezione' })).toHaveCount(0);

  await input.setInputFiles(projectionFixture);
  const preview = region.getByRole('region', { name: 'Anteprima proiezione Docente OS' });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Riconciliazione classi');
  await expect(preview).toContainText('Non associata');
  await expect(preview.getByRole('button', { name: 'Accetta e salva la proiezione' })).toBeDisabled();
  await expect(region).not.toContainText('Proiezione Docente OS accettata e salvata.');
  expect(errors).toEqual([]);
});

test('A4-R2B Task 7 — latest file wins even if a prior read finishes later', async ({ page }) => {
  await page.addInitScript(() => {
    const originalText = File.prototype.text;
    let selectedReads = 0;
    window.__a4SlowReadDone = false;
    File.prototype.text = function () {
      const order = ++selectedReads;
      return originalText.call(this).then(text => order === 1
        ? new Promise(resolve => setTimeout(() => {
            window.__a4SlowReadDone = true;
            resolve(text);
          }, 350))
        : text);
    };
  });
  await configureSyntheticVault(page);
  const region = await openImport(page);
  const input = region.locator('input[type="file"]');
  await input.setInputFiles(projectionFixture); // valid, deliberately delayed
  await input.setInputFiles({
    name: 'latest-invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{ latest invalid JSON')
  });
  await expect(region.getByRole('alert')).toContainText('non è un JSON leggibile');
  await expect.poll(() => page.evaluate(() => window.__a4SlowReadDone)).toBe(true);
  await expect(region.getByRole('region', { name: 'Anteprima proiezione Docente OS' })).toHaveCount(0);
  await expect(region.getByRole('button', { name: 'Accetta e salva la proiezione' })).toHaveCount(0);
});

test('A4-R2B Task 7 — local file preview then explicit teacher acceptance after unique class match', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await configureSyntheticVault(page);
  await createClass(page, CLASS_NAME);
  const region = await openImport(page);
  await region.locator('input[type="file"]').setInputFiles(projectionFixture);
  const preview = region.getByRole('region', { name: 'Anteprima proiezione Docente OS' });
  await expect(preview).toBeVisible();
  await expect(preview).toContainText('Anno scolastico');
  await expect(preview).toContainText('Commit sorgente');
  await expect(preview).toContainText('Associata');
  await expect(preview).toContainText(CLASS_NAME);

  const accept = preview.getByRole('button', { name: 'Accetta e salva la proiezione' });
  await expect(accept).toBeEnabled();
  await expect(region).not.toContainText('Proiezione Docente OS accettata e salvata.');
  await accept.click();
  await expect(region.getByRole('status')).toContainText('Proiezione Docente OS accettata e salvata.');
  await expect(preview).toHaveCount(0);
  await expect(page).toHaveURL(/tab=programmazione/);
  expect(page.url()).not.toContain('section-1a');
  expect(errors).toEqual([]);
});
