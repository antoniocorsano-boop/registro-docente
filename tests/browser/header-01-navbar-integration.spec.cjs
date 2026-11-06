const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const evidenceDir = path.resolve(process.env.HEADER01_EVIDENCE_DIR || '../browser-evidence');

function errorText(error) {
  return error instanceof Error ? error.stack || error.message : String(error);
}

// Exact-candidate, fail-closed evidence for each synthetic browser journey.
async function withEvidence(browser, viewport, caseId, action) {
  fs.mkdirSync(path.join(evidenceDir, 'screenshots'), { recursive: true });

  const pageErrors = [];
  const consoleErrors = [];
  const crashes = [];
  let context = null;
  let page = null;
  let failure = null;
  let screenshotError = null;
  let screenshot = null;
  let result = 'FAIL';

  try {
    context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 500,
      hasTouch: viewport.width < 500,
      deviceScaleFactor: 1,
    });
    page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(errorText(error)));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('crash', () => crashes.push('Chromium page crashed'));
    await action(page);
  } catch (error) {
    failure = error;
  }

  // Required screenshot precedes the FINAL pageerror assertion; a capture error is FAIL.
  if (page) {
    try {
      screenshot = path.join('screenshots', caseId + '.png');
      await page.screenshot({ path: path.join(evidenceDir, screenshot), fullPage: true });
    } catch (error) {
      screenshotError = errorText(error);
      screenshot = null;
      if (!failure) failure = error;
    }
  } else if (!failure) {
    failure = new Error('No browser page was created for ' + caseId);
  }

  // Include browser shutdown in the observed lifecycle before declaring PASS.
  try {
    if (context) await context.close();
  } catch (error) {
    if (!failure) failure = error;
  }

  try {
    expect(screenshot, 'A screenshot is mandatory for ' + caseId).not.toBeNull();
    expect(pageErrors, 'Uncaught browser pageerrors are forbidden for ' + caseId).toEqual([]);
    expect(crashes, 'Chromium crashes are forbidden for ' + caseId).toEqual([]);
    if (!failure) result = 'PASS';
  } catch (error) {
    if (!failure) failure = error;
  }

  // Even on failure, persist exact-SHA, errors and FAIL as an inspectable artifact.
  const evidence = {
    schema: 'registro.header01.browser-evidence/v1',
    candidateSha: process.env.CANDIDATE_SHA || null,
    caseId,
    viewport,
    baseURL: baseUrl,
    result,
    screenshot,
    screenshotError,
    pageErrors,
    consoleErrors,
    crashes,
    qualificationError: failure ? errorText(failure) : null,
  };
  fs.writeFileSync(
    path.join(evidenceDir, 'header01-' + caseId + '.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  if (failure) throw failure;
}



const baseUrl = process.env.HEADER01_BASE_URL || 'http://127.0.0.1:4173';
const url = baseUrl + '/tests/browser/fixtures/header01-navbar.html';

for (const width of [320, 390]) {
  test(`HEADER-01 real Navbar / ${width}px: one logo, one lock, no false saved status`, async ({ browser }) => {
    await withEvidence(browser, { width, height: width === 320 ? 700 : 844 }, `navbar-mobile-${width}`, async (page) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    const brand = page.getByTestId('header01-brand-navigation');
    const privacy = page.getByTestId('header01-privacy');
    const lock = page.getByTestId('header01-lock');
    await expect(page.getByTestId('header01-mobile-integration')).toBeVisible();
    await expect(brand).toBeVisible();
    await expect(privacy).toBeVisible();
    await expect(lock).toBeVisible();
    await expect(page.getByTestId('header01-context')).toContainText('Valutazioni');
    await expect(page.getByTestId('header01-context')).toContainText('Classe 3ª A');
    await expect(page.getByTestId('header01-save-notice')).toHaveCount(0);
    await expect(page.locator('.badge-ok:visible')).toHaveCount(0);
    await expect(page.locator('[aria-label="Imposta blocco automatico"]:visible')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Blocca Registro' })).toHaveCount(1);
    await expect(page.locator('[data-testid="header01-open-menu"]')).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, 420));
    await expect(brand).toBeInViewport();
    await page.evaluate(() => window.scrollTo(0, 0));

    const sizes = await page.evaluate(() => {
      const ids = ['header01-brand-navigation', 'header01-privacy', 'header01-lock'];
      return {
        scrollWidth: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
        rects: ids.map(id => {
          const { x, width, height, right } = document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect();
          return { x, width, height, right };
        }),
      };
    });
    expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.viewport + 1);
    for (const rect of sizes.rects) {
      expect(rect.width).toBeGreaterThanOrEqual(48);
      expect(rect.height).toBeGreaterThanOrEqual(48);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(width + 1);
    }

    await brand.click();
    await expect(page.getByTestId('header01-go-home')).toBeFocused();
    await expect(page.getByTestId('header01-integration-active-tab')).toHaveText('voti');
    await expect(page.getByTestId('header01-integration-home-visits')).toContainText('Visite Oggi: 0');
    await page.getByTestId('header01-auto-lock').focus();
    await page.getByTestId('header01-auto-lock').selectOption('30');
    await expect(page.getByTestId('header01-auto-lock')).toBeFocused();
    await expect(page.getByTestId('header01-integration-auto-lock')).toContainText('30 minuti');

    await page.keyboard.press('Escape');
    await expect(brand).toBeFocused();
    await brand.click();
    await page.getByTestId('header01-go-home').click();
    await expect(page.getByTestId('header01-home-confirm')).toBeVisible();
    await expect(page.getByTestId('header01-integration-active-tab')).toHaveText('voti');
    await page.getByRole('button', { name: 'Rimani qui' }).click();
    await expect(page.getByTestId('header01-home-confirm')).toHaveCount(0);
    await expect(brand).toBeFocused();
    await expect(page.getByTestId('header01-integration-home-visits')).toContainText('Visite Oggi: 0');

    await brand.click();
    await page.getByTestId('header01-go-home').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('header01-home-confirm')).toHaveCount(0);
    await expect(brand).toBeFocused();
    await expect(page.getByTestId('header01-integration-active-tab')).toHaveText('voti');

    await brand.click();
    await page.getByTestId('header01-go-home').click();
    await page.getByRole('button', { name: 'Torna a Oggi' }).click();
    await expect(page.getByTestId('header01-integration-active-tab')).toHaveText('home');
    await expect(page.getByTestId('header01-integration-home-visits')).toContainText('Visite Oggi: 1');

    await privacy.click();
    await expect(privacy).toHaveAttribute('aria-pressed', 'false');
    await lock.click();
    await expect(page.getByTestId('header01-integration-lock-count')).toContainText('Blocchi: 1');
    });
  });
}

test('HEADER-01 real Navbar desktop keeps existing specialist navigation and Vault controls', async ({ browser }) => {
  await withEvidence(browser, { width: 1280, height: 900 }, 'navbar-desktop-1280', async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('header01-mobile-integration')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Imposta blocco automatico' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Blocca Registro' })).toHaveCount(1);
  await expect(page.getByText('Tabellone', { exact: true }).first()).toBeVisible();
  });
});

test('HEADER-01 real Navbar: keyboard remains usable and lock reachable with focused editor', async ({ browser }) => {
  await withEvidence(browser, { width: 390, height: 844 }, 'navbar-keyboard-390', async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Campo di prova tastiera' }).focus();
  await expect(page.getByTestId('header01-privacy')).toBeVisible();
  await expect(page.getByTestId('header01-lock')).toBeVisible();
  });
});
