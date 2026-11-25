// F2-DIAG-04 — bounded, privacy-safe ADB transport evidence for the Android lab.
// Never retain command arguments, shell output, class names, filenames,
// passwords, URIs, archive bytes or raw WebView / activity text.
const STAGES = new Set([
  'picker-returned','activity-probe-stopped','lock-wait-start','lock-present',
  'lock-ui-ready','password-field-entered','unlock-requested','unlocked'
]);

export function classifyAdbCommand(args) {
  if (!Array.isArray(args)) return 'other-adb';
  const [command, subcommand, target] = args;
  if (command === 'get-state') return 'transport-state';
  if (command === 'forward') return 'webview-forward';
  if (command === 'install') return 'lab-install';
  if (command === 'exec-out') return 'physical-file-read';
  if (command !== 'shell') return 'other-adb';
  if (subcommand === 'dumpsys' && target === 'activity') return 'activity-state';
  if (subcommand === 'uiautomator' && target === 'dump') return 'native-ui-dump';
  if (subcommand === 'input') return 'native-input';
  if (subcommand === 'am') return 'activity-command';
  if (subcommand === 'getprop') return 'device-property';
  if (subcommand === 'cat') return 'native-file-read';
  if (['rm','ls','stat','test','mv'].includes(subcommand)) return 'file-operation';
  return 'other-shell';
}

export function createAdbTransportTrace({now = Date.now, maxCalls = 32} = {}) {
  const startedAt = now();
  const calls = [];
  const milestones = [];
  let totalCalls = 0;
  const max = Number.isInteger(maxCalls) && maxCalls >= 1 && maxCalls <= 64 ? maxCalls : 32;
  return {
    record(args, callStarted, result, budget=null) {
      totalCalls++;
      const elapsedMs = Math.max(0, Math.round(now() - callStarted));
      calls.push({
        kind: classifyAdbCommand(args),
        elapsedMs,
        result: result === 'timeout' ? 'timeout' : result === 'ok' ? 'ok' : 'failed',
        ...(budget&&Number.isInteger(budget.timeoutMs)&&budget.timeoutMs>0&&budget.timeoutMs<=30000&&
          ['command','observation'].includes(budget.limitedBy)?
          {budgetMs:budget.timeoutMs,limitedBy:budget.limitedBy}:{})
      });
      if (calls.length > max) calls.shift();
    },
    mark(stage) {
      if (!STAGES.has(stage)) return;
      milestones.push({stage, elapsedMs:Math.max(0,Math.round(now()-startedAt))});
      if (milestones.length > 16) milestones.shift();
    },
    snapshot() {
      return {
        schemaVersion:1, syntheticOnly:true, rawOutputStored:false,
        totalCalls, omittedCalls:Math.max(0,totalCalls-calls.length),
        calls:calls.map(x=>({...x})), milestones:milestones.map(x=>({...x}))
      };
    }
  };
}
