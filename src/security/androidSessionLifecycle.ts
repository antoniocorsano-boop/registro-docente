/** Android lifecycle authority. Native epoch changes cannot be inferred from timers. */
export const ANDROID_SESSION_EVENT = 'registro-session-change';
export interface AndroidSessionState {
  epoch: number;
  foreground: boolean;
}
type NativeSessionPlugin = {
  getState(): Promise<unknown>;
  authorize(input: { epoch: number }): Promise<unknown>;
  revoke(input: { epoch: number }): Promise<unknown>;
  acknowledgeShield(input: { epoch: number }): Promise<unknown>;
};
type AndroidSessionRuntime = {
  androidBridge?: unknown;
  Capacitor?: { getPlatform?: () => string; Plugins?: { RegistroSession?: NativeSessionPlugin } };
};
const runtime = () => globalThis as unknown as AndroidSessionRuntime;
export function isAndroidSessionRuntime(): boolean {
  const native = runtime();
  return Boolean(native.androidBridge) || native.Capacitor?.getPlatform?.() === 'android';
}
function bridge(): NativeSessionPlugin {
  const plugin = runtime().Capacitor?.Plugins?.RegistroSession;
  if (!plugin || typeof plugin.getState !== 'function' || typeof plugin.authorize !== 'function'
      || typeof plugin.revoke !== 'function' || typeof plugin.acknowledgeShield !== 'function') {
    throw new Error('Protezione della sessione Android non disponibile.');
  }
  return plugin;
}
export function validateAndroidSessionState(value: unknown): AndroidSessionState {
  if (!value || typeof value !== 'object') throw new Error('Stato della sessione Android non valido.');
  const state = value as Partial<AndroidSessionState>;
  if (!Number.isSafeInteger(state.epoch) || state.epoch! < 0 || typeof state.foreground !== 'boolean') {
    throw new Error('Stato della sessione Android non valido.');
  }
  return { epoch: state.epoch!, foreground: state.foreground };
}
export async function readAndroidSessionState(): Promise<AndroidSessionState | null> {
  return isAndroidSessionRuntime() ? validateAndroidSessionState(await bridge().getState()) : null;
}
export async function authorizeAndroidSession(epoch: number): Promise<void> {
  await bridge().authorize({ epoch });
}
export async function revokeAndroidSession(epoch: number): Promise<void> {
  await bridge().revoke({ epoch });
}
export async function acknowledgeAndroidShield(epoch: number): Promise<void> {
  await bridge().acknowledgeShield({ epoch });
}

/** Installed by the mounted Vault owner, not by a document chooser. */
export type AndroidFileAccess = (isActive: () => boolean) => Promise<boolean>;
let authority: AndroidFileAccess | null = null;
export function registerAndroidFileAccess(owner: AndroidFileAccess): () => void {
  authority = owner;
  return () => { if (authority === owner) authority = null; };
}
export async function awaitAndroidFileAccess(isActive: () => boolean): Promise<boolean> {
  if (!isActive()) return false;
  if (!authority) throw new Error('Sessione del Registro non disponibile.');
  return authority(isActive);
}
