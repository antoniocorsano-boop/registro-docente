const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const evidenceDir = path.resolve(process.env.EVIDENCE_DIR || '../browser-evidence');

test.use({
  viewport: { width: 1280, height: 900 },
  trace: 'retain-on-failure'
});

test('exact candidate serves a usable Registro Docente production shell', async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });

  const pageErrors = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error instanceof Error ? error.message : String(error));
  });

  let result = 'FAIL';
  let status = null;
  let title = '';
  let rootTextLength = 0;

  try {
    const response = await page.goto(baseURL, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000
    });

    expect(response, 'navigation must return an HTTP response').not.toBeNull();
    status = response.status();
    expect(status).toBe(200);

    await expect(page).toHaveTitle(/Registro Docente/i);
    title = await page.title();

    const root = page.locator('#root');
    await expect(root).toBeVisible();
    await expect
      .poll(async () => (await root.innerText()).trim().length, {
        message: '#root must contain rendered application content',
        timeout: 15_000
      })
      .toBeGreaterThan(0);

    rootTextLength = (await root.innerText()).trim().length;
    expect(pageErrors, 'page must not emit uncaught JavaScript errors').toEqual([]);
    result = 'PASS';
  } finally {
    try {
      await page.screenshot({
        path: path.join(evidenceDir, 'home.png'),
        fullPage: true
      });
    } catch (error) {
      fs.writeFileSync(
        path.join(evidenceDir, 'screenshot-error.txt'),
        `${error instanceof Error ? error.stack || error.message : String(error)}\n`
      );
    }

    fs.writeFileSync(
      path.join(evidenceDir, 'qualification.json'),
      JSON.stringify(
        {
          candidateSha: process.env.CANDIDATE_SHA || null,
          result,
          baseURL,
          status,
          title,
          rootTextLength,
          pageErrors
        },
        null,
        2
      ) + '\n'
    );
  }
});
