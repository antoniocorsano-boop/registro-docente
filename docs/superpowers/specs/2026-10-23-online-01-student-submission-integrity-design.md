# ONLINE-01 Student Submission Integrity Design

**Date:** 2026-10-23  
**Baseline:** `main@6ad2fa9974df364a4fcd309c0ff9b25bbcbaa4c3`  
**Status:** APPROVED FOR EXECUTION by continuation of the post-P2 plan

## Intent

Close the remaining StudentPortal integrity gap identified by the post-P2 audit and intentionally left out of PERSIST-01/PERSIST-01H.

A student-facing success state must mean that the submission has actually crossed the durable persistence boundary. The portal must also derive class choices from the register's current classes instead of presenting a hard-coded list.

## Current behavior

`StudentPortal` currently:

- changes `step` to `result` before awaiting `onSaveSubmission(...)`;
- launches confetti before persistence completes;
- catches persistence failure only after the success UI is already visible;
- hard-codes six class options;
- has no pending/reentrancy guard on the final submit action.

`App.handleSaveStudentSubmission(...)` already returns a `Promise<void>` backed by commit-first `commitSubmissionsMutation(...)`, so ONLINE-01 does not need a new storage mechanism.

## Goals

1. Success UI and confetti appear only after `onSaveSubmission(...)` resolves.
2. While persistence is pending, repeated final-submit actions cannot create duplicate submissions.
3. On persistence failure, the portal remains on the completed quiz state, shows an actionable retry error, and preserves the answers/score needed for retry.
4. A retry reuses the same pending submission identity until a commit succeeds.
5. Class options come from the current register classes supplied by `App`.
6. The URL/default class is honored only if it exists in the supplied class list; otherwise the first available class is selected.
7. With no available classes, the portal must not start a quiz under a fabricated class.

## Non-goals

- No change to Vault crypto, schema, IndexedDB version, mutation coordinator, or durable storage semantics.
- No network/cloud submission transport.
- No change to grading formulas, test scoring, UDA, Analytics, or import-to-register semantics.
- No redesign of the overall StudentPortal visual language.
- No deploy or automatic merge.

## Approaches considered

### A. Optimistic result with rollback

Keep the current result transition and retract it on failure. Rejected because it knowingly exposes a false-success interval and conflicts with the project's commit-first semantics.

### B. Add a second persistence state machine below StudentPortal

Introduce a new submission persistence service. Rejected because `App.handleSaveStudentSubmission` already provides the correct durable Promise boundary; duplicating it would add unnecessary state and failure modes.

### C. Await the existing Promise in StudentPortal and gate the final transition

Selected. StudentPortal owns only transient UX state: pending, retry error, stable pending submission identity, and class choice. App remains the persistence authority.

## Interaction contract

On the last answered question:

1. Build a submission once and retain it as the pending retry candidate.
2. Set submission pending and disable/reject duplicate final submits.
3. Await `onSaveSubmission(submission)`.
4. On success: clear pending candidate/error, move to `result`, then launch confetti.
5. On failure: remain in `quiz`, keep the final answer/score intact, expose retry guidance, clear only the in-flight flag.

Starting a new quiz clears any prior pending submission and error.

## Class contract

`StudentPortal` receives `classNames: string[]` from `App` via `appData.classes.map(c => c.name)`.

Initial selection:

- use `defaultClassName` when it exists in `classNames`;
- otherwise use the first class;
- otherwise use the empty string.

The login form renders only supplied classes. When the list is empty, the start action is disabled and the UI explains that no class is available.

## Evidence strategy

TDD RED → GREEN on a dedicated ONLINE-01 source contract, followed by full `bun test`, typecheck/build/PREDEPLOY on the exact candidate. Final browser qualification must exercise a synthetic successful submission and a failure-injection/retry path on the exact candidate using the canonical GitHub-hosted Playwright gate.
