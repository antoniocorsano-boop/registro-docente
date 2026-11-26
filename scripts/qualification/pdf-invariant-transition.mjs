// Single documented migration, not a general relaxation of published invariants.
// The retired asset identities, replacement identities, semantic change and
// executable evidence are fixed; all other published semantics remain immutable.
const ID = "MOBILE-01-M1-I01";
const OWNER = "MOBILE-01/M1";
const OLD_STATEMENT = "PDF generation is fully local at runtime with the exact previously used html2pdf.js 0.10.1 bundle and license notices pinned to their upstream Git blob identities, with index.html depending only on same-origin script and device fonts and Chromium demonstrating real PDF bytes without outside network access. This does not qualify Android file export, encrypted backup or version updates.";
const NEW_STATEMENT = "PDF generation is fully local at runtime with official jsPDF 4.2.1 UMD and its license pinned to upstream Git blob identities, without the historical html2pdf 0.10.1 bundle. Same-origin assets and fonts; Chromium must demonstrate real selectable-text PDF bytes without outside network access. This does not qualify Android file export, encrypted backup or version updates.";
const REPLACEMENT = "CAND-PROD-01-R1-TEC-01-I01";
const OLD_ASSETS = {
  "public/vendor/html2pdf.bundle.min.js": "c57dc9292239c50312222b91f45613b5cb93518c",
  "public/vendor/html2pdf.bundle.min.js.LICENSE.txt": "7cc52ed18f3e7f0e8b62ae003872b5031ea80635"
};
const NEW_ASSETS = {
  "public/vendor/jspdf.umd.min.js": "0e600d49d2b2bf81dd97c1509e22d108c2ddd3b4",
  "public/vendor/jspdf.LICENSE.txt": "dc7d3a9fa305defebad6cb88ba4cd9776f26fcd3"
};
const REQUIRED_TESTS = ["src/security/mobile01M1OfflineAssetsContract.test.ts","src/security/mobile01M2cNativePdfContract.test.ts","src/security/formativePdfContract.test.ts","src/security/mobile01AndroidProbeContract.test.ts","src/security/outboundBoundaryClosure.test.ts","src/security/outboundEmbeddingGuard.test.ts","src/security/r1EmbeddingSession.test.ts","scripts/diagnostics/appium-pilot/contract.test.mjs"];
const REQUIRED_BROWSER = ["tests/browser/mobile01-m1-offline-pdf.spec.cjs","tests/browser/mobile01-m2c-native-pdf.spec.cjs"];

export function isExactPdfInvariantTransition(published, candidate, registry, blobAt) {
  if (published.id !== ID || candidate.id !== ID || published.owner !== OWNER ||
      candidate.owner !== OWNER || published.statement !== OLD_STATEMENT ||
      candidate.statement !== NEW_STATEMENT) return false;
  const successor = registry.invariants.find(i => i.id === REPLACEMENT);
  if (!successor || successor.owner !== 'CAND-PROD-01/R1-TEC-01' ||
      !REQUIRED_TESTS.every(p => successor.tests?.includes(p)) ||
      !REQUIRED_BROWSER.every(p => successor.browserSmoke?.includes(p))) return false;
  for (const [p, sha] of Object.entries(OLD_ASSETS)) {
    if (blobAt('base', p) !== sha || blobAt('candidate', p) !== null) return false;
  }
  for (const [p, sha] of Object.entries(NEW_ASSETS)) {
    if (blobAt('candidate', p) !== sha) return false;
  }
  return true;
}
