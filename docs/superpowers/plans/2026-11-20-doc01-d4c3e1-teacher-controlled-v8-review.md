# DOC-01/D4c3e1 — teacher-controlled review before V8 restore
Date: 2026-11-20. Exact parent: `b68be922c9ed15d93cdb43f009d7956724c272af`, PR #377 (11/11 PASS). Synthetic UI laboratory only; no real student data.

## Professional scenario
A teacher needs to understand whether recovery would preserve prior document revisions, evaluations and grades, and whether an exact recovery copy was validated, before giving one explicit and irrevocable restore confirmation. No reference to raw JSON, DB2 details, internal hashes or developer identifiers is useful in the teacher-facing surface.

## Safety boundary discovered
`PrivacyView` currently uses the legacy V6 encrypted backup import with `normalizeBackupPayloadVerified` and `restoreSnapshotVerified`. It must NOT receive DOC-01 V8. The V8 versioned codec and native DB2/SAF restore are qualified in **isolated synthetic laboratories only**, and historical documents still carry `labOnly:true`. Real production documents are not yet a supported data model. Activating a real user-facing V8 writer/restore now could cause unqualified, irreversible replacement. This phase deliberately prepares a separate, opt-in component and independent one-use decision controller with no production provider.

## Design
1. Explicit `documentRecoveryWorkflow?:DocumentRecoveryDriver` in Privacy, rendering the component **only** when a privileged owner opts in; `App` does not supply it in the distributed product.
2. The owner-supplied `prepare()` completes its independent logical/physical checks and returns only a non-personal review: V8, historic event counts, preserved assessment and grades, exact recovery copy proof. The UI itself is never a restore authority.
3. The teacher sees a three-step flow: inspect, type `RIPRISTINA` and confirm, then re-authenticate and verify. No auto-confirmation or auto-retry.
4. The controller consumes the one-use grant before awaited physical commit. Cancellation revokes the grant; a partial or uncertain commit stays uncertain. A successful commit is **not** marked completed until a separate new owner verification after reopening.
5. Existing V6/V7 import is untouched. QA: immutable RED→GREEN tests for concurrency, invalid preview, cancellation, one-use, ambiguous post-commit, verification failure; Chromium at mobile 320 and 390px with screenshots.

## Out of scope
No privileged production provider, real personal documents, Android publishing, real backup export V8 UX, real-world restore, merging, release or signing. A further specifically approved phase must qualify real owner/scope derivation, protected session teardown and re-authentication with no stale App mutation after DB2 owner rotation.
