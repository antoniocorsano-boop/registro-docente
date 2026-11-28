const { test, expect } = require('@playwright/test');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';

test('MOBILE-01/M1 renders a real PDF from locally bundled assets with outside network blocked', async ({ page, request }) => {
  const blocked = [];
  const origin = new URL(baseURL).origin;
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
    if (new URL(url).origin === origin) return route.continue();
    blocked.push(url);
    return route.abort();
  });
  const loaded = await page.goto(baseURL, { waitUntil: 'load' });
  expect(loaded.status()).toBe(200);
  const vendor = await request.get(baseURL + '/vendor/jspdf.umd.min.js');
  expect(vendor.status()).toBe(200);
  expect(vendor.headers()['content-type']).toMatch(/javascript/);

  const result = await page.evaluate(async () => {
    const Constructor = window.jspdf?.jsPDF;
    if (typeof Constructor !== 'function') return { loaded: false };
    const doc = new Constructor({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: false });
    const synthetic = 'Documento sintetico di Tecnologia';
    doc.text(synthetic, 15, 20);
    const bytes = new Uint8Array(doc.output('arraybuffer'));
    return { loaded: true, version: Constructor.version,
      text: new TextDecoder().decode(bytes).includes(synthetic),
      header: Array.from(bytes.slice(0, 5)), bytes: bytes.byteLength };
  });
  expect(result.loaded).toBe(true);
  expect(result.version).toBe('4.2.1');
  expect(result.text).toBe(true);
  expect(result.header).toEqual([37, 80, 68, 70, 45]); // %PDF-
  expect(result.bytes).toBeGreaterThan(1000);
  expect(blocked).toEqual([]);
});
