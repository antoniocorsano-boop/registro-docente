// F2-DIAG-03: non-sensitive Android activity-transition evidence, CI synthetic only.
// Never persist dumpsys lines, activity names, user documents or filesystem paths.
export function classifyResumedActivity(raw, appPackage) {
  if (typeof raw !== 'string' || typeof appPackage !== 'string') return 'unknown';
  const row = raw.split('\n').find(line => /\b(?:topResumedActivity|mResumedActivity)\b/.test(line));
  if (!row) return 'unknown';
  const component = row.match(/\b([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+)\/[A-Za-z0-9_.$]+/);
  if (!component) return 'unknown';
  const activePackage = component[1].toLowerCase();
  if (activePackage === appPackage.toLowerCase()) return 'application';
  if (activePackage.includes('documentsui')) return 'documentsui';
  return 'other';
}
export function summarizeSafActivityTrail(samples) {
  const observations = Array.isArray(samples) ? samples : [];
  const transitions = [];
  let firstPickerIndex = -1;
  let observedReturnToApp = false;
  for (let i = 0; i < observations.length; i++) {
    const entry = observations[i];
    if (entry.surface === 'documentsui' && firstPickerIndex < 0) firstPickerIndex = i;
    if (firstPickerIndex >= 0 && i > firstPickerIndex && entry.surface === 'application') observedReturnToApp = true;
    if (i === 0 || entry.surface !== observations[i - 1].surface) {
      transitions.push({ elapsedMs: entry.elapsedMs, surface: entry.surface });
    }
  }
  return {
    observationCount: observations.length,
    observedDocumentsUi: firstPickerIndex >= 0,
    observedReturnToAppAfterDocumentsUi: observedReturnToApp,
    firstDocumentsUiMs: firstPickerIndex < 0 ? null : observations[firstPickerIndex].elapsedMs,
    coverageMs: observations.length ? observations[observations.length - 1].elapsedMs : 0,
    transitions: transitions.slice(0, 32),
    omittedTransitions: Math.max(0, transitions.length - 32)
  };
}
export function startSafActivityProbe({ readActivityDump, appPackage, now = Date.now,
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)), maxSamples = 72 }) {
  const started = now();
  const observations = [];
  let active = true;
  const collecting = (async () => {
    while (active && observations.length < maxSamples) {
      let surface = 'unknown';
      try { surface = classifyResumedActivity(readActivityDump(), appPackage); }
      catch { /* A failed ADB probe is not evidence of a specific Activity. */ }
      observations.push({ elapsedMs: Math.max(0, now() - started), surface });
      if (active && observations.length < maxSamples) await pause(1400);
    }
  })();
  return {
    snapshot: () => summarizeSafActivityTrail(observations),
    stop: async () => { active = false; await collecting; return summarizeSafActivityTrail(observations); }
  };
}
