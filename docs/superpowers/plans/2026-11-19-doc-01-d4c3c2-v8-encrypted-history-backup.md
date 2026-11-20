# DOC-01/D4c3c2 — Versioned V8 encrypted backup and lossless recovery policy

Date: 2026-11-19. Laboratory only. Parent exact SHA: `4282db877c171907064d96205080fba4c374a825` (qualified PR #373). No production wiring.

## Teacher scenario and decision
A teacher has confirmed a disciplinary document and later corrected or revoked it. A future device backup must preserve the complete chronology, without erasing recorded assessments, class data, planning, council evidence or the ten encrypted datasets. The teacher must explicitly approve any future physical restore. This increment is internal and intentionally adds no UI; the product-quality and UX-GOV requirements remain unchanged.

## Architecture
- Preserve V6/V7 write and restore eligibility and their DOC-01 downgrade fence; the V6 reader now explicitly rejects the V8 version label before the unchanged reserved-domain guard, solely to provide an unambiguous unsupported-version diagnostic.
- Version the **plaintext data payload** explicitly as V8; preserve the existing backup **envelope V2** (AES-GCM/PBKDF2).
- An explicit top-level `snapshot.appData.documentHistoryV1` is compulsory for V8. Do not synthesize missing history; no nested/alias placements.
- Reuse V7's strict validation of all ten datasets, approved assessment scopes, canonical planning, council and portable settings; validate DOC-01 event chain separately with independently approved document scopes.
- No portable `verifiedBackupAt` or `verifiedBackupEvidence`; no export/import of secrets, getters or unsupported JSON values.
- Pure restore preparation requires independently inspected V8 incoming and current recovery copy, current chain as unchanged prefix of incoming, and unchanged existing assessment revisions and frozen links. A checkpoint is logically exact, not physical readback.
- Existing physical DB2 and native Android recovery need their own later RED/GREEN, exact SHA, explicit single-use consent, physical encrypted readback and process-restart tests before activation.

## Exact RED → GREEN
1. Branch before write at the parent exact SHA; add invariant and 12 fixed synthetic tests against intentionally unimplemented isolated API.
2. Verify causal RED in GitHub Actions: only the new invariant's tests fail with `DOC01_D4C3C2_NOT_IMPLEMENTED`, inherited qualification remains green.
3. Implement V8 codec and pure restore policy without weakening tests or changing historic downgrade fence.
4. Verify GREEN on exact SHA, including Bun TypeScript/build, security regression, encryption roundtrip, browser and Android packaging probes; record observed outcomes without preclaiming PASS.
5. Keep PR as draft; no merge, deployment, real student records, production backup or restore.

## Non-authorities
A V8 codec is not a physical recoverable backup unless the exported encrypted bytes are durably written and read back; a matching logical checkpoint is not a signed immutable recovery artifact. Hashes are not signatures. Independent review and explicit promotion remain distinct gates.
