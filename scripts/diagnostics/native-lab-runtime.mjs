// QA-STABILITY-01/Q2 — laboratory-only timing and failure contracts.
// No product state, DOM text, command arguments or credentials are persisted.
import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

const categories = Object.freeze({
  OBSERVATION_DEADLINE: 'INDETERMINATE',
  COMMAND_DEADLINE: 'INDETERMINATE',
  CDP_TIMEOUT: 'INDETERMINATE',
  CDP_DISCONNECTED: 'INFRASTRUCTURE',
  CDP_SOCKET_ERROR: 'INFRASTRUCTURE',
  CDP_SOCKET_TIMEOUT: 'INFRASTRUCTURE',
  CDP_SEND_FAILED: 'INFRASTRUCTURE',
  CDP_EVALUATION_REJECTED: 'INDETERMINATE',
  ADB_TRANSPORT_TIMEOUT: 'INFRASTRUCTURE',
  NATIVE_UI_TREE_UNAVAILABLE: 'INDETERMINATE',
  ASSERTION_FAILED: 'INDETERMINATE',
  INVALID_HARNESS_ARGUMENT: 'HARNESS',
  UNKNOWN_FAILURE: 'INDETERMINATE',
  NATIVE_V7_EXPORT_REJECTED_BEFORE_SAF: 'INDETERMINATE',
  NATIVE_V7_EXPORT_FORM_REJECTED: 'INDETERMINATE',
  NATIVE_V7_VAULT_LOCKED_BEFORE_SAF: 'INDETERMINATE',
  NATIVE_V7_EXPORT_STILL_IN_PROGRESS: 'INDETERMINATE',
  NATIVE_V7_SAF_MISSING_FOREGROUND: 'INDETERMINATE',
  NATIVE_V7_SAF_NOT_OBSERVED_OFF_FOREGROUND: 'INDETERMINATE',
  CLASS_PROMPT_ALREADY_PENDING: 'INDETERMINATE',
  LAB_V7_SIZE_UNAVAILABLE: 'INDETERMINATE',
  LAB_V7_SIZE_MISMATCH: 'INDETERMINATE',
  NATIVE_V7_PHYSICAL_READ_UNAVAILABLE: 'INDETERMINATE',
  NATIVE_V7_ENVELOPE_INVALID_JSON: 'INDETERMINATE',
  NATIVE_V7_PHYSICAL_READ_UNAVAILABLE_AFTER_RETRY: 'INDETERMINATE',
  MISSING_INPUT: 'INDETERMINATE',
  MISSING_CONTROL: 'INDETERMINATE',
  NAV_NOT_UNIQUE: 'INDETERMINATE',
  HOME_CONFIRM_DIALOG_MISSING: 'INDETERMINATE',
  HOME_CONFIRM_NOT_UNIQUE: 'INDETERMINATE',
  SYNTHETIC_PROFILE_INPUT_MISSING: 'INDETERMINATE',
});
export class LabFailure extends Error {
  constructor(code) {
    super(Object.hasOwn(categories, code) ? code : 'UNKNOWN_FAILURE');
    this.name = 'LabFailure';
    this.code = this.message;
  }
}
export function classifyFailure(error) {
  let code = 'UNKNOWN_FAILURE';
  const message = typeof error?.message === 'string' ? error.message : '';
  if (error instanceof LabFailure && Object.hasOwn(categories,error.code)) code = error.code;
  else if (error?.code === 'ERR_ASSERTION') code = 'ASSERTION_FAILED';
  else if (error?.code === 'ETIMEDOUT' && error?.syscall === 'spawnSync adb') code = 'ADB_TRANSPORT_TIMEOUT';
  else if (message.startsWith('CONDITION_TIMEOUT:')) code = 'OBSERVATION_DEADLINE';
  else if (message.startsWith('CDP_EVALUATION_REJECTED:')) code = 'CDP_EVALUATION_REJECTED';
  else if (message.startsWith('CDP_TIMEOUT:') || message === 'DOM_WAIT_TIMEOUT') code = 'CDP_TIMEOUT';
  else if (Object.hasOwn(categories, message)) code = message;
  return { category: categories[code] || 'INDETERMINATE', code };
}
const scope = new AsyncLocalStorage();
// Unsolicited CDP dialog events have their own command deadline. They must
// not inherit the expired context of the WebSocket connection handshake.
export function withoutObservationScope(fn) { return scope.exit(fn); }
export function commandBudget(maxMs, now = performance.now.bind(performance)) {
  if (!Number.isFinite(maxMs) || maxMs <= 0) throw new LabFailure('INVALID_HARNESS_ARGUMENT');
  const deadline = scope.getStore();
  const remaining = deadline ? Math.min(maxMs, deadline.end - deadline.now()) : maxMs;
  if (remaining < 1) throw new LabFailure('COMMAND_DEADLINE');
  return Math.floor(remaining);
}
// This loop never races or abandons an active callback. Each callback must
// perform only observation, or use the non-retrying transition path below.
// The caller must bound every I/O operation with commandBudget.
export async function observeUntil(read, {
  timeoutMs, intervalMs = 350, retryReadErrors = false,
  now = performance.now.bind(performance), sleep = delay,
} = {}) {
  if (typeof read !== 'function' || !Number.isFinite(timeoutMs) || timeoutMs <= 0 ||
      !Number.isFinite(intervalMs) || intervalMs <= 0) throw new LabFailure('INVALID_HARNESS_ARGUMENT');
  const parent = scope.getStore();
  const clock = parent?.now || now;
  const end = Math.min(parent?.end ?? Infinity, clock() + timeoutMs);
  let attempts = 0, transientErrors = 0, lastCode = null;
  return scope.run({ end, now: clock }, async () => {
    while (clock() < end) {
      attempts++;
      let value;
      try { value = await read(); }
      catch (error) {
        const failure = classifyFailure(error);
        // Only these explicitly recognized observation failures can be sampled
        // again. Callers containing taps/submits/reauth must disable retry.
        if (!retryReadErrors || !['CDP_TIMEOUT','NATIVE_UI_TREE_UNAVAILABLE'].includes(failure.code)) throw error;
        transientErrors++;
        lastCode = failure.code;
      }
      if (clock() >= end) break;
      if (value) return value;
      await sleep(Math.min(intervalMs, end - clock()));
    }
    const error = new LabFailure('OBSERVATION_DEADLINE');
    error.observation = { attempts, transientErrors, lastCode };
    throw error;
  });
}
// One timer and one settlement per command; no automatic resend (the outcome
// of a mutation may be unknown). A closed channel rejects all pending commands.
export function createPendingCommands({ setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const pending = new Map();
  let seq = 0, closed = false;
  function settle(id, error, value) {
    const item = pending.get(id);
    if (!item) return false;
    pending.delete(id);
    clearTimer(item.timer);
    if (error) item.reject(error); else item.resolve(value);
    return true;
  }
  return {
    request(transmit, maxMs) {
      if (closed) return Promise.reject(new LabFailure('CDP_DISCONNECTED'));
      let ms;
      try { ms = commandBudget(maxMs); } catch (error) { return Promise.reject(error); }
      return new Promise((resolve, reject) => {
        const id = ++seq;
        const item = { resolve, reject, timer: null };
        pending.set(id, item);
        item.timer = setTimer(() => settle(id, new LabFailure('CDP_TIMEOUT')), ms);
        try { transmit(id); }
        catch { settle(id, new LabFailure('CDP_SEND_FAILED')); }
      });
    },
    settle,
    close() {
      closed = true;
      for (const id of pending.keys()) settle(id, new LabFailure('CDP_DISCONNECTED'));
    },
    get size() { return pending.size; },
  };
}
