import { isAndroidBackupRuntime } from './androidBackupExport';

export const ANDROID_PDF_MAX_BYTES = 32 * 1024 * 1024;

type PdfPlugin = {
  choosePdfDestination(options: { filename: string }): Promise<unknown>;
  writePdf(options: { token: string; pdfBase64: string }): Promise<unknown>;
};
export type AndroidPdfRuntime = {
  androidBridge?: unknown;
  Capacitor?: { getPlatform?: () => string; Plugins?: { RegistroPdfFiles?: PdfPlugin } };
};
const runtimeDefault = () => globalThis as unknown as AndroidPdfRuntime;
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Risposta PDF non valida.');
  return value as Record<string, unknown>;
}

export async function saveWorkPdfOnAndroid(
  buffer: ArrayBuffer, filename: string, isActive: () => boolean,
  runtime = runtimeDefault()
): Promise<'verified' | 'cancelled'> {
  if (!isAndroidBackupRuntime(runtime as Parameters<typeof isAndroidBackupRuntime>[0])) throw new Error('Android non disponibile.');
  const plugin = runtime.Capacitor?.Plugins?.RegistroPdfFiles;
  if (!plugin || typeof plugin.choosePdfDestination !== 'function' || typeof plugin.writePdf !== 'function') {
    throw new Error('Salvataggio PDF non disponibile.');
  }
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 5 || bytes.length > ANDROID_PDF_MAX_BYTES
    || new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') throw new Error('Documento PDF non valido.');
  if (!/^Prospetto_Lavoro_[0-9]{4}-[0-9]{2}-[0-9]{2}\.pdf$/.test(filename)) throw new Error('Nome PDF non valido.');
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), v => v.toString(16).padStart(2, '0')).join('');
  if (!isActive()) return 'cancelled';
  // The picker never receives PDF content; activity recreation cannot resume a write.
  const selection = record(await plugin.choosePdfDestination({ filename }));
  if (selection.status === 'cancelled' || !isActive()) return 'cancelled';
  if (selection.status !== 'selected' || typeof selection.token !== 'string' || !selection.token) throw new Error('Destinazione PDF non valida.');
  let binary = '';
  for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  const receipt = record(await plugin.writePdf({ token: selection.token, pdfBase64: btoa(binary) }));
  if (receipt.status !== 'verified' || receipt.bytes !== bytes.length || receipt.sha256 !== sha256) throw new Error('PDF non verificato.');
  return isActive() ? 'verified' : 'cancelled';
}
