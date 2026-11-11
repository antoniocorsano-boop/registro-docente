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
  const vendor = await request.get(baseURL + '/vendor/html2pdf.bundle.min.js');
  expect(vendor.status()).toBe(200);
  expect(vendor.headers()['content-type']).toMatch(/javascript/);

  const result = await page.evaluate(async () => {
    if (typeof window.html2pdf !== 'function') return { loaded: false };
    const doc = document.createElement('div');
    doc.id = 'synthetic-offline-pdf-proof';
    doc.style.cssText = 'background:white;color:black;font:16px system-ui;padding:20px;width:400px';
    doc.textContent = 'Documento sintetico di Tecnologia — prova PDF senza rete';
    document.body.append(doc);
    try {
      const data = await window.html2pdf().set({
        margin: 5,
        html2canvas: { scale: 1 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(doc).toPdf().outputPdf('arraybuffer');
      const bytes = new Uint8Array(data);
      return { loaded: true, header: Array.from(bytes.slice(0, 5)), bytes: bytes.byteLength };
    } finally {
      doc.remove();
    }
  });
  expect(result.loaded).toBe(true);
  expect(result.header).toEqual([37, 80, 68, 70, 45]); // %PDF-
  expect(result.bytes).toBeGreaterThan(1000);
  expect(blocked).toEqual([]);
});
