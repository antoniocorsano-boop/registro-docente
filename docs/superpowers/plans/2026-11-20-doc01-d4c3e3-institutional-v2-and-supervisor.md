# DOC-01/D4c3e3 — institutional documents V2 and independently owned recovery
Date: 2026-11-20. Exact parent `e30457b0f788b8f40fee9332b3a1cc4ecf22baaa`, PR #379, 11/11 PASS; no merge.

## Teacher goal
A teacher can record locally confirmed, professional documents using institution, campus, school year, class, discipline and a controlled set of sections. This must be distinct from a formal institutional approval and must never imply council approval. Revision history remains append-only and explicitly revocable. The recovery confirmation must survive destruction of the old React App or Privacy component; a new authenticated session is needed before it reports success.

## Architecture choices
- Define **DocumentHistoryV2**, a new immutable non-demo institutional schema with scope and normalized versioning. Do not mutate V1 demo schema, its frozen hashes or the **V8** encrypted backup parser. Neither is a correct migration target for real data yet.
- Keep `official:false` and `approval:'teacher-confirmed'`. Real school codes and year/class/subject are explicit; no inferred approval or school context. Allow bounded professional textual sections with a controlled vocabulary. This capability is personal-data-sensitive: qualify local encryption, legal retention, institutional authority, and broader data handling before any connection to user archives.
- Validate bounded JSON inputs without getter calls, cycles, prototypes or extra keys. SHA-256 domain separation for records and history events. Integrity is **not** authenticity, signing or anti-rollback.
- Build external `createDocumentRecoverySupervisor` owning the already qualified one-use `DocumentRecoveryDecision`. Only the supervisor, not the old `DocumentRecoveryReview` component, may retain the grant across view destruction. Changing `DocumentRecoveryReview` to accept a supplied decision must not affect the existing self-owned workflow's cancellation semantics. A re-mounted view gets its phase from the persistent supervisor.
- Verify lifecycle using actual Chromium with Android 320/390 viewports and no product activation. The earlier V2 DB2 owner and native SAF remain isolated; this supervisor is a demonstration of the required ownership boundary, not yet a native production recovery controller.

## RED → GREEN
- Freeze new invariant **145** (V2 model), **146** (supervisor) and their executable tests. RED failures must be restricted to the missing new implementation.
- GREEN requires all inherited 1,357 contracts plus V2 and lifecycle cases without changing legacy V8 or V1 tests; full BETA2 Chromium and Android API32/API36 regression gates.
- Retain branch as draft and do not merge, distribute or use real personal records.

## Follow-on production prerequisites
A separately reviewed, version-fenced **V9** (or new approved archival envelope) must explicitly support institutional history V2; determine migration rules for demo V1, retention/deletion/access policy, authentic school authority and secure native/session ownership at the app shell. Real student-level personal data are NOT approved by this phase. Production V1 Root remains untouched.


## Security review — explicit revoke operation, 2026-11-20
During review after the first green candidate, a new regression test intentionally showed that composing `{kind:'revoke',...untrustedInput}` could **execute accessors** or allow a supplied `kind:'append'` to replace the named operation. This is not merely a typing issue: it could cause an authorized revocation path to be interpreted as an append request. The [RED at SHA `d64e660788feec231e0db9c5add72898a7289e94`](https://github.com/antoniocorsano-boop/registro-docente/actions/runs/44686831477) produced **1,371 inherited/new passing contracts and exactly one failing security regression**. Correction at `425331572a43e7ff82ff7d41d57d64be4d472040` first detaches input through the existing descriptor-only bounded historical copier, then requires exactly the five revoke fields, then explicitly constructs a fixed `kind:'revoke'` operation. No getters, silent coercions, or caller-defined operation types are permitted. All V1 and V8 behavior is unchanged.

The overall exact-SHA green qualification must be reacquired after this change; earlier 9/11 or browser 174/174 from the prior SHA are evidence of the earlier candidate, not final qualification of the new SHA.
