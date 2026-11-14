// B4-only isolated laboratory package; no signing keys or app data migration.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./', import.meta.url));
const identity = Object.freeze({
  applicationId: 'it.trama.registrodocente.lab.b4',
  label: 'Registro Docente - Collaudo B4',
  versionCode: 10003,
  versionName: '0.1.0-b4-lab.1'
});

function replaceOnce(value, pattern, replacement) {
  if (!pattern.test(value)) throw new Error('Generated Android template changed: ' + pattern);
  return value.replace(pattern, replacement);
}
function edit(relative, transform) {
  const file = resolve(root, 'android', relative);
  writeFileSync(file, transform(readFileSync(file, 'utf8')));
}
edit('app/build.gradle', source => {
  let next = replaceOnce(source, /applicationId\s+"it\.trama\.registrodocente\.prova"/, 'applicationId "' + identity.applicationId + '"');
  next = replaceOnce(next, /versionCode\s+1\b/, 'versionCode ' + identity.versionCode);
  next = replaceOnce(next, /versionName\s+"1\.0"/, 'versionName "' + identity.versionName + '"');
  if (!/namespace\s*=\s*"it\.trama\.registrodocente\.prova"/.test(next)) throw new Error('Native namespace changed');
  if (/signingConfig\s+[a-zA-Z]/.test(next)) throw new Error('Unexpected signing config');
  return next;
});
edit('app/src/main/res/values/strings.xml', source => {
  let next = source;
  for (const name of ['app_name', 'title_activity_main']) {
    next = replaceOnce(next, new RegExp('<string name="' + name + '">[^<]*</string>'), '<string name="' + name + '">' + identity.label + '</string>');
  }
  for (const name of ['package_name', 'custom_url_scheme']) {
    next = replaceOnce(next, new RegExp('<string name="' + name + '">[^<]*</string>'), '<string name="' + name + '">' + identity.applicationId + '</string>');
  }
  return next;
});
edit('app/src/main/AndroidManifest.xml', source => {
  let next = replaceOnce(source, /android:allowBackup="true"/, 'android:allowBackup="false"\n        android:fullBackupContent="false"\n        android:dataExtractionRules="@xml/registro_no_data_transfer"');
  // An explicit native class keeps activity resolution independent of applicationId.
  next = replaceOnce(next, /android:name="\.MainActivity"/, 'android:name="it.trama.registrodocente.prova.MainActivity"');
  return next;
});
mkdirSync(resolve(root, 'android/app/src/main/res/xml'), { recursive: true });
writeFileSync(resolve(root, 'android/app/src/main/res/xml/registro_no_data_transfer.xml'), `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
    <exclude domain="device_root" path="." />
    <exclude domain="device_file" path="." />
    <exclude domain="device_database" path="." />
    <exclude domain="device_sharedpref" path="." />
  </cloud-backup>
  <device-transfer>
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
    <exclude domain="device_root" path="." />
    <exclude domain="device_file" path="." />
    <exclude domain="device_database" path="." />
    <exclude domain="device_sharedpref" path="." />
  </device-transfer>
</data-extraction-rules>
`);
edit('app/src/main/assets/capacitor.config.json', source => {
  const config = JSON.parse(source);
  if (config.appId !== 'it.trama.registrodocente.prova' || config.server?.url || config.loggingBehavior !== 'none') throw new Error('Unexpected native config');
  return JSON.stringify({ ...config, appId: identity.applicationId, appName: identity.label }, null, 2) + '\n';
});
console.log('B4 laboratory project prepared: ' + identity.applicationId + ' ' + identity.versionCode);
