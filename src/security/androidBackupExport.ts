/**
 * MOBILE-01/M2a: a native Android file receipt is different from a browser download.
 * Capacitor 8.6 injects the registered plugin methods into window.Capacitor.Plugins.
 * Do not add a web implementation or fall back to anchor downloads in the native app.
 */
export const ANDROID_BACKUP_MAX_BYTES = 32 * 1024 * 1024;

type NativeBackupPlugin = {
  chooseBackupDestination(options: { filename: string }): Promise<unknown>;
  writeEncryptedBackup(options: { token: string; encryptedText: string }): Promise<unknown>;
};

export type AndroidBackupRuntime = {
  androidBridge?: unknown;
  Capacitor?: {
    getPlatform?: () => string;
    Plugins?: { RegistroBackupFiles?: NativeBackupPlugin };
  };
};

const currentRuntime = () => globalThis as unknown as AndroidBackupRuntime;

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
  if (!isActive()) return 'cancelled';

  // No ciphertext in the picker call: Android may retain activity options during process recreation.
  const selection = record(await plugin.chooseBackupDestination({ filename }));
  if (selection.status === 'cancelled' || !isActive()) return 'cancelled';
  if (selection.status !== 'selected' || typeof selection.token !== 'string' || !selection.token) {
    throw new Error('Destinazione del backup non confermata.');
  }

  const receipt = record(await plugin.writeEncryptedBackup({ token: selection.token, encryptedText }));
  if (receipt.status !== 'verified' || receipt.bytes !== bytes.length || receipt.sha256 !== expectedSha256) {
    throw new Error('La copia Android non ha superato la verifica di rilettura.');
  }
  return isActive() ? 'verified' : 'cancelled';
}
