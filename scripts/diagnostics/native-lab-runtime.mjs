// QA-STABILITY-01/Q2 — laboratory-only timing and failure contracts.
// No product state, DOM text, command arguments or credentials are persisted.
import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

const appiumBootstrapMethods = new Map([
  ['create-session', 'POST'],
  ['get-native-context', 'GET'],
]);
const webdriverBootstrapCodes = new Set([
  'session not created', 'invalid session id', 'unknown error', 'timeout',
  'unsupported operation', 'unknown command', 'invalid argument',
  'unknown method', 'no such driver',
]);

// Report only closed vocabularies and numeric observations. Never record the
// URL, capabilities, session id, context value, response body or exceptions.
export async function observeAppiumBootstrap({operation, send, validate, record, now = () => performance.now()}) {
  const method = appiumBootstrapMethods.get(operation);
  if (!method) throw new LabFailure('INVALID_HARNESS_ARGUMENT');
  const started = now();
  let httpStatus = null;
  let webdriverCode = null;
  let outcome = 'transport-failed';
  try {
    const response = await send(method);
    httpStatus = response.status;
    outcome = 'invalid-json';
    const payload = await response.json();
    if (payload?.value?.error) {
      const code = payload.value.error;
      webdriverCode = webdriverBootstrapCodes.has(code) ? code : 'unrecognized';
    }
    if (!response.ok || webdriverCode !== null) {
      outcome = 'rejected';
      throw new LabFailure('NATIVE_UI_READ_FAILED');
    }
    outcome = 'invalid-value';
    const value = payload.value;
    validate(value);
    outcome = 'accepted';
    return value;
  } finally {
    record({operation, method, httpStatus, webdriverCode, outcome, durationMs: Math.max(0, Math.round(now() - started))});
  }
}

export const failureCategories=Object.freeze(['INFRASTRUCTURE','HARNESS','PRODUCT','INDETERMINATE']);
// PRODUCT is reserved for independently established evidence, never inferred from a timeout.
const categories = Object.freeze({
  OBSERVATION_DEADLINE: 'INDETERMINATE',
  COMMAND_DEADLINE: 'INDETERMINATE',
  CDP_TIMEOUT: 'INDETERMINATE',
  CDP_DISCONNECTED: 'INFRASTRUCTURE',
  CDP_SOCKET_ERROR: 'INFRASTRUCTURE',
  CDP_SOCKET_TIMEOUT: 'INFRASTRUCTURE',
  CDP_SEND_FAILED: 'INFRASTRUCTURE',
  CDP_EVALUATION_REJECTED: 'INDETERMINATE',
  BUTTON_MATCH_COUNT_0: 'INDETERMINATE',
  BUTTON_MATCH_COUNT_2: 'INDETERMINATE',
  BUTTON_MATCH_COUNT_3: 'INDETERMINATE',
  NEW_CLASS_MISSING: 'INDETERMINATE',
  AMBIGUOUS_BUTTON: 'INDETERMINATE',
  CDP_REFERENCE_ERROR: 'INDETERMINATE',
  CDP_TYPE_ERROR: 'INDETERMINATE',
  CDP_INVALID_STATE_ERROR: 'INDETERMINATE',
  ADB_TRANSPORT_TIMEOUT: 'INFRASTRUCTURE',
  ADB_TRANSPORT_OFFLINE: 'INFRASTRUCTURE',
  PREFLIGHT_BOOT_UNREADY: 'INFRASTRUCTURE',
  PREFLIGHT_PACKAGE_SERVICE_PENDING: 'INFRASTRUCTURE',
  PREFLIGHT_VERSION_INCOMPLETE: 'INDETERMINATE',
  PREFLIGHT_WRONG_API: 'INFRASTRUCTURE',
  PREFLIGHT_PACKAGE_UNAVAILABLE: 'INDETERMINATE',
  PREFLIGHT_CDP_TARGET_AMBIGUOUS: 'INDETERMINATE',
  PREFLIGHT_CDP_HANDOFF_UNSTABLE: 'INDETERMINATE',
  PUBLIC_GATE_ERROR: 'INDETERMINATE',
  PUBLIC_RELOCK_AFTER_AUTH: 'INDETERMINATE',
  CDP_DIALOG_OUTCOME_UNKNOWN: 'INDETERMINATE',
  RECOVERY_CONSENT_INVALID: 'INDETERMINATE',
  PROCESS_STOP_DEADLINE: 'INDETERMINATE',
  V7_FIRST_FILE_NOT_UNIQUE: 'INDETERMINATE',
  V7_SECOND_DISTINCT_DOCUMENT_MISSING: 'INDETERMINATE',
  INVALID_LAB_V7_FILE_LIST: 'HARNESS',
  INVALID_LAB_V7_FILE_NAME: 'HARNESS',
  NATIVE_UI_TREE_UNAVAILABLE: 'INDETERMINATE',
  NATIVE_UI_READ_FAILED: 'INDETERMINATE',
  NATIVE_UI_DUMP_FAILED: 'INDETERMINATE',
  NATIVE_UI_PERMISSION_DENIED: 'INDETERMINATE',
  NATIVE_UI_FOREGROUND_LOST: 'INDETERMINATE',
  NATIVE_V7_SAF_OBSERVED_UI_UNAVAILABLE: 'INDETERMINATE',
  CLASS_CREATION_CONTROL_CHANGED: 'INDETERMINATE',
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
// Preserve only a closed set of legacy control errors. Parse the first line,
// never copy arbitrary exception text, stack frames or CDP error payloads.
const evaluationCodes = new Set([
  'BUTTON_MATCH_COUNT_0','BUTTON_MATCH_COUNT_2','BUTTON_MATCH_COUNT_3',
  'NEW_CLASS_MISSING','AMBIGUOUS_BUTTON','NAV_NOT_UNIQUE',
  'MISSING_CONTROL','MISSING_INPUT','SYNTHETIC_PROFILE_INPUT_MISSING',
  'HOME_CONFIRM_DIALOG_MISSING','HOME_CONFIRM_NOT_UNIQUE',
]);
export function cdpEvaluationFailure(detail) {
  if (typeof detail !== 'string') return new LabFailure('CDP_EVALUATION_REJECTED');
  const first = detail.split(/\r?\n/,1)[0];
  const token = first.startsWith('Error: ') ? first.slice(7) : first;
  if (evaluationCodes.has(token)) return new LabFailure(token);
  if (/^ReferenceError(?::|$)/.test(first)) return new LabFailure('CDP_REFERENCE_ERROR');
  if (/^TypeError(?::|$)/.test(first)) return new LabFailure('CDP_TYPE_ERROR');
  if (/^InvalidStateError(?::|$)/.test(first)) return new LabFailure('CDP_INVALID_STATE_ERROR');
  return new LabFailure('CDP_EVALUATION_REJECTED');
}
export function classifyFailure(error) {
  let code = 'UNKNOWN_FAILURE';
  const message = typeof error?.message === 'string' ? error.message : '';
  if (error instanceof LabFailure && Object.hasOwn(categories,error.code)) code = error.code;
  else if (error?.code === 'ERR_ASSERTION') code = 'ASSERTION_FAILED';
  else if (error?.code === 'ETIMEDOUT' && error?.syscall === 'spawnSync adb') code = 'ADB_TRANSPORT_TIMEOUT';
  else if (message.startsWith('CONDITION_TIMEOUT:')) code = 'OBSERVATION_DEADLINE';
  else if (message.startsWith('CDP_EVALUATION_REJECTED:')) code = cdpEvaluationFailure(message.slice('CDP_EVALUATION_REJECTED:'.length)).code;
  else if (message.startsWith('CDP_TIMEOUT:') || message === 'DOM_WAIT_TIMEOUT') code = 'CDP_TIMEOUT';
  else if (message === 'Process still present or absence not verified after force-stop') code = 'PROCESS_STOP_DEADLINE';
  else if (Object.hasOwn(categories, message)) code = message;
  return { category: categories[code] || 'INDETERMINATE', code };
}
export function normalizeAdbFailure(error) {
  if(error instanceof LabFailure)return error;
  if(error?.code==='ETIMEDOUT')return new LabFailure('ADB_TRANSPORT_TIMEOUT');
  if(/(?:^|\n)(?:adb: )?(?:error: )?(?:device offline|device not found|no devices\/emulators found|device '[^'\n]+' not found)(?:\r?\n|$)/i.test(String(error?.stderr??'')))
    return new LabFailure('ADB_TRANSPORT_OFFLINE');
  return error;
}
const scope = new AsyncLocalStorage();
// Unsolicited CDP dialog events have their own command deadline. They must
// not inherit the expired context of the WebSocket connection handshake.
export function withoutObservationScope(fn) { return scope.exit(fn); }
// Read the effective parent-capped deadline, without starting a second clock.
export function remainingObservationMs(){
  const deadline=scope.getStore();
  return deadline?Math.max(0,deadline.end-deadline.now()):Infinity;
}
export function commandBudgetInfo(maxMs, now = performance.now.bind(performance)) {
  if (!Number.isFinite(maxMs) || maxMs <= 0) throw new LabFailure('INVALID_HARNESS_ARGUMENT');
  const deadline = scope.getStore();
  const outerRemaining = deadline ? deadline.end - deadline.now() : Infinity;
  const remaining = Math.min(maxMs,outerRemaining);
  if (remaining < 1) throw new LabFailure('COMMAND_DEADLINE');
  return {timeoutMs:Math.floor(remaining),limitedBy:outerRemaining<=maxMs?'observation':'command'};
}
export function commandBudget(maxMs, now = performance.now.bind(performance)) {
  return commandBudgetInfo(maxMs,now).timeoutMs;
}
// A truncated ADB allowance expiring is not affirmative evidence of an
// independent transport failure. Preserve that distinction for every command.
export function classifyAdbDeadline(error,budget){
  if(error?.code==='ETIMEDOUT'&&budget?.limitedBy==='observation')
    return new LabFailure('COMMAND_DEADLINE');
  return normalizeAdbFailure(error);
}
export async function withinDeadline(run,{timeoutMs,now=performance.now.bind(performance),timeoutCode='COMMAND_DEADLINE'}={}){
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new LabFailure('INVALID_HARNESS_ARGUMENT');
  const parent=scope.getStore(),clock=parent?.now||now;
  const end=Math.min(parent?.end??Infinity,clock()+timeoutMs);
  return scope.run({end,now:clock},async()=>{
    if(clock()>=end)throw new LabFailure(timeoutCode);
    const value=await run();
    if(clock()>=end)throw new LabFailure(timeoutCode);
    return value;
  });
}
export async function bestEffortDiagnostic(read){
  try{return await withoutObservationScope(()=>withinDeadline(read,{timeoutMs:5000}));}
  catch{return null;}
}
export function isTransportOrDeadline(error){
  const f=classifyFailure(error);
  return f.category==='INFRASTRUCTURE'||['COMMAND_DEADLINE','OBSERVATION_DEADLINE','CDP_TIMEOUT'].includes(f.code);
}
// This loop never races or abandons an active callback. Each callback must
// perform only observation, or use the non-retrying transition path below.
// The caller must bound every I/O operation with commandBudget.
export async function observeUntil(read, {
  timeoutMs, intervalMs = 350, retryReadErrors = false,
  now = performance.now.bind(performance), sleep = delay, retryCodes = ['CDP_TIMEOUT','NATIVE_UI_TREE_UNAVAILABLE'],
} = {}) {
  if (typeof read !== 'function' || !Number.isFinite(timeoutMs) || timeoutMs <= 0 ||
      !Number.isFinite(intervalMs) || intervalMs <= 0) throw new LabFailure('INVALID_HARNESS_ARGUMENT');
  const parent = scope.getStore();
  const clock = parent?.now || now;
  const end = Math.min(parent?.end ?? Infinity, clock() + timeoutMs);
  let attempts = 0, transientErrors = 0, lastCode = null;
  return scope.run({ end, now: clock }, async () => {
    // No command may start with a fractional residual budget that commandBudget rejects.
    while (end - clock() >= 1) {
      attempts++;
      let value;
      try { value = await read(); }
      catch (error) {
        const failure = classifyFailure(error);
        // Only these explicitly recognized observation failures can be sampled
        // again. Callers containing taps/submits/reauth must disable retry.
        if (!retryReadErrors || !retryCodes.includes(failure.code)) throw error;
        transientErrors++;
        lastCode = failure.code;
      }
      if (clock() >= end) break;
      if (value) return value;
      const remaining=end-clock();
      if(remaining<1)break;
      await sleep(Math.min(intervalMs, remaining));
    }
    const error = new LabFailure('OBSERVATION_DEADLINE');
    error.observation = { attempts, transientErrors, lastCode };
    throw error;
  });
}
// One timer and one settlement per command; no automatic resend (the outcome
// of a mutation may be unknown). A closed channel rejects all pending commands.
export function createPendingCommands({ setTimer = setTimeout, clearTimer = clearTimeout, now = performance.now.bind(performance) } = {}) {
  const pending = new Map();
  let seq = 0, closed = false;
  function settle(id, error, value) {
    const item = pending.get(id);
    if (!item) return false;
    pending.delete(id);
    clearTimer(item.timer);
    if(!error&&item.clock()>=item.deadline)error=new LabFailure('CDP_TIMEOUT');
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
        const clock=scope.getStore()?.now||now;
        const item = { resolve, reject, timer: null, clock, deadline:clock()+ms };
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

export function createDialogTracker(){
  const pending=new Set();
  let requested=0,acknowledged=0,failure=null;
  function check(){if(failure)throw failure;}
  return {
    track(sendOnce,onAck=()=>{}){
      check();requested++;
      const task=Promise.resolve().then(sendOnce).then(()=>{acknowledged++;onAck();})
        .catch(()=>{failure ||= new LabFailure('CDP_DIALOG_OUTCOME_UNKNOWN');});
      pending.add(task);void task.then(()=>pending.delete(task));
    },
    check,
    async flush(){while(pending.size)await Promise.all([...pending]);check();},
    snapshot(){return {requested,acknowledged,pending:pending.size,failed:failure!==null};},
  };
}

// AP02 V7: retain the exact public consent dialog instead of automatically
// opening the second picker while the driver is still observing the first
// authenticated return. No dialog text or credential is retained here.
export const V7_RECOVERY_CONSENT='Ripristino V7: è necessaria una copia cifrata ESATTA dello stato attuale, già conservata su un supporto separato. Dopo la conferma scegli il file di recupero. Continuare?';
export function createRecoveryConsentGate(){
  let state='idle',submitted=false,acknowledged=false,observed=false,invalid=false;
  const check=()=>{if(invalid)throw new LabFailure('RECOVERY_CONSENT_INVALID');};
  const ready=()=>{check();return state==='armed'&&submitted&&acknowledged&&observed;};
  return {
    arm(){if(state!=='idle')throw new LabFailure('RECOVERY_CONSENT_INVALID');state='armed';},
    startSubmit(){check();if(state!=='armed'||submitted)throw new LabFailure('RECOVERY_CONSENT_INVALID');submitted=true;},
    acknowledgeSubmit(){check();if(!submitted||acknowledged||state!=='armed')throw new LabFailure('RECOVERY_CONSENT_INVALID');acknowledged=true;},
    capture(kind,message){
      if(state!=='armed'&&state!=='sending')return false;
      if(state!=='armed'||!submitted||observed||kind!=='confirm'||message!==V7_RECOVERY_CONSENT)invalid=true;
      else observed=true;
      return true; // hold even unexpected dialogs; never automatically accept
    },
    ready,
    async accept(sendOnce){
      if(!ready())throw new LabFailure('RECOVERY_CONSENT_INVALID');
      state='sending';
      try{await sendOnce();check();state='accepted';}
      catch(error){state='failed';throw error;}
    },
    snapshot(){return {state,submitted,acknowledged,observed,invalid};}
  };
}

const val01ObservationIds = new Map([
  ['Native WebView unavailable', 'NATIVE_WEBVIEW_UNAVAILABLE'],
  ['Native fixture missing', 'NATIVE_FIXTURE_MISSING'],
  ['Native picker not visible', 'PICKER_NOT_VISIBLE'],
  ['Native picker roots missing', 'PICKER_ROOTS_MISSING'],
  ['Downloads root missing', 'DOWNLOADS_ROOT_MISSING'],
  ['Picker did not return', 'PICKER_NO_RETURN'],
  ['Native picker operation did not settle', 'PICKER_NOT_SETTLED'],
  ['Native Save missing', 'SAVE_MISSING'],
  ['Exact encrypted filename missing', 'EXACT_ENCRYPTED_FILENAME_MISSING'],
  ['File selection did not complete', 'FILE_SELECTION_INCOMPLETE'],
  ['Native Open missing', 'OPEN_MISSING'],
  ['V8 picker did not return', 'V8_PICKER_NO_RETURN'],
  ['V8 picker did not settle', 'V8_PICKER_NOT_SETTLED'],
  ['Native V8 Save missing', 'V8_SAVE_MISSING'],
  ['Native V8 file missing', 'V8_FILE_MISSING'],
  ['Native V8 selected file did not return', 'V8_FILE_NO_RETURN'],
  ['Native V8 Open missing', 'V8_OPEN_MISSING'],
  ['DocumentsUI not active', 'DOCUMENTS_UI_NOT_ACTIVE'],
  ['Picker remains open', 'PICKER_REMAINS_OPEN'],
]);
const allowedVal01ObservationIds = new Set([...val01ObservationIds.values(), 'UNCLASSIFIED_OBSERVATION']);
export function val01ObservationId(label) {
  return val01ObservationIds.get(label) ?? 'UNCLASSIFIED_OBSERVATION';
}
export function sanitizedVal01ObservationId(id) {
  return allowedVal01ObservationIds.has(id) ? id : null;
}
