// F2-DIAG-05 — classifies only public, non-sensitive Android Home UI signals.
// This code never accepts screen text, class names, passwords or DOM snapshots.
const signals = ['locked','confirmationVisible','todayHeadingVisible','classHeadingVisible',
  'newClassButtonVisible','brandInteractive','documentVisible'];

export function classifyHomeNavigationFrame(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'unavailable';
  const f = Object.fromEntries(signals.map(k => [k, raw[k] === true]));
  // A stale protected DOM must not authorize authentication or confirmation.
  if (!f.documentVisible) return 'background';
  if (raw.gateError === true) return 'gate-error';
  if (f.locked) return raw.lockReady === false ? 'protected' : 'locked';
  if (raw.protectedSurface === true) return 'protected';
  if (f.confirmationVisible) return 'confirmation';
  if (f.documentVisible && f.todayHeadingVisible && f.classHeadingVisible &&
      f.newClassButtonVisible && f.brandInteractive) return 'home-ready';
  if (!f.todayHeadingVisible) return 'other-view';
  return 'home-not-interactive';
}

export function safeHomeNavigationReport(samples, lastFrame) {
  const allowed = new Set(['unavailable','locked','confirmation','home-ready',
    'background','protected','gate-error','other-view','home-not-interactive']);
  const events = (Array.isArray(samples) ? samples : []).slice(-16).map(x => ({
    stage: allowed.has(x?.stage) ? x.stage : 'unavailable',
    elapsedMs: Number.isFinite(x?.elapsedMs) ?
      Math.max(0,Math.round(x.elapsedMs)) : 0
  }));
  return {schemaVersion:1, syntheticOnly:true, rawDomStored:false,
    lastStage:classifyHomeNavigationFrame(lastFrame),
    transitions:events};
}
