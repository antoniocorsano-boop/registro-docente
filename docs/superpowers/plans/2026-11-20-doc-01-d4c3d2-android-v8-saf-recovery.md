# DOC-01/D4c3d2 — Android SAF V8 physical recovery (synthetic laboratory)

Date: 2026-11-20. Parent exact SHA: `e56421e6422c3cfcfd19259bb1ff758efd190240` (DOC-01/D4c3d1, PR #375, 11/11).

## Professional requirement
After corrections or revocations in an educational document, a teacher needs a verified local backup, selection of recovery and target files, explicit consent to restore, and a reliable reopening without loss of assessments, grades or the document revision chain. The UI remains unchanged in this phase; the public application must not surface laboratory procedures.

## Reused architecture
- Physically persisted 10-record DB2 vault and a one-use, exact-generation encrypted V8 restore (DOC-01/D4c3d1).
- Existing Android document picker and native SAF writer/reader, foreground epoch authorization and session revocation (VAL-01/S6d.2c.4).
- Exact original append event and new revocation, separately approved DOC-01 scopes and independently validated assessment evidence.
- One existing synthetic APK, app ID `it.trama.registrodocente.lab.val01`, API 32 and 36 on isolated Android emulators. No release build, device data or external credentials.

## Frozen RED → GREEN
1. Create branch at exact qualified parent before mutations. Reserve native document-copy and restoration APIs with `DOC01_D4C3D2_NOT_IMPLEMENTED`; freeze new tests and exact native evidence stages.
2. Record causal RED on exact SHA: historical tests pass; new bridge and emulated V8 work fail only due to the missing reserved entrypoint.
3. Implement V8 native fixture on actual authenticated current DB2. First commit original DOC-01 event with encrypted readback, create two versioned AES-GCM V8 files via explicit independent scope validation and append-only revocation.
4. Through real Android SAF write and read back two distinct encrypted files; verify physical bytes with ADB/sha256, then select the actual files through Android DocumentsUI and independently verify byte size+digest. Cancellation must refuse preparation, with zero DB2 mutations.
5. Prepare DB2 V8 using exact current owner generation, approved scopes, selected immutable blobs and an abortable foreground-session grant. Explicit single-use teacher-equivalent laboratory confirmation only.
6. Verify physical key rotation and all 10 record ciphertexts changed, an unchanged original event prefix and new revocation, assessment evidence and grade continuity. Force-stop process (no app-data clear) and freshly authenticate/reopen; compare physical inventory and historical digest.
7. Require **five** forced process-stop proofs, every exact native stage passed in JSON, and both API32/API36. Preserve inherited VAL-01 flows; no weakening of failure conditions.
8. Re-run 11 exact-SHA GitHub workflows, attach RED/GREEN receipts, leave PR draft and do not merge/deploy.

## Explicit exclusions
No actual production Android file-restore action, real student records, user-facing confirmation interface, signed anti-rollback, remote backup, release APK or promotion. CI's synthetic consent verifies mechanics, not pedagogical UX acceptance.
