# Qualification Invariant Framework — operating protocol

## Purpose

This repository treats qualified product behavior as versioned engineering evidence, not as chat memory or an informal PR narrative. A later task that replaces, wraps or re-routes qualified behavior must preserve every applicable invariant unless an explicit governance decision changes that invariant.

## Canonical sources

- `qualification/invariants.v1.json` is the machine-readable registry of stable invariant IDs.
- Each invariant has an owner, a statement, impacted paths and executable evidence.
- `scripts/qualification/check-invariants.mjs` validates the registry and its referenced evidence.
- `scripts/qualification/impact.mjs` derives the invariants and inherited contract tests affected by an exact candidate diff.
- `qualification-manifest.json`, emitted by CI, is the inspectable exact-SHA receipt for one candidate.
- Browser qualification runs the short invariant smoke before expensive AIC-07 and historical browser regression.

Chat summaries and PR descriptions are useful navigation aids, but they are not authority for qualification state.

## Stable invariant rule

An invariant receives a stable identifier such as `A4-R2A-I02`. Its meaning must not be silently rewritten. If the product intentionally changes the behavior, update the governance decision and version or supersede the invariant explicitly.

Every invariant must reference executable evidence. Documentation without a test is not sufficient qualification evidence.

## Impact gate

Before qualifying a candidate, CI compares the pull-request base SHA with the exact candidate SHA. Changed paths are mapped to `impactPaths` in the invariant registry.

If a changed path is under a `guardedRoot` and maps to no invariant, qualification fails closed. The repair is to classify the change and add the missing invariant/evidence mapping, not to bypass the gate.

The impact gate selects the union of executable tests owned by all affected invariants. This is **regression inheritance**: a new or replacement component must re-prove the qualified properties of the component or path it changes.

## Candidate freeze

Once an exact SHA enters final qualification, treat that SHA as immutable evidence:

1. do not amend or force-push the candidate;
2. do not combine unrelated repairs into the candidate;
3. if the branch head moves, all earlier candidate qualification is stale;
4. qualify the new exact SHA from the required gates again;
5. during a RED → GREEN repair, prefer a single writer for the candidate branch. Parallel work belongs on a separate branch and is integrated only after inspection.

## RED → GREEN discipline

For a regression repair:

1. encode the missing invariant as an executable test;
2. acquire a causal RED on an exact SHA;
3. confirm unrelated gates remain green where possible;
4. apply the smallest production correction that restores the invariant;
5. run PREDEPLOY and the applicable invariant workflow on the new exact SHA;
6. when the affected surface is interactive, require browser qualification on that same SHA.

A predicted RED is not evidence. A test that is not actually selected by the qualified gate is not evidence.

## Browser order

The browser workflow uses this order:

1. production build and startup;
2. **qualification invariant smoke** — short, causal cross-surface checks for high-value inherited behavior;
3. dedicated AIC-07 suite;
4. historical Chromium regression;
5. UX evidence analyzers.

If the smoke fails, expensive downstream browser suites do not run. This prevents many tests from timing out on the same broken fixture/setup path and makes the first failure diagnostically useful.

## Exact-SHA manifest

`Qualification Invariants` emits a manifest containing at least:

- base SHA;
- candidate SHA;
- changed paths;
- affected invariant IDs;
- inherited test files;
- browser-smoke evidence paths;
- qualification status and verified SHA after the selected tests pass.

A manifest belongs only to the candidate SHA recorded inside it. It cannot qualify a later branch head.

## Completion rule

A task is not `QUALIFIED` merely because its new tests pass. The applicable inherited invariants, PREDEPLOY, browser gates and any other governed gates must all be green on the same exact candidate SHA. Open review findings or candidate drift invalidate completion.


## CI-FAST-01 — development checks, separate from full qualification (2026-11-21)

**Why:** daily PR updates must not launch the 200+ Chromium journey suite and
four Android emulator combinations for every intermediate adjustment. The
exact-SHA qualification rule above **still applies to final candidates**.

### Two clearly separated workflows

1. **Incremental development on stacked PRs whose base is not `main`:**
   `.github/workflows/ci-fast-development.yml` checks the exact head SHA,
   validates the invariant registry, computes impact against the actual PR
   base, selects only inherited and changed Bun contracts, and runs TypeScript
   and build only if corresponding source files changed. It cancels superseded
   runs of the same PR. No native emulator, broad Chromium sweep, deployment or
   secrets are used. A documentation-only change can finish without installing
   application dependencies. A new head SHA always gets a new result.
2. **Integration or release candidate targeting `main`:** all existing
   `main`-targeted workflows, qualification manifests, security checks,
   reference Chromium journeys and applicable native persistence/restore
   checks **remain unchanged and mandatory**. R1/R2/R3 and hardware acceptance
   remain separate release conditions. A fast PASS cannot be cited as
   `QUALIFIED` or as evidence for another SHA.

### Stop repeating the full suite mid-development

- Do not temporarily retarget a stacked PR to `main` merely to run the
  full suite after changing a label, test selector or local component.
- Keep the PR based on its intended immediately preceding feature branch.
  Finish related corrections and the selected contract tests first; run
  **focused** interactive Chromium checks at the end of a changed user
  journey, before freezing the candidate.
- Once the exact candidate is ready to be integrated, invoke the existing
  full `main` gate **once on that exact head**. Any changed SHA after that
  invalidates its full qualification.
- For modifications to encryption, storage, backups, restore contracts,
  native Android or schema, treat the fast result only as preliminary.
  Escalate to the existing relevant full/native gate before integration,
  even if no user interface changed.
- The fast plan and impact manifest are saved as inspectable CI artifacts.
  Both identify the base and candidate SHA, affected invariants and risk
  categories. They do **not** contain personal student records.
- The workflow cannot override branch protection, required status checks or
  repository release procedures. Before making CI-FAST an organizational
  convention, verify required check names on `main` in repository settings;
  no required full check may be replaced by a fast check.

### Security boundary

Only same-repository PRs run this fast job; `contents: read`, checkout of
the exact commit with credentials disabled, no cloud secrets or external
student data. Path and SHA inputs are validated; unclassified guarded paths,
missing inherited tests and browser specifications erroneously sent to the
Bun runner all fail closed.

**Status:** CI-FAST-01 implementation is proposed on a dedicated infrastructure
PR. Do not claim that the new policy is enabled in `main` until it has been
reviewed, fully qualified and integrated.
