const { test, expect } = require('@playwright/test');
const { navigationButton, settleOggiNavigation } = require('./header01-navigation.cjs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const CLASS_NAME = '2C Sintetica TODAY-01';

test.use({ trace: 'retain-on-failure' });

function evidencePath(name) {
  const dir = process.env.EVIDENCE_DIR;
  return dir ? path.resolve(dir, name) : name;
}

async function configureVault(page, password) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('input[name="archive-mode"][value="demo"]').check();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', { name: 'Avvia la prova' }).click();
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
}

async function closePersistenceConfirmation(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await heading.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(heading).toBeHidden();
  }
}

async function openOggiFromDrawer(page) {
  await navigationButton(page).click();
  const drawer = page.getByRole('complementary');
  const oggi = drawer.getByRole('button', { name: 'Oggi', exact: true });
  await expect(oggi).toBeVisible();
  await oggi.click();
  await settleOggiNavigation(page);
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
}

async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

test.describe('TODAY-01 desktop qualification', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Oggi stays neutral, requires explicit class choice and continues through existing surfaces', async ({ page }) => {
    await configureVault(page, 'today-01-desktop');

    for (const label of ['Prepara', 'Conduci', 'Registra', 'Rivedi']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }
    const expertViews = page.getByRole('group', { name: 'Vista home' });
    for (const label of ['Classi', 'Sintesi', 'Confronto']) {
      await expect(expertViews.getByRole('button', { name: label, exact: true })).toBeVisible();
    }

    await page.screenshot({ path: evidencePath('today-01-desktop-home.png'), fullPage: true });

    await page.getByRole('button', { name: 'Prepara', exact: true }).click();
    const pending = page.getByRole('status');
    await expect(pending).toContainText('Per continuare con Prepara, scegli una classe.');
    const classChoices = page.getByRole('button', { name: /^Apri classe / });
    expect(await classChoices.count()).toBeGreaterThan(0);
    await expect(page.getByRole('region', { name: 'Continua: Prepara' })).toHaveCount(0);
    await pending.getByRole('button', { name: 'Annulla azione di oggi' }).click();
    await expect(pending).toBeHidden();

    page.once('dialog', dialog => dialog.accept(CLASS_NAME));
    await page.getByRole('button', { name: /Nuova Classe/ }).click();
    await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
    await closePersistenceConfirmation(page);

    await openOggiFromDrawer(page);
    await page.getByRole('button', { name: 'Rivedi', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Per continuare con Rivedi, scegli una classe.');
    await page.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true }).click();

    const continuation = page.getByRole('region', { name: `Rivedi la classe ${CLASS_NAME}` });
    await expect(continuation).toBeVisible();
    for (const label of ['Tabellone', 'Analisi', 'Storico', 'Scheda alunno']) {
      await expect(continuation.getByRole('button', { name: new RegExp(`^${label}`) })).toBeVisible();
    }
    await page.screenshot({ path: evidencePath('today-01-desktop-continuation.png'), fullPage: true });

    await continuation.getByRole('button', { name: 'Chiudi la sessione Rivedi' }).click();
    await expect(continuation).toBeHidden();
    await expect(page.getByRole('heading', { name: `Panoramica Sezione: ${CLASS_NAME}`, exact: true })).toBeVisible();
  });
});

test.describe('TODAY-01 mobile qualification', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Oggi remains touch-safe and non-overflowing at 390x844', async ({ page }) => {
    await configureVault(page, 'today-01-mobile');

    for (const label of ['Prepara', 'Conduci', 'Registra', 'Rivedi']) {
      const action = page.getByRole('button', { name: label, exact: true });
      await expect(action).toBeVisible();
      const box = await action.boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: evidencePath('today-01-mobile-home.png'), fullPage: true });

    await page.getByRole('button', { name: 'Registra', exact: true }).click();
    const pending = page.getByRole('status');
    await expect(pending).toContainText('Per continuare con Registra, scegli una classe.');
    await expect(pending.getByRole('button', { name: 'Annulla azione di oggi' })).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: evidencePath('today-01-mobile-class-cue.png'), fullPage: true });

    await pending.getByRole('button', { name: 'Annulla azione di oggi' }).click();
    await expect(pending).toBeHidden();
  });
});

test('MOBILE-01 Android cards: long class names never collide with Gestisci at 390/320', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await configureVault(page, 'mobile01-android-cards-synthetic');
  const className = '3ª Z - Secondaria I Grado';
  page.once('dialog', dialog => dialog.accept(className));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${className}` })).toBeVisible();
  await closePersistenceConfirmation(page);
  await openOggiFromDrawer(page);

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const card = page.locator('[data-uxqa-class-card]').filter({
      has: page.getByRole('button', { name: `Apri classe ${className}`, exact: true }),
    });
    await expect(card).toBeVisible();
    await expect(card.getByTestId('class-card-short-name')).toHaveText('3ª Z');
    await expect(card.getByTestId('class-card-descriptor')).toHaveText('Secondaria I Grado');

    const open = card.getByRole('button', { name: `Apri classe ${className}`, exact: true });
    const manage = card.getByRole('button', { name: `Gestisci classe ${className}`, exact: true });
    const openBounds = await open.boundingBox();
    const manageBounds = await manage.boundingBox();
    expect(openBounds).not.toBeNull();
    expect(manageBounds).not.toBeNull();
    // Separate action rows: no overlap even on small Android screens.
    expect(openBounds.y + openBounds.height).toBeLessThanOrEqual(manageBounds.y + 1);
    expect(manageBounds.height).toBeGreaterThanOrEqual(44);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: evidencePath(`mobile01-android-class-cards-${width}.png`), fullPage: true,
    });

    await manage.click();
    await expect(card.getByRole('button', { name: `Elimina classe ${className}` })).toBeVisible();
    await manage.click();
  }
});
