import { describe, expect, test } from 'bun:test';
import { saveWorkPdfOnAndroid, type AndroidPdfRuntime } from './androidPdfExport';

const filename = 'Prospetto_Lavoro_2026-11-12.pdf';
// Synthetic signature for boundary tests; the browser test renders the real report.
const buffer = new TextEncoder().encode('%PDF-1.4\nsynthetic test').buffer;
async function verified(data: ArrayBuffer = buffer) {
  return { status: 'verified', bytes: data.byteLength, sha256: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), b => b.toString(16).padStart(2, '0')).join('') };
}
function runtime(choose: (o: {filename: string}) => Promise<unknown>, write: (o: {token: string; pdfBase64: string}) => Promise<unknown>): AndroidPdfRuntime {
  return { androidBridge: {}, Capacitor: { getPlatform: () => 'android', Plugins: { RegistroPdfFiles: { choosePdfDestination: choose, writePdf: write } } } };
}
describe('MOBILE-01/M2c Android PDF receipt', () => {
  test('picker receives only a neutral filename and writer receives exact bytes', async () => {
    const result = await saveWorkPdfOnAndroid(buffer, filename, () => true, runtime(async o => {
      expect(o).toEqual({ filename });
      return { status: 'selected', token: 'pdf-token' };
    }, async o => {
      expect(o.token).toBe('pdf-token');
      expect(Uint8Array.from(atob(o.pdfBase64), c => c.charCodeAt(0))).toEqual(new Uint8Array(buffer));
      return verified();
    }));
    expect(result).toBe('verified');
  });
  test('cancel or changed context never starts a write or confirms a stale result', async () => {
    let writes = 0;
    const write = async () => { writes++; return verified(); };
    expect(await saveWorkPdfOnAndroid(buffer, filename, () => true, runtime(async () => ({ status: 'cancelled' }), write))).toBe('cancelled');
    let active = true;
    expect(await saveWorkPdfOnAndroid(buffer, filename, () => active, runtime(async () => {
      active = false; return { status: 'selected', token: 'x' };
    }, write))).toBe('cancelled');
    expect(writes).toBe(0);
    active = true;
    expect(await saveWorkPdfOnAndroid(buffer, filename, () => active, runtime(async () => ({ status: 'selected', token: 'x' }), async () => {
      active = false; return verified();
    }))).toBe('cancelled');
  });
  test('missing bridge, invalid filename, non-PDF or incorrect receipt fail closed', async () => {
    await expect(saveWorkPdfOnAndroid(buffer, filename, () => true, { androidBridge: {} })).rejects.toThrow();
    const r = runtime(async () => ({ status: 'selected', token: 'x' }), async () => ({ status: 'verified', bytes: buffer.byteLength, sha256: 'wrong' }));
    await expect(saveWorkPdfOnAndroid(buffer, filename, () => true, r)).rejects.toThrow();
    await expect(saveWorkPdfOnAndroid(buffer, '../private.pdf', () => true, r)).rejects.toThrow();
    await expect(saveWorkPdfOnAndroid(new TextEncoder().encode('not PDF').buffer, filename, () => true, r)).rejects.toThrow();
  });
});

test('formative PDF uses only the explicit neutral filename and the same verified local receipt', async()=>{
  const r=runtime(async o=>{expect(o.filename).toBe('Bilancio_Formativo_2026-11-13.pdf');return {status:'selected',token:'pdf-token'};},async()=>verified());
  expect(await saveWorkPdfOnAndroid(buffer,'Bilancio_Formativo_2026-11-13.pdf',()=>true,r)).toBe('verified');
  await expect(saveWorkPdfOnAndroid(buffer,'Bilancio_Formativo_Persona_Fittizia.pdf',()=>true,r)).rejects.toThrow();
});
