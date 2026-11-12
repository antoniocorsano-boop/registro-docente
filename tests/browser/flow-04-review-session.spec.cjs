const { test, expect } = require('@playwright/test');
const { navigationButton, privacyButton, settleOggiNavigation } = require('./header01-navigation.cjs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const CLASS_NAME = '2C Sintetica FLOW-04';
const SECOND_CLASS_NAME = '3D Sintetica FLOW-04';
const STUDENT_NAME = 'Rossi Mario';
const EVALUATION_TITLE = 'Valutazione FLOW-04';
const GENERIC_ORDER = ['Tabellone', 'Analisi', 'Storico', 'Scheda alunno'];

test.use({ trace: 'retain-on-failure' });

function evidencePath(name) {
  const dir = process.env.EVIDENCE_DIR;
  return dir ? path.resolve(dir, name) : name;
}

function installPageErrorCollector(page) {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error instanceof Error ? error.message : String(error)));
  return pageErrors;
}

async function configureVault(page, password) {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Configura archivio protetto' })).toBeVisible();
  await page.locator('input[name="archive-mode"][value="demo"]').check();
  await page.locator('#vault-password').fill(password);
  await page.getByRole('button', { name: 'Avvia la prova' }).click();
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
}

async function closePersistenceConfirmationIfPresent(page) {
  const heading = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
  if (await heading.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(heading).toBeHidden();
  }
}

async function disablePrivacyShield(page) {
  const shield = privacyButton(page);
  await expect(shield).toBeVisible();
  await shield.click();
}

async function openOggiFromDrawer(page) {
  await navigationButton(page).click();
  const oggi = page.getByRole('complementary')
    .filter({ has: page.getByRole('button', { name: 'Oggi', exact: true }) })
    .getByRole('button', { name: 'Oggi', exact: true });
  await expect(oggi).toBeVisible();
  await oggi.click();
  await settleOggiNavigation(page);
  await expect(page.getByRole('heading', { name: 'Oggi', exact: true })).toBeVisible();
}

async function createSyntheticClass(page, className, { withStudent = false } = {}) {
  page.once('dialog', dialog => dialog.accept(className));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: `Gestione Elenco Alunni: ${className}` })).toBeVisible();
  await closePersistenceConfirmationIfPresent(page);

  if (withStudent) {
    await disablePrivacyShield(page);
    const input = page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)');
    await input.fill(STUDENT_NAME);
    await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
    await expect(page.getByText(STUDENT_NAME, { exact: true })).toBeVisible();
    await closePersistenceConfirmationIfPresent(page);
  }

  await openOggiFromDrawer(page);
}

async function selectPendingClass(page, actionLabel, className = CLASS_NAME) {
  await expect(page.getByRole('status')).toContainText(`Per continuare con ${actionLabel}, scegli una classe.`);
  await page.getByRole('button', { name: `Apri classe ${className}`, exact: true }).click();
}

function reviewOption(review, label) {
  return review.getByRole('button', { name: new RegExp(`^${label}`) });
}

async function openReviewFromOggi(page, className = CLASS_NAME) {
  // Oggi → Rivedi: the teacher explicitly resolves the class before ReviewSession exists.
  await page.getByRole('button', { name: 'Rivedi', exact: true }).click();
  await selectPendingClass(page, 'Rivedi', className);
  const review = page.getByRole('region', { name: `Rivedi la classe ${className}` });
  await expect(review).toBeVisible();
  await expect(review).toContainText(`Stai rivedendo la classe ${className}`);
  return review;
}

async function reviewMission(page, className = CLASS_NAME) {
  // Missione Rivedi: continuity is visible inside an authoritative specialist surface.
  const banner = page.getByRole('complementary', { name: `Sessione Rivedi per la classe ${className}` });
  await expect(banner).toBeVisible();
  return banner;
}

async function extractReviewOrder(review, expectedLabels) {
  const actual = [];
  for (const label of expectedLabels) {
    const option = reviewOption(review, label);
    await expect(option).toBeVisible();
    const box = await option.boundingBox();
    expect(box).not.toBeNull();
    actual.push({ label, y: box.y });
  }
  return actual.sort((a, b) => a.y - b.y).map(item => item.label);
}

async function assertNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function assertTouchSafe(locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box.height).toBeGreaterThanOrEqual(44);
}

async function assertNotObscuredByFixedControls(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();

  const overlaps = await page.evaluate(targetBox => {
    const target = {
      left: targetBox.x,
      top: targetBox.y,
      right: targetBox.x + targetBox.width,
      bottom: targetBox.y + targetBox.height
    };
    const intersects = (a, b) => !(
      a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom
    );

    return [...document.querySelectorAll('body *')]
      .filter(element => {
        const style = getComputedStyle(element);
        return style.position === 'fixed' && style.visibility !== 'hidden' && style.display !== 'none';
      })
      .map(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      })
      .filter(rect => intersects(target, rect));
  }, box);

  expect(overlaps).toEqual([]);
}

async function assertReviewRouterTouchSafe(review) {
  for (const label of GENERIC_ORDER) {
    await assertTouchSafe(reviewOption(review, label));
  }
  await assertTouchSafe(review.getByRole('button', { name: 'Chiudi la sessione Rivedi' }));
}

test.describe('FLOW-04 Oggi → Rivedi desktop qualification', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('keeps one review mission across existing surfaces and fails closed on boundary changes', async ({ page }) => {
    const pageErrors = installPageErrorCollector(page);
    await configureVault(page, 'flow-04-desktop');
    await createSyntheticClass(page, CLASS_NAME, { withStudent: true });
    await createSyntheticClass(page, SECOND_CLASS_NAME);

    let review = await openReviewFromOggi(page, CLASS_NAME);
    expect(await extractReviewOrder(review, GENERIC_ORDER)).toEqual(GENERIC_ORDER);
    await expect(page.getByRole('complementary', { name: `Sessione Rivedi per la classe ${CLASS_NAME}` })).toHaveCount(0);
    await expect(page.locator('[data-testid="flow03b-class-overview"]')).toHaveJSProperty('open', false);
    await page.screenshot({ path: evidencePath('flow-04-desktop-router.png'), fullPage: true });

    await reviewOption(review, 'Tabellone').click();
    let banner = await reviewMission(page);
    await expect(banner).toContainText('Superficie corrente: Tabellone');
    await assertTouchSafe(banner.getByRole('button', { name: 'Torna a Rivedi', exact: true }));
    await assertTouchSafe(banner.getByRole('button', { name: 'Chiudi', exact: true }));
    await page.screenshot({ path: evidencePath('flow-04-desktop-tabellone.png'), fullPage: true });

    // specialist-to-specialist keeps review mission even when the specialist view calls setActiveTab directly.
    await page.getByRole('cell', { name: STUDENT_NAME, exact: true }).click();
    banner = await reviewMission(page);
    await expect(banner).toContainText('Superficie corrente: Scheda alunno');
    await page.screenshot({ path: evidencePath('flow-04-desktop-report-from-tabellone.png'), fullPage: true });

    await banner.getByRole('button', { name: 'Torna a Rivedi', exact: true }).click();
    review = page.getByRole('region', { name: `Rivedi la classe ${CLASS_NAME}` });
    await expect(review).toBeVisible();
    expect(await extractReviewOrder(review, GENERIC_ORDER)).toEqual(GENERIC_ORDER);

    await reviewOption(review, 'Analisi').click();
    banner = await reviewMission(page);
    await expect(banner).toContainText('Superficie corrente: Analisi');
    await page.screenshot({ path: evidencePath('flow-04-desktop-analisi.png'), fullPage: true });

    await banner.getByRole('button', { name: 'Torna a Rivedi', exact: true }).click();
    review = page.getByRole('region', { name: `Rivedi la classe ${CLASS_NAME}` });
    await review.getByRole('button', { name: 'Chiudi la sessione Rivedi' }).click();
    await expect(review).toBeHidden();
    await expect(page.locator('[data-testid="flow03b-class-overview"]')).toHaveJSProperty('open', true);

    // specialist exit closes review mission when Storico opens the non-review evaluation editor directly.
    await openOggiFromDrawer(page);
    review = await openReviewFromOggi(page, CLASS_NAME);
    await reviewOption(review, 'Storico').click();
    banner = await reviewMission(page);
    await expect(banner).toContainText('Superficie corrente: Storico');
    await page.getByRole('button', { name: /Nuova Valutazione/ }).click();
    await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();
    await expect(banner).toBeHidden();

    // non-review navigation closes the mission instead of carrying it into an unrelated task.
    await openOggiFromDrawer(page);
    review = await openReviewFromOggi(page, CLASS_NAME);
    await reviewOption(review, 'Tabellone').click();
    banner = await reviewMission(page);
    await openOggiFromDrawer(page);
    await expect(banner).toBeHidden();

    // class switch closes the prior review mission; it never retargets the session implicitly.
    review = await openReviewFromOggi(page, CLASS_NAME);
    await reviewOption(review, 'Tabellone').click();
    banner = await reviewMission(page);
    const quickSwitcher = page.locator('select[title="Cambia rapidamente classe attiva"]');
    await expect(quickSwitcher).toBeVisible();
    await quickSwitcher.selectOption({ label: SECOND_CLASS_NAME });
    await expect(banner).toBeHidden();
    await expect.poll(() => quickSwitcher.evaluate(select => select.selectedOptions[0]?.textContent?.trim() ?? ''))
      .toBe(SECOND_CLASS_NAME);

    expect(pageErrors).toEqual([]);
  });
});

test.describe('FLOW-04 Registra → Rivedi desktop qualification', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('preserves evaluation provenance as contextual ordering without auto-opening a destination', async ({ page }) => {
    const pageErrors = installPageErrorCollector(page);
    await configureVault(page, 'flow-04-post-record');
    await createSyntheticClass(page, CLASS_NAME, { withStudent: true });

    await page.getByRole('button', { name: 'Registra', exact: true }).click();
    await selectPendingClass(page, 'Registra');
    const record = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
    await expect(record).toBeVisible();
    await record.getByRole('button', { name: 'Valutazione', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nuova Valutazione di Classe' })).toBeVisible();
    await page.getByPlaceholder('es. Verifica su Fonti Rinnovabili').fill(EVALUATION_TITLE);
    await page.getByRole('button', { name: 'Tutti 8', exact: true }).click();
    await page.getByRole('button', { name: 'Salva Valutazioni di Classe', exact: true }).click();
    await closePersistenceConfirmationIfPresent(page);

    const savedRecord = page.getByRole('region', { name: `Registra per ${CLASS_NAME}` });
    await expect(savedRecord).toContainText('Registrazione completata');
    await savedRecord.getByRole('button', { name: 'Rivedi', exact: true }).click();

    // Registra → Rivedi carries only bounded evidence-kind provenance.
    let review = page.getByRole('region', { name: `Rivedi la classe ${CLASS_NAME}` });
    await expect(review).toBeVisible();
    await expect(review).toContainText("L'ordine delle superfici riflette il tipo di evidenza appena registrata");
    const expectedOrder = ['Tabellone', 'Analisi', 'Storico', 'Scheda alunno'];
    expect(await extractReviewOrder(review, expectedOrder)).toEqual(expectedOrder);

    // no destination auto-opens: the teacher still chooses the first review surface.
    await expect(page.getByRole('complementary', { name: `Sessione Rivedi per la classe ${CLASS_NAME}` })).toHaveCount(0);
    await page.screenshot({ path: evidencePath('flow-04-post-record-router.png'), fullPage: true });

    // opening the first destination keeps the banner and the same review mission.
    await reviewOption(review, 'Tabellone').click();
    const banner = await reviewMission(page);
    await expect(banner).toContainText('Superficie corrente: Tabellone');

    // returning keeps contextual ordering rather than rebuilding a generic router.
    await banner.getByRole('button', { name: 'Torna a Rivedi', exact: true }).click();
    review = page.getByRole('region', { name: `Rivedi la classe ${CLASS_NAME}` });
    await expect(review).toContainText("L'ordine delle superfici riflette il tipo di evidenza appena registrata");
    expect(await extractReviewOrder(review, expectedOrder)).toEqual(expectedOrder);
    await page.screenshot({ path: evidencePath('flow-04-post-record-return.png'), fullPage: true });

    expect(pageErrors).toEqual([]);
  });
});

test.describe('FLOW-04 mobile qualification', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps router and mission controls touch-safe, non-overflowing and unobscured at 390x844', async ({ page }) => {
    const pageErrors = installPageErrorCollector(page);
    await configureVault(page, 'flow-04-mobile');
    await createSyntheticClass(page, CLASS_NAME);

    const review = await openReviewFromOggi(page);
    await assertReviewRouterTouchSafe(review);
    await assertNoHorizontalOverflow(page);
    await assertNotObscuredByFixedControls(page, reviewOption(review, 'Tabellone'));
    await page.screenshot({ path: evidencePath('flow-04-mobile-router.png'), fullPage: true });

    await reviewOption(review, 'Tabellone').click();
    const banner = await reviewMission(page);
    await expect(banner).toContainText('Superficie corrente: Tabellone');
    const returnButton = banner.getByRole('button', { name: 'Torna a Rivedi', exact: true });
    const closeButton = banner.getByRole('button', { name: 'Chiudi', exact: true });
    await assertTouchSafe(returnButton);
    await assertTouchSafe(closeButton);
    await assertNotObscuredByFixedControls(page, returnButton);
    await assertNoHorizontalOverflow(page);
    await page.screenshot({ path: evidencePath('flow-04-mobile-tabellone.png'), fullPage: true });

    await returnButton.click();
    const returnedReview = page.getByRole('region', { name: `Rivedi la classe ${CLASS_NAME}` });
    await expect(returnedReview).toBeVisible();
    await assertReviewRouterTouchSafe(returnedReview);
    await assertNoHorizontalOverflow(page);

    expect(pageErrors).toEqual([]);
  });
});
