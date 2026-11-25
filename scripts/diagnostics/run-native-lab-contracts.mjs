// Canonical Node contract entrypoint shared by F2, Q4 preflight and CI-FAST.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
const tests=[
  'scripts/diagnostics/native-process-probe.test.mjs',
  'scripts/diagnostics/native-ui-driver.test.mjs',
  'scripts/diagnostics/native-saf-lifecycle-probe.test.mjs',
  'scripts/diagnostics/native-lab-runtime.test.mjs'
];
if(Number(process.versions.node.split('.')[0])!==22)throw Error('NATIVE_LAB_REQUIRES_NODE_22');
execFileSync(process.execPath,['--check',resolve(root,'scripts/diagnostics/ap02-native-device-v7.mjs')],{cwd:root,stdio:'inherit'});
execFileSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit'});
console.log('NATIVE_LAB_CONTRACTS_PASS',tests.length);
