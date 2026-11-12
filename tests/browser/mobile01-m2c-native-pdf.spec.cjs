const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:4173';

test.setTimeout(120000);
test('M2c actual Analisi report renders offline and requires verified native receipt', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const origin = new URL(baseURL).origin;
  const external = [];
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith('data:') || url.startsWith('blob:') || new URL(url).origin === origin) return route.continue();
    external.push(url);
    return route.abort();
  });
  await page.addInitScript(() => {
    window.__pdf = { choose: 0, write: 0, cancel: false, wrongReceipt: false, valid: false, bytes: 0, filename: '', reportText: false, tableText: false, maskedRows: false, pageCount: false };
    window.Capacitor = { getPlatform: () => 'android', Plugins: { RegistroPdfFiles: {
      choosePdfDestination: async options => {
        window.__pdf.choose++;
        window.__pdf.filename = options.filename;
        if (Object.keys(options).join(',') !== 'filename') throw Error('unexpected picker arguments');
        return window.__pdf.cancel ? { status: 'cancelled' } : { status: 'selected', token: 'pdf-token' };
      },
      writePdf: async options => {
        window.__pdf.write++;
        if (options.token !== 'pdf-token') throw Error('invalid token');
        const bytes = Uint8Array.from(atob(options.pdfBase64), c => c.charCodeAt(0));
        window.__pdf.bytes = bytes.length;
        window.__pdf.lastBase64 = options.pdfBase64;
        window.__pdf.valid = new TextDecoder().decode(bytes.slice(0,5)) === '%PDF-';
        const pdfText = new TextDecoder('windows-1252').decode(bytes);
        window.__pdf.reportText = pdfText.includes('Prospetto di lavoro docente');
        window.__pdf.tableText = pdfText.includes('Cognome e Nome') && pdfText.includes('Indicatore');
        window.__pdf.maskedRows = pdfText.includes('••••');
        window.__pdf.pageCount = pdfText.includes('Pagina 1 di ');
        const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2,'0')).join('');
        return { status: 'verified', bytes: bytes.length, sha256: window.__pdf.wrongReceipt ? 'bad' : sha256 };
      }
    } } };
    window.print = () => { throw Error('native export must not fall back to browser print'); };
  });
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await page.locator('#vault-password').fill('synthetic-m2c-only');
  await page.getByRole('button', { name: 'Configura archivio protetto' }).click();
  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();
  const unicodeNames = ['Łukasz Nowak', 'Иван Петров'];
  page.once('dialog', d => d.accept('Classe sintetica PDF Unicode'));
  await page.getByRole('button', { name: /Nuova Classe/ }).click();
  await expect(page.getByRole('heading', { name: 'Gestione Elenco Alunni: Classe sintetica PDF Unicode' })).toBeVisible();
  const privacy = page.getByTestId('header01-privacy');
  await privacy.click();
  for (const name of unicodeNames) {
    await page.getByPlaceholder('Cognome e Nome (es. Rossi Maria)').fill(name);
    await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
    const confirmation = page.getByRole('heading', { name: 'Dati Salvati in Locale con Successo!' });
    if (await confirmation.isVisible().catch(() => false)) await page.getByRole('button', { name: 'Chiudi', exact: true }).click();
    await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  }
  await privacy.click();
  await page.getByRole('button', { name: 'Analisi', exact: true }).filter({ visible: true }).first().click();
  const template = page.locator('#official-pdf-report');
  await expect(template).toBeAttached();
  expect(await template.textContent()).toContain('••••');
  const button = page.getByRole('button', { name: 'Esporta PDF di lavoro', exact: true });
  await expect(button).toBeVisible();

  // Dismissing the explicit confidentiality warning must not start the picker.
  const declined = page.waitForEvent('dialog');
  const declineClick = button.click();
  const warning = await declined;
  expect(warning.message()).toContain('non cifrato');
  await warning.dismiss();
  await declineClick;
  expect(await page.evaluate(() => window.__pdf.choose)).toBe(0);

  const messages = [];
  const handler = async d => { messages.push(d.message()); await d.accept(); };
  page.on('dialog', handler);
  await page.evaluate(() => { window.__pdf.cancel = true; });
  await button.click();
  await expect(button).toBeEnabled();
  expect(await page.evaluate(() => window.__pdf.write)).toBe(0);
  await page.evaluate(() => { window.__pdf.cancel = false; window.__pdf.wrongReceipt = true; });
  await button.click();
  await expect(button).toBeEnabled();
  expect(messages.some(m => m.includes('PDF non salvato o non verificato'))).toBe(true);
  await page.evaluate(() => { window.__pdf.wrongReceipt = false; });
  await button.click();
  await expect(button).toBeEnabled();
  const result = await page.evaluate(() => window.__pdf);
  expect(result.choose).toBe(3);
  expect(result.write).toBe(2);
  expect(result.valid).toBe(true);
  expect(result.bytes).toBeGreaterThan(1000);
  expect(result.reportText).toBe(true);
  expect(result.tableText).toBe(true);
  expect(result.maskedRows).toBe(true);
  expect(result.pageCount).toBe(true);
  expect(result.filename).toMatch(/^Prospetto_Lavoro_\d{4}-\d{2}-\d{2}\.pdf$/);
  expect(messages.some(m => m.includes('PDF di lavoro salvato e verificato'))).toBe(true);
  const maskedPdf = execFileSync('pdftotext', ['-layout', '-', '-'], { input: Buffer.from(result.lastBase64, 'base64'), encoding: 'utf8' });
  for (const name of unicodeNames) expect(maskedPdf).not.toContain(name);
  await privacy.click();
  for (const name of unicodeNames) expect(await template.textContent()).toContain(name);
  await button.click();
  await expect(button).toBeEnabled();
  const unicodeResult = await page.evaluate(() => window.__pdf);
  expect(unicodeResult.choose).toBe(4);
  expect(unicodeResult.write).toBe(3);
  const unicodePdf = execFileSync('pdftotext', ['-layout', '-', '-'], { input: Buffer.from(unicodeResult.lastBase64, 'base64'), encoding: 'utf8' });
  for (const name of unicodeNames) expect(unicodePdf).toContain(name);
  expect(unicodePdf).toContain('Prospetto di lavoro docente');
  expect(external).toEqual([]);
  page.off('dialog', handler);
});
