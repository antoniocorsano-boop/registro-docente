const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test, expect } = require('@playwright/test');

test('CR06 qualifies archive reservation recovery on real browser storage', async ({ browser }) => {
  test.setTimeout(120_000);
  const origin = 'http://127.0.0.1';
  const script = readFileSync(join(__dirname, 'beta-close-cr06.fixture.mjs'));
  for (let index = 0; index < 16; index++) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.route(origin + '/cr06', route => route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Synthetic CR06</title>',
      }));
      await page.route(origin + '/cr06.mjs', route => route.fulfill({
        contentType: 'text/javascript',
        body: script,
      }));
      await page.goto(origin + '/cr06');
      const result = await page.evaluate(async index => {
        const cases = await import('/cr06.mjs');
        return { count: cases.names.length, outcome: await cases.run(index) };
      }, index);
      expect(result.count).toBe(16);
      expect(result.outcome.pass, result.outcome.name + ': ' + result.outcome.error).toBe(true);
    } finally {
      await context.close();
    }
  }
});
