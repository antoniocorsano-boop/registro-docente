# RELEASE-CURRENT-02 — Current Main Teacher Validation Design

**Status:** APPROVED FOR VALIDATION — formalized on 2026-10-28 from the agreed phase decision  
**Repository baseline:** `main@dea3b3e7a2cbd5ec920b7ec30f34ed23f45142f8`  
**Baseline evidence:** PREDEPLOY Security Qualification #1087 / run `40725147847` = SUCCESS on the same exact SHA  
**Scope:** `registro-docente` current integrated product, including AIC-07  
**Date:** 2026-10-28

## 1. Intent

Before opening AIC-08 or another capability-expansion tranche, validate the current integrated Registro Docente as a product used by a teacher.

The purpose is not to accumulate more automated evidence for features already qualified in isolation. The purpose is to establish whether the integrated `main` is understandable, controllable and useful in authentic teacher workflows, and to make the next product decision from observed evidence rather than from feature momentum.

Canonical phase flow:

`freeze exact main -> qualify frozen release -> publish intentionally -> use authentically -> classify evidence -> repair only what matters -> decide next capability`

## 2. Decision

Three approaches were considered.

### A. Start AIC-08 immediately

**Strength:** fastest feature expansion.  
**Risk:** adds transformation capabilities before proving that the current Copilot, Library and governance surfaces work coherently in daily use.

**Decision:** rejected for the current phase.

### B. Perform repository housekeeping first

**Strength:** cleaner administrative state.  
**Risk:** spends project attention on historical Draft/documentation PRs before gaining product evidence.

**Decision:** deferred; housekeeping is subordinate to validation.

### C. Validate current `main` before expansion — selected

Freeze the integrated baseline, obtain exact-SHA release evidence, publish only by explicit decision, run authentic teacher journeys, classify findings and repair only evidence-backed blockers or material friction.

This approach is selected because the principal uncertainty is now product use, not missing implementation surface.

## 3. Frozen baseline

The validation baseline is:

`dea3b3e7a2cbd5ec920b7ec30f34ed23f45142f8`

It is the signed merge commit integrating AIC-07 into `main`.

Rules:

1. RELEASE-CURRENT-02 does not silently move to a newer SHA.
2. A code change creates a new candidate and invalidates any release qualification tied only to the previous SHA.
3. Evidence must identify the exact candidate SHA it qualifies.
4. Merge and publication are separate human decisions.
5. No AIC-08 implementation is permitted inside this tranche.

## 4. Goals

RELEASE-CURRENT-02 must answer five product questions:

1. Can a teacher understand what the current Registro is offering without already knowing its internal capabilities?
2. Can the teacher move from context to Copilot opportunity, preview, explicit Play and result without losing authority or orientation?
3. Can heterogeneous Library material be connected to an actual lesson/UDA workflow in a way that feels professionally useful rather than technically impressive?
4. Can the teacher safely interrupt, defer, resume, dismiss and revisit AI-assisted work without accidental execution or confusing resurrection of stale state?
5. Does the current integrated product justify capability expansion, and if so which transformations should AIC-08 prioritize?

## 5. Non-goals

This tranche does not:

- implement AIC-08;
- widen remote-AI authority;
- add new autonomous behavior;
- redesign unrelated product areas because they are visible during testing;
- clean up historical PRs unless they directly block this validation;
- award a higher maturity level solely because automated qualification passes.

## 6. Validation journeys

### Journey J1 — Mobile-first supervised Copilot

Start from a realistic teacher context on smartphone and traverse:

`teacher context -> relevant opportunity -> why now -> mission preview -> explicit ▶ Play -> bounded execution -> result -> close/reopen/resume`

Observe:

- whether the opportunity is understandable;
- whether `whyNow` is credible and evidence-backed;
- whether the teacher understands what Play authorizes;
- whether result state remains visible and recoverable;
- whether interruption/resume semantics remain understandable.

### Journey J2 — Private Library to teaching work

Acquire a realistic source such as a photo, article, web page/post, document, asset or teacher note/concept and connect it to a live lesson/UDA/activity context.

Observe:

- ingestion clarity;
- relevance explanation;
- source/context binding;
- PREPARE/REVIEW progression;
- usefulness of the resulting teaching artifact or preparation;
- distinction between generated proposal and adopted professional act.

### Journey J3 — Control, interruption and safety

Exercise deliberate non-happy paths:

- Ignore / defer an opportunity;
- change lesson/UDA/source context;
- close preparation during work;
- lock/unlock;
- reopen after interruption;
- decline or withhold remote execution consent where applicable;
- ensure no durable professional write occurs without its separate confirmation.

Observe both correctness and teacher comprehension.

## 7. Evidence classification

Every observation from authentic use must be classified before any patch begins.

### Class A — Correctness / authority / privacy / durability defect

Examples: wrong context binding, unauthorized execution, lost durable state, stale result presented as current, professional write without confirmation.

**Action:** stop the affected path and enter a causal repair loop.

### Class B — Material UX friction

Examples: teacher cannot discover the next action, feedback is too weak, state labels are unclear, recovery path exists but is not understandable.

**Action:** record evidence and evaluate whether the friction materially blocks the validation journey. Repair only when justified by observed impact.

### Class C — Capability request / opportunity

Examples: a transformation or output that would clearly improve the workflow but is not currently promised.

**Action:** do not implement inside RELEASE-CURRENT-02. Add to the evidence backlog for AIC-08 design.

### Class D — Cosmetic or non-material observation

**Action:** record if useful; do not derail the tranche.

## 8. Repair discipline

Any material defect follows the existing governed loop:

`reproduce -> causal RED -> minimal GREEN -> exact-SHA PREDEPLOY -> exact-SHA Browser Qualification -> fresh publication decision -> authentic recheck`

No opportunistic adjacent refactor is allowed inside a repair unless it is required to restore the failed contract.

## 9. Release qualification requirement

The integrated merge SHA must be qualified as the release candidate in its own right.

PREDEPLOY #1087 is already SUCCESS on `dea3b3e7…`.

Before publication for teacher validation, obtain a fresh Browser Qualification receipt on the exact same merge SHA rather than relying only on Browser evidence from the pre-merge parent candidate.

The release receipt must record:

- exact SHA;
- workflow/run identity;
- dedicated current-slice/browser results;
- historical browser regression result;
- UX-QA results;
- artifact identity and digest when provided by the workflow.

## 10. Publication boundary

Publication is not implied by qualification.

A valid sequence is:

`qualification PASS -> explicit human publication decision -> publish exact qualified SHA -> verify served build -> authentic validation`

No patch may be smuggled into the publication step.

If the repository itself has no governed deployment workflow for the active environment, that fact must be recorded and the existing publication mechanism must be treated as a separate controlled action.

## 11. Exit criteria

RELEASE-CURRENT-02 exits only when all of the following are true:

1. an exact release SHA is frozen;
2. PREDEPLOY is green on that exact SHA;
3. Browser Qualification is green on that exact SHA;
4. publication, if performed, serves the intended exact candidate or an auditable equivalent build identity;
5. J1, J2 and J3 have been exercised authentically;
6. material findings are classified;
7. all Class A blockers are repaired and requalified, or explicitly accepted as blocking release advancement;
8. material Class B friction has a documented disposition;
9. Class C opportunities are captured without being implemented in this tranche;
10. a validation exit note records what works, what confuses, what is missing and what is unnecessary.

Passing automated gates alone does not satisfy these exit criteria.

## 12. Decision after validation

Only after the exit note is available do we decide whether to open AIC-08.

AIC-08 should be shaped by evidence from real use. Candidate transformations may include adaptation, simplification, student handouts, activity generation, or turning a photo/article/web source into teaching material, but the final catalog is deliberately not frozen in RELEASE-CURRENT-02.

## 13. Housekeeping

Historical Draft/docs-only PR cleanup remains a separate administrative pass. It must not interrupt authentic current-product validation unless a specific repository condition blocks qualification or publication.

## 14. Canonical project rule

For this phase, the project follows:

**evaluate -> qualify -> publish deliberately -> use authentically -> classify evidence -> repair only what matters -> decide -> expand**

Until RELEASE-CURRENT-02 exits, AIC-08 remains out of scope.
