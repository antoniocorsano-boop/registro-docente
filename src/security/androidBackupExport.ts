import { awaitAndroidFileAccess, type AndroidFileAccess } from './androidSessionLifecycle';
/**
 * MOBILE-01/M2a: a native Android file receipt is different from a browser download.
 * Capacitor 8.6 injects the registered plugin methods into window.Capacitor.Plugins.
 * Do not add a web implementation or fall back to anchor downloads in the native app.
 */
export const ANDROID_BACKUP_MAX_BYTES = 32 * 1024 * 1024;

type NativeBackupPlugin = {
  chooseBackupDestination(options: { filename: string }): Promise<unknown>;
  writeEncryptedBackup(options: { token: string; encryptedText: string }): Promise<unknown>;
  chooseBackupSource?: (options: Record<string, never>) => Promise<unknown>;
  readEncryptedBackup?: (options: { token: string }) => Promise<unknown>;
};

export type AndroidBackupRuntime = {
  /** Explicit dependency for isolated bridge tests; never used by the real runtime. */
  sessionAccess?: AndroidFileAccess;
  androidBridge?: unknown;
  Capacitor?: {
    getPlatform?: () => string;
    Plugins?: { RegistroBackupFiles?: NativeBackupPlugin };
  };
};

const currentRuntime = () => globalThis as unknown as AndroidBackupRuntime;
function sessionAccess(runtime: AndroidBackupRuntime, isActive: () => boolean): Promise<boolean> {
  if (!isActive()) return Promise.resolve(false);
  if (runtime === globalThis as unknown) return awaitAndroidFileAccess(isActive);
  if (!runtime.sessionAccess) throw new Error('Autorità di sessione non disponibile.');
  return runtime.sessionAccess(isActive);
}

export function isAndroidBackupRuntime(runtime = currentRuntime()): boolean {
  return Boolean(runtime.androidBridge) || runtime.Capacitor?.getPlatform?.() === 'android';
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Risposta non valida dal salvataggio Android.');
  }
  return value as Record<string, unknown>;
}

export async function saveEncryptedBackupOnAndroid(
  encryptedText: string,
  filename: string,
  isActive: () => boolean = () => true,
  runtime = currentRuntime(),
): Promise<'verified' | 'cancelled'> {
  if (!isAndroidBackupRuntime(runtime)) throw new Error('Salvataggio Android non disponibile.');
  const plugin = runtime.Capacitor?.Plugins?.RegistroBackupFiles;
  if (typeof plugin?.chooseBackupDestination !== 'function' || typeof plugin?.writeEncryptedBackup !== 'function') {
    throw new Error('Il salvataggio protetto non è disponibile in questa versione Android.');
  }

  // Only the encrypted envelope (never its password or plaintext snapshot) may cross the bridge.
  const bytes = new TextEncoder().encode(encryptedText);
  if (bytes.length === 0 || bytes.length > ANDROID_BACKUP_MAX_BYTES) {
    throw new Error('La copia cifrata supera il limite di salvataggio Android di 32 MB.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const expectedSha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (!await sessionAccess(runtime, isActive)) return 'cancelled';

  // No ciphertext in the picker call: Android may retain activity options during process recreation.
  const selection = record(await plugin.chooseBackupDestination({ filename }));
  if (selection.status === 'cancelled' || !await sessionAccess(runtime, isActive)) return 'cancelled';
  if (selection.status !== 'selected' || typeof selection.token !== 'string' || !selection.token) {
    throw new Error('Destinazione del backup non confermata.');
  }

  const receipt = record(await plugin.writeEncryptedBackup({ token: selection.token, encryptedText }));
  if (receipt.status !== 'verified' || receipt.bytes !== bytes.length || receipt.sha256 !== expectedSha256) {
    throw new Error('La copia Android non ha superato la verifica di rilettura.');
  }
  return await sessionAccess(runtime, isActive) ? 'verified' : 'cancelled';
}

/** Only a local encrypted document is returned. Authentication stays in cryptoUtils. */
export async function readEncryptedBackupOnAndroid(
  isActive: () => boolean = () => true,
  runtime = currentRuntime(),
): Promise<string | null> {
  if (!isAndroidBackupRuntime(runtime)) throw new Error('Lettura Android non disponibile.');
  const plugin = runtime.Capacitor?.Plugins?.RegistroBackupFiles;
  if (typeof plugin?.chooseBackupSource !== 'function' || typeof plugin?.readEncryptedBackup !== 'function') {
    throw new Error('Il recupero protetto non è disponibile in questa versione Android.');
  }
  if (!await sessionAccess(runtime, isActive)) return null;
  const selection = record(await plugin.chooseBackupSource({}));
  if (selection.status === 'cancelled' || !await sessionAccess(runtime, isActive)) return null;
  if (selection.status !== 'selected' || typeof selection.token !== 'string' || !selection.token) {
    throw new Error('File di backup non selezionato.');
  }
  const result = record(await plugin.readEncryptedBackup({ token: selection.token }));
  if (!await sessionAccess(runtime, isActive)) return null;
  if (result.status !== 'read' || typeof result.encryptedText !== 'string') {
    throw new Error('Lettura del backup non verificata.');
  }
  const bytes = new TextEncoder().encode(result.encryptedText);
  if (!bytes.length || bytes.length > ANDROID_BACKUP_MAX_BYTES || result.bytes !== bytes.length) {
    throw new Error('Dimensione del backup non valida.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const sha = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('');
  if (result.sha256 !== sha) throw new Error('Integrità della lettura non verificata.');
  return await sessionAccess(runtime, isActive) ? result.encryptedText : null;
}
