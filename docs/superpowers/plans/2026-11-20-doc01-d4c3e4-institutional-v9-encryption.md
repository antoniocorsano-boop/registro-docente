# DOC-01/D4c3e4 — encrypted institutional archive v9, logical only
Date 2026-11-20. Exact base: PR #380 `e28b076759e3f47bb7f96c9058078ee0e32a591e` (the previous native & browser checks were nearing completion). No merge, no deployment, no personal data.

## Decision
V9 is a *new explicit* logical backup data version for DocumentHistoryV2; it uses the existing AES-256-GCM / PBKDF2 encrypted backup envelope **version 2**. Do not confuse envelope version 2 with plaintext backup data version 9 or institutional document schemaVersion 2.

The only supported initial mode is a professional, school-scoped archive with a valid institution-specific DocumentHistoryV2 and no legacy synthetic DocumentHistoryV1. V1 belongs exclusively to V8; there is **no automatic migration** or silent removal of V1 history. Until a separately approved migration exists, V9 refuses coexistence of V1 and V2. V6/V7/V8 must refuse the V2 reserved marker both in their writers and in readers. Strong size-bounded, descriptor-only data copying prevents nested aliases, getter execution and dropped unsupported data.

## Gate
1. Serialize the 10 existing datasets through qualified V7 assessment codec, after explicitly peeling only the V2 domain in appData; reattach a V2 history already validated against **independently supplied** institutional scope and event hashes. Reject missing, forged, unexpected or unapproved document data.
2. Inspect a plaintext V9 payload by strict root/version check, V7 inspection of the residual 10 datasets, and separate V2 validation. No authority is inferred from the backup file.
3. Encrypted export and import reuse the *existing* password-protected authenticated ciphertext envelope unchanged; never claim the ability to restore physically based on a successful decrypt or logical preview.
4. Projection of V9 recovery requires independently accepted current, recovery and incoming school contexts, an exact historical recovery copy of the current snapshot, preservation of all previous V2 events in their original sequence, and the existing V7 *lossless assessment policy*. No hidden rebasing.
5. Record RED then GREEN with frozen unit tests; inherited V1/V8/Android gates remain untouched except the explicit anti-downgrade fence. Leave app/Privacy, DB2 and Android native code unmodified.

## Not an activation
V9 is qualified as a logical data and encrypted copy codec, not as a production saver or physical DB2 transaction. Production still owns a V1 Vault and student data flows require additional privacy and retention decisions. A later stage needs its own V9 CAS/DB2 recovery adapter, exact scope authorization, fresh epoch and restart verification before exposing a teacher workflow. Do not pretend a confirmed UI preview means a successful backup or restore.
