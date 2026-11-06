const { test, expect } = require('@playwright/test');
const { navigationButton, settleOggiNavigation } = require('./header01-navigation.cjs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const CLASS_NAME = '2C Sintetica FLOW-02';
const RAPID_NOTE = 'Osservazione temporanea FLOW-02: il gruppo richiede un esempio aggiuntivo.';

function evidencePath(name) {
  const dir = process.env.EVIDENCE_DIR;
  return dir ? path.resolve(dir, name) : name;
}

async function configureVault(page, password) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
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

async function createSyntheticClass(page) {
  page.once('dialog', dialog => dialog.accept(CLASS_NAME));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${CLASS_NAME}` })).toBeVisible();
  await closePersistenceConfirmation(page);
  await openOggiFromDrawer(page);
}

async function openConductPanel(page) {
  await page.getByRole('button', { name: 'Conduci', exact: true }).click();
  const pending = page.getByRole('status');
  await expect(pending).toContainText('Per continuare con Conduci, scegli una classe.');
  await page.getByRole('button', { name: `Apri classe ${CLASS_NAME}`, exact: true }).click();

  const panel = page.getByRole('region', { name: `Conduci per ${CLASS_NAME}` });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(`Stai conducendo con ${CLASS_NAME}`);
  await expect(panel).toContainText('Nessuna attività univoca già disponibile');
  await expect(panel).toContainText('Temporanea — non ancora registrata');
  return panel;
}

async function assertSelectedClassStillVisible(page) {
  const quickSwitcher = page.locator('select[title="Cambia rapidamente classe attiva"]');
  if (await quickSwitcher.isVisible().catch(() => false)) {
    await expect.poll(() => quickSwitcher.evaluate(select =>
      select.selectedOptions[0]?.textContent?.trim() ?? ''
    )).toBe(CLASS_NAME);
    return;
  }

  await expect.poll(async () => {
    const labels = page.getByText(CLASS_NAME, { exact: true });
    const count = await labels.count();
    for (let index = 0; index < count; index += 1) {
      if (await labels.nth(index).isVisible()) return true;
    }
    return false;
  }).toBe(true);
}

async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function assertStickyHeaderClearsConductPanel(page, panel) {
  const header = page.locator('header').first();
  const firstCritical = panel.getByText('Adesso', { exact: true });
  await expect(header).toBeVisible();
  await expect(firstCritical).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  const [headerBox, contentBox] = await Promise.all([
    header.boundingBox(),
    firstCritical.boundingBox()
  ]);

  expect(headerBox).not.toBeNull();
  expect(contentBox).not.toBeNull();
  expect(contentBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height - 1);
}

async function assertCriticalControlsTouchSafe(panel) {
  for (const label of ['Privacy Shield', 'Chiedi supporto', 'Vai a Registra']) {
    const button = panel.getByRole('button', { name: new RegExp(label) });
    await expect(button).toBeVisible();
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
}

async function assertTextareaNotCoveredByFixedBottomControl(page, panel) {
  const textarea = panel.getByLabel('Nota rapida', { exact: true });
  await textarea.scrollIntoViewIfNeeded();
  const box = await textarea.boundingBox();
  expect(box).not.toBeNull();

  const overlaps = await page.evaluate((textareaBox) => {
    const intersects = (a, b) => !(
      a.right <= b.left ||
      a.left >= b.right ||
      a.bottom <= b.top ||
      a.top >= b.bottom
    );
    const target = {
      left: textareaBox.x,
      top: textareaBox.y,
      right: textareaBox.x + textareaBox.width,
      bottom: textareaBox.y + textareaBox.height
    };

    return [...document.querySelectorAll('body *')]
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.position === 'fixed' && style.visibility !== 'hidden' && style.display !== 'none';
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          text: (element.textContent || '').trim().slice(0, 80),
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }
        };
      })
      .filter((entry) => intersects(target, entry.rect));
  }, box);

  expect(overlaps).toEqual([]);
}

async function assertVaultControlsClearOperationalActions(page, panel) {
  const privacy = panel.getByRole('button', { name: /Privacy Shield/ });
  await privacy.scrollIntoViewIfNeeded();
  const privacyBox = await privacy.boundingBox();
  expect(privacyBox).not.toBeNull();

  // The mobile security controls live in the one sticky top bar.
  for (const control of [page.getByTestId('header01-privacy'), page.getByTestId('header01-lock')]) {
    await expect(control).toBeVisible();
    const controlBox = await control.boundingBox();
    expect(controlBox).not.toBeNull();

    const intersects = !(
      privacyBox.x + privacyBox.width <= controlBox.x ||
      privacyBox.x >= controlBox.x + controlBox.width ||
      privacyBox.y + privacyBox.height <= controlBox.y ||
      privacyBox.y >= controlBox.y + controlBox.height
    );
    expect(intersects).toBe(false);
  }

  // Automatic locking is secondary, but remains directly configurable.
  await navigationButton(page).click();
  const autoLock = page.getByTestId('header01-auto-lock');
  await expect(autoLock).toBeVisible();
  await autoLock.selectOption('30');
  await expect(autoLock).toHaveValue('30');
  await page.keyboard.press('Escape');
  await expect(autoLock).toBeHidden();
}

async function openConductCopilot(page, panel) {
  await panel.getByRole('button', { name: 'Chiedi supporto', exact: true }).click();
  const composer = page.getByTestId('library-copilot-composer');
  await expect(composer).toBeVisible();
  await expect(composer).toContainText(CLASS_NAME);
  await expect(composer).toContainText('Supporto durante la lezione');
  await expect(composer.getByLabel('Che cosa ti serve adesso?', { exact: true })).toBeVisible();
  await expect(composer).not.toContainText('contesto UDA non univoco');
  await expect(composer).not.toContainText(RAPID_NOTE);
  await expect(composer.getByRole('button', { name: 'Preparare un’attività', exact: true })).toHaveCount(0);
  await expect(composer.getByRole('button', { name: 'Lavorare su un materiale', exact: true })).toHaveCount(0);
  await expect(composer.getByRole('button', { name: 'Collegare a una UDA', exact: true })).toHaveCount(0);
  await expect(composer.getByRole('button', { name: 'Rivedere qualcosa', exact: true })).toHaveCount(0);
  await expect(composer.getByTestId('teacher-first-class-choice')).toHaveCount(0);
  return composer;
}

async function handoffToRecord(page, panel) {
  await panel.getByRole('button', { name: 'Vai a Registra', exact: true }).click();
  const record = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
  await expect(record).toBeVisible();
  await expect(record).toContainText(CLASS_NAME);
  await assertSelectedClassStillVisible(page);
  return record;
}

test.describe('FLOW-02 desktop qualification', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Conduci exposes a compact class-first lesson surface without hidden writes', async ({ page }) => {
    await configureVault(page, 'flow-02-desktop');
    await createSyntheticClass(page);
    const panel = await openConductPanel(page);

    await expect(panel.getByRole('button', { name: 'Privacy Shield Attivo', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await assertNoHorizontalOverflow(page);
    await assertSelectedClassStillVisible(page);
    await page.screenshot({ path: evidencePath('flow-02-desktop-conduct.png'), fullPage: true });

    await panel.getByRole('button', { name: 'Materiali', exact: true }).click();
    await expect(panel).toBeHidden();
    await expect(page.getByTestId('library-copilot-trigger')).toBeVisible();
    await assertSelectedClassStillVisible(page);
  });
});

test.describe('FLOW-02 mobile qualification', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Conduci is touch-safe, privacy-visible and hands the same class explicitly to Registra', async ({ page }) => {
    await configureVault(page, 'flow-02-mobile');
    await createSyntheticClass(page);
    const panel = await openConductPanel(page);

    await assertNoHorizontalOverflow(page);
    await assertStickyHeaderClearsConductPanel(page, panel);
    await assertCriticalControlsTouchSafe(panel);
    await assertVaultControlsClearOperationalActions(page, panel);
    await page.screenshot({ path: evidencePath('flow-02-mobile-conduct-viewport.png') });
    await page.screenshot({ path: evidencePath('flow-02-mobile-conduct.png'), fullPage: true });

    const note = panel.getByLabel('Nota rapida', { exact: true });
    await note.fill(RAPID_NOTE);
    await expect(note).toHaveValue(RAPID_NOTE);
    await assertTextareaNotCoveredByFixedBottomControl(page, panel);
    await page.screenshot({ path: evidencePath('flow-02-mobile-note.png') });

    const privacy = panel.getByRole('button', { name: 'Privacy Shield Attivo', exact: true });
    await expect(privacy).toHaveAttribute('aria-pressed', 'true');
    await privacy.click();
    const privacyOff = panel.getByRole('button', { name: 'Privacy Shield Disattivo', exact: true });
    await expect(privacyOff).toHaveAttribute('aria-pressed', 'false');
    await page.screenshot({ path: evidencePath('flow-02-mobile-privacy.png') });

    const composer = await openConductCopilot(page, panel);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: evidencePath('flow-02-mobile-copilot.png') });
    await composer.getByRole('button', { name: 'Chiudi Copilota', exact: true }).click();
    await expect(composer).toBeHidden();

    const record = await handoffToRecord(page, panel);
    await expect(record.getByLabel('Nota di sessione', { exact: true })).toHaveValue(RAPID_NOTE);
    await page.screenshot({ path: evidencePath('flow-02-mobile-record-handoff.png') });
  });
});
