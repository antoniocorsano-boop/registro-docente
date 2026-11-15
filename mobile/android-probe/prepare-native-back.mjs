// Configure the generated Android manifest for the supported platform Back API.
// Shared by all package variants; no manufacturer-specific behavior.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const manifest = fileURLToPath(new URL('./android/app/src/main/AndroidManifest.xml', import.meta.url));
const source = readFileSync(manifest, 'utf8');
if ((source.match(/<application\b/g) || []).length !== 1 ||
    /android:enableOnBackInvokedCallback\s*=/.test(source)) {
  throw new Error('Unexpected Android Back manifest configuration');
}
const next = source.replace(/<application\b/, '<application\n        android:enableOnBackInvokedCallback="true"');
writeFileSync(manifest, next);
