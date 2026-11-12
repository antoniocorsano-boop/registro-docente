const { test, expect } = require('@playwright/test');

const URL = (process.env.DENSITY01_BASE_URL || 'http://127.0.0.1:4173') + '/tests/browser/fixtures/mobile-density-01-tabellone.html';

for (const width of [320, 390]) {
  test(`MOBILE-DENSITY-01 / ${width}px — compact 8/25 student rows and single disclosure`, async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width, height: width === 320 ? 700 : 844 },
      isMobile: true, hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    const rows = page.getByTestId('matrix-compact-row');
    const toggles = page.getByTestId('matrix-compact-toggle');
    await expect(rows).toHaveCount(8);
    await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(0);
    await expect(toggles.first()).toHaveAttribute('aria-expanded', 'false');

    const geometry = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="matrix-compact-list"]');
      const row = document.querySelector('[data-testid="matrix-compact-toggle"]');
      const box = row.getBoundingClientRect();
      return {
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        rowWidth: box.width,
        rowHeight: box.height,
        rowRight: box.right,
        listWidth: list.getBoundingClientRect().width,
      };
    });
    expect(geometry.rowHeight).toBeGreaterThanOrEqual(60);
    expect(geometry.rowHeight).toBeLessThanOrEqual(100);
    expect(geometry.rowRight).toBeLessThanOrEqual(width + 1);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(width + 1);

    await toggles.first().click();
    await expect(toggles.first()).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Apri scheda alunno' })).toHaveCount(1);
    await toggles.nth(1).click();
    await expect(toggles.first()).toHaveAttribute('aria-expanded', 'false');
    await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(1);

    await page.getByRole('button', { name: 'Apri scheda alunno' }).click();
    await expect(page.getByTestId('fixture-report')).toContainText('classe-test-a-student-2');

    await page.getByTestId('fixture-25').click();
    await expect(rows).toHaveCount(25);
    await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(1);
    await page.getByTestId('fixture-change-class').click();
    await expect(rows).toHaveCount(25);
    await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(0);
    await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'false');
    // A -> B -> A must not resurrect a previously expanded student's details.
    await page.getByTestId('fixture-change-class').click();
    await expect(page.locator('[data-testid="matrix-compact-detail"]:visible')).toHaveCount(0);
    await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'false');
    await context.close();
  });
}

test('MOBILE-DENSITY-01 — privacy never exposes synthetic names while protected, including open details', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  const mobileList = page.getByTestId('matrix-compact-list');
  await expect(mobileList.getByText('Persona Fittizia 01', { exact: true })).toHaveCount(0);
  await page.getByTestId('matrix-compact-toggle').first().click();
  await expect(mobileList.getByText('Persona Fittizia 01', { exact: true })).toHaveCount(0);
  await page.getByTestId('fixture-toggle-privacy').click();
  await expect(mobileList.getByText('Persona Fittizia 01', { exact: true })).toBeVisible();
  await page.getByTestId('fixture-toggle-privacy').click();
  await expect(mobileList.getByText('Persona Fittizia 01', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('matrix-compact-toggle').first()).toHaveAttribute('aria-expanded', 'true');
  const accessible = await page.getByTestId('matrix-compact-toggle').first().getAttribute('aria-label');
  expect(accessible).not.toContain('Persona Fittizia 01');
});

test('MOBILE-DENSITY-01 — mode, filter, support indicator and detailed report still work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('matrix-compact-toggle').first().click();
  await expect(page.getByRole('region', { name: 'Voti recenti' })).toBeVisible();
  await page.getByRole('button', { name: 'Per Tipologia' }).click();
  await expect(page.getByRole('region', { name: 'Medie per tipologia' })).toBeVisible();
  await page.getByRole('button', { name: 'Solo Medie & Fasce' }).click();
  await expect(page.getByRole('region', { name: 'Medie periodo' })).toBeVisible();
  await page.getByRole('button', { name: 'Indicatore media: VISIBILE' }).click();
  await expect(page.getByText('Indicatore', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tutti i Voti (Cronologico)' }).click();
  await page.getByRole('combobox').first().selectOption('Q1');
  await expect(page.getByRole('region', { name: 'Voti recenti' })).toBeVisible();
  await expect(page.getByText('Prova sintetica primo periodo')).toHaveCount(1);
  await expect(page.getByText('Prova sintetica secondo periodo')).toHaveCount(0);
});

test('MOBILE-DENSITY-01 — desktop retains full table, mobile compact list is hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('matrix-compact-list')).toBeHidden();
  await expect(page.getByRole('table').first()).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'MEDIA', exact: true })).toBeVisible();
});

test('MOBILE-DENSITY-01 — 200% text at 320px keeps touch target and detail accessible', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const row = page.getByTestId('matrix-compact-toggle').first();
  await expect(row).toBeVisible();
  const dims = await row.boundingBox();
  expect(dims.height).toBeGreaterThanOrEqual(60);
  expect(dims.x + dims.width).toBeLessThanOrEqual(321);
  await row.click();
  await expect(page.getByRole('button', { name: 'Apri scheda alunno' })).toBeVisible();
  await context.close();
});

for (const width of [320, 390]) {
  test(`MOBILE-DENSITY-02 / ${width}px — Analisi compact rows, single expansion and direct report`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    try {
      const page = await context.newPage();
      await page.goto(URL + '?view=analytics', { waitUntil: 'domcontentloaded' });
      const section = page.getByTestId('mobile-analytics-student-detail');
      await section.locator('summary').click();
      const rows = section.getByTestId('analytics-compact-row');
      const toggles = section.getByTestId('analytics-compact-toggle');
      const reports = section.getByTestId('analytics-compact-report');
      const details = section.locator('[data-testid="analytics-compact-detail"]:visible');
      await expect(rows).toHaveCount(8);
      await expect(details).toHaveCount(0);
      const box = await reports.first().boundingBox();
      const toggle = await toggles.first().boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(60);
      expect(box.height).toBeLessThanOrEqual(90);
      expect(toggle.width).toBeGreaterThanOrEqual(48);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await toggles.first().click();
      await expect(details).toHaveCount(1);
      await expect(rows.first().getByTestId('analytics-compact-q1')).toContainText('6');
      await expect(rows.first().getByTestId('analytics-compact-q2')).toContainText('5');
      await toggles.nth(1).click();
      await expect(toggles.first()).toHaveAttribute('aria-expanded', 'false');
      await expect(details).toHaveCount(1);
      await reports.nth(1).click();
      await expect(page.getByTestId('fixture-report')).toContainText('classe-test-a-student-2');
      await page.getByTestId('fixture-25').click();
      await expect(rows).toHaveCount(25);
      await page.getByTestId('fixture-change-class').click();
      await expect(section).not.toHaveAttribute('open', '');
      await expect(details).toHaveCount(0);
      await section.locator('summary').click();
      await expect(rows).toHaveCount(25);
      await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'false');
      await toggles.nth(1).click();
      await expect(details).toHaveCount(1);
      await page.getByTestId('fixture-change-class').click();
      await expect(section).not.toHaveAttribute('open', '');
      await expect(details).toHaveCount(0);
      await section.locator('summary').click();
      await expect(rows).toHaveCount(25);
      await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'false');
      await page.getByTestId('fixture-toggle-privacy').click();
      await section.getByPlaceholder('Cerca alunno').fill('Persona Fittizia 01');
      await expect(rows).toHaveCount(1);
      await toggles.first().click();
      await page.getByTestId('fixture-toggle-privacy').click();
      await expect(section.getByPlaceholder('Cerca alunno')).toHaveValue('');
      await expect(rows).toHaveCount(25);
      await expect(section.getByText('Persona Fittizia 01', { exact: true })).toHaveCount(0);
      expect(await reports.first().getAttribute('aria-label')).not.toContain('Persona Fittizia 01');
      expect(await toggles.first().getAttribute('aria-label')).not.toContain('Persona Fittizia 01');
      await section.getByRole('combobox').selectOption('average');
      await expect(rows).toHaveCount(25);
    } finally {
      await context.close();
    }
  });
}

test('MOBILE-DENSITY-02 — Analisi desktop keeps the existing full table', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(URL + '?view=analytics', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('mobile-analytics-student-detail')).toBeHidden();
  await expect(page.locator('table').filter({ hasText: 'MEDIA ANNO' })).toBeVisible();
});
