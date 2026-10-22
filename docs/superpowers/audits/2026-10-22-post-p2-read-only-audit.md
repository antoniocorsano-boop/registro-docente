# POST-P2 Read-Only Audit

**Date:** 2026-10-22  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Audited baseline:** `main@8afb734a184403f03153d493e1ea677f6d1e5abb`  
**Mode:** read-only product/repository audit  
**Status:** `POST-P2-AUDIT = RECORDED / PERSIST-01 DESIGN PENDING`

## Purpose

Preserve the first audit performed immediately after the formal closure of P2, so the next product decision does not depend on chat history. This document records observed facts and candidate next fronts only. It does not authorize implementation, merge or deploy.

## Repository state observed

- `main` was verified at `8afb734a184403f03153d493e1ea677f6d1e5abb`.
- PR #15 `P2-PRODUCT-REVIEW — closure tracker` is merged.
- PREDEPLOY #89 / run `39777649346` is PASS on `main@8afb734a...`.
- No open pull requests were found.
- No open GitHub issues were found before this audit was materialized.
- No production or Google Cloud deploy was performed as part of P2 closure.

## Governance residue: stale P2 closure receipt

`docs/superpowers/plans/2026-10-22-p2-product-review-resolution-tracker.md` still records the pre-merge closure state:

- integrated main pinned to `ded4fca0960ad24072e106b51f8b549de3e58812`;
- canonical NEXT still says closure-document review and merge;
- final status still says `CLOSURE DOCUMENT PENDING MERGE`.

Observed reality is later:

- PR #15 merged;
- final merge commit `8afb734a184403f03153d493e1ea677f6d1e5abb`;
- PREDEPLOY #89 / run `39777649346`: PASS;
- canonical P2 state is therefore `COMPLETE / ALL FINDINGS CLOSED / CLOSURE DOCUMENT MERGED / POST-MERGE QUALIFIED`.

This is documentation hygiene, not a reopened P2 product finding.

## Candidate 1 — PERSIST-01: durable write semantics

**Priority:** NEXT candidate  
**Severity:** HIGH

### Observed behavior

`src/App.tsx` contains multiple mutation paths where React state is updated before durable Vault persistence is confirmed.

1. `persistAppData(...)`
   - calls `setAppData(newAppData)` and `setMeta(nextMeta)` first;
   - then runs `secureStorage.saveAppData(...)` + `secureStorage.saveMeta(...)`;
   - on failure it alerts the teacher, but does not restore the prior UI state.

2. `handleSaveNewTest(...)`
   - updates `tests` first;
   - persistence failure is logged to console;
   - no rollback is applied.

3. `handleDeleteSubmission(...)`
   - updates `submissions` first;
   - persistence failure is logged to console;
   - no rollback is applied.

4. `handleSaveUdas(...)`
   - updates `udas` first;
   - persistence failure is logged to console;
   - no rollback is applied.

5. `handleUpdateSettings(...)`
   - updates `settings` first;
   - persistence failure is logged to console;
   - no rollback is applied.

The student-submission save path is an important counterexample already present in the code: `handleSaveStudentSubmission(...)` retains the previous state and restores it when `saveSubmissions(...)` rejects.

### Storage-layer facts

`src/security/secureVault.ts` serializes Vault mutations through `mutationTail`, preventing concurrent Vault mutations from interleaving arbitrarily.

`src/security/secureAppStorage.ts` exposes single-record save methods and also already contains a stronger verified-restore pattern in `restoreSnapshotVerified(...)`:

- capture previous snapshot;
- write candidate;
- read back and verify;
- on failure restore previous snapshot;
- verify rollback.

The audit therefore finds a semantics gap between the robust restore workflow and ordinary interactive writes.

### Test gap

The current security/product tests contain no contract specifically exercising `persistAppData` failure semantics. Existing Vault tests validate storage, crypto, migration and other boundaries, but not the teacher-visible state after an ordinary save rejection.

### Risk

A teacher can see a mutation as completed in the UI even though the encrypted Vault write failed. Subsequent work may therefore proceed from a state that appears committed but is not durable across reload/unlock.

### Desired invariant to design

`VISIBLE COMMITTED STATE` must never claim a mutation succeeded unless the corresponding durable write contract has either:

- completed successfully; or
- been explicitly represented as pending and safely reversible.

No implementation choice is approved by this audit record.

## Candidate 2 — ONLINE-01: student submission integrity

**Priority:** second  
**Severity:** HIGH/MEDIUM

Observed in `src/components/StudentPortal.tsx`:

- the portal moves to the result state before `onSaveSubmission(...)` confirms persistence;
- the result view says the prova was registered correctly while the save promise can still reject;
- failure produces an alert but does not retract the already-rendered success state;
- the class selector is hard-coded (`3ª A`, `3ª B`, `3ª C`, `3ª D`, `1ª A`, `2ª A`) instead of deriving from the current register classes;
- there is no dedicated `StudentPortal` contract in the current `src/security` test suite.

`App.handleSaveStudentSubmission(...)` already provides rollback on Vault failure, so the product has an existing lower-level boundary that can support a corrected UI state machine later.

## Candidate 3 — RELEASE-01: integrated acceptance and deployment decision

**Priority:** after data-integrity fronts

The repository has strong permanent PREDEPLOY checks and several prior targeted real-browser verifications. The final integrated `main@8afb734a...` has not yet been subjected to one consolidated end-to-end teacher journey followed by a deployment decision.

Candidate integrated journey:

`Classi → Valutazioni → Comportamento → Tabellone → Analisi → Scheda alunno → UDA → Verifiche online → reload/unlock → persistence verification`

This should remain downstream of PERSIST-01 and ONLINE-01 because deployment acceptance should test final durability semantics, not certify known gaps.

## Explicit non-candidates

- `ANALYTICS-01` is not open. Its plan file contains historical unchecked boxes, but PR #6 records merge and post-merge qualification.
- P2 is not reopened. Future work must be a new bounded/architectural program.
- Provider/runtime vocabulary cleanup is closed by PR #16.

## Recommended order

0. **POST-P2-RECEIPT** — correct the stale closure receipt only.
1. **PERSIST-01** — design and implement durable write/failure semantics.
2. **ONLINE-01** — align student success state and class selection with real persisted state/data.
3. **RELEASE-01** — integrated browser acceptance, then a separate deploy decision.

## Governance boundary

This audit is evidence, not an implementation plan.

- no product code modified;
- no behavior changed;
- no merge authorized;
- no deploy authorized;
- PERSIST-01 requires an approved design before implementation.
