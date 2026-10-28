# RELEASE-CURRENT-02 — Current Main Teacher Validation Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this operational plan task-by-task. Do not start AIC-08 from this plan.

**Goal:** Qualify and authentically validate the integrated Registro Docente baseline before any new AI capability tranche is opened.

**Architecture:** Treat the integrated `main` commit as a frozen release candidate. Separate automated exact-SHA qualification, publication, authentic teacher validation, evidence classification and any repair loop into distinct gates so that no product change can enter unnoticed.

**Tech Stack:** GitHub Actions, Bun, Vite production build, Playwright/Chromium, existing Registro browser evidence harness, existing publication mechanism.

**Spec:** `docs/superpowers/specs/2026-10-28-release-current-02-teacher-validation-design.md`

## Global Constraints

- Frozen starting baseline: `main@dea3b3e7a2cbd5ec920b7ec30f34ed23f45142f8`.
- Known baseline receipt: PREDEPLOY Security Qualification #1087 / run `40725147847` = SUCCESS on that exact SHA.
- No AIC-08 implementation during RELEASE-CURRENT-02.
- No hidden candidate drift: every receipt names its exact SHA.
- Qualification does not authorize publication.
- Publication does not authorize additional code changes.
- A durable professional act still requires separate human confirmation.
- Any material repair uses causal RED -> minimal GREEN -> exact-SHA qualification.
- No merge or deploy/publication action is implicit in this plan.

## Review Focus

1. **Integrated merge SHA vs pre-merge candidate:** browser qualification must prove the merge commit itself, not merely inherit parent evidence.
2. **Mobile teacher comprehension:** Play, why-now, result and Resume must be understandable without knowledge of internal AI architecture.
3. **Context drift:** lesson/UDA/source changes must not leave stale opportunities or results presented as current.
4. **Interruption and authority:** close, defer, lock/unlock and withheld consent must not accidentally execute or persist a professional act.
5. **Library-to-teaching usefulness:** successful ingestion is insufficient unless the teacher can turn the source into contextually useful preparation with clear provenance.

---

## Task 0 — Freeze and record the phase decision

**Files:**
- Create: `docs/superpowers/specs/2026-10-28-release-current-02-teacher-validation-design.md`
- Create: `docs/superpowers/plans/2026-10-28-release-current-02-teacher-validation.md`

- [x] Confirm `main` head is `dea3b3e7a2cbd5ec920b7ec30f34ed23f45142f8`.
- [x] Confirm PREDEPLOY #1087 is SUCCESS on that exact SHA.
- [x] Record selected strategy: validate current `main` before AIC-08.
- [x] Record non-goals, evidence classes, repair discipline and exit criteria.
- [ ] Keep this documentation change isolated from product code and review it as a docs-only PR.

**Exit:** the phase has a canonical, versioned design and execution plan.

---

## Task 1 — Exact merge-SHA Browser Qualification

**Files changed:** none expected.

**Execution contract:** `.github/workflows/browser-qualification.yml` sets `CANDIDATE_SHA` to `github.event.pull_request.head.sha || github.sha`, checks out that exact candidate, verifies `git rev-parse HEAD`, builds production, runs dedicated AIC-07 Chromium qualification, historical browser qualification, UX-QA-01 and UX-QA-02, then uploads evidence.

- [ ] Create or use a temporary qualification ref that points exactly to `dea3b3e7a2cbd5ec920b7ec30f34ed23f45142f8`; do not use the docs branch after it contains documentation commits.
- [ ] Dispatch Browser Qualification from that exact ref.
- [ ] Verify the workflow-reported `head_sha` is exactly `dea3b3e7a2cbd5ec920b7ec30f34ed23f45142f8` before interpreting results.
- [ ] Require dedicated AIC-07 Chromium qualification = PASS.
- [ ] Require historical Chromium qualification = PASS.
- [ ] Require UX-QA-01 = PASS / 0 material findings.
- [ ] Require UX-QA-02 = PASS / 0 material findings.
- [ ] Record workflow/run number, job result, artifact ID/name, artifact digest and candidate SHA in the release receipt.
- [ ] If the run fails, classify deterministic product failure vs runner/browser infrastructure instability before any code change.

**Exit:** PREDEPLOY and Browser Qualification both green on the same frozen merge SHA.

---

## Task 2 — Publication readiness decision

**Files changed:** none expected.

- [ ] Reconfirm `main` has not moved in a way that would silently redefine the release candidate.
- [ ] Reconfirm the qualified candidate SHA and all receipts.
- [ ] Identify the actual publication path used by the current environment and record whether it can prove the served build identity.
- [ ] Present a human GO / NO-GO publication decision with no bundled code change.
- [ ] Do not publish without explicit human authorization.

**Exit:** either publication is explicitly authorized for the exact candidate, or the tranche pauses with a documented NO-GO.

---

## Task 3 — Publish and verify the candidate

**Precondition:** explicit human GO from Task 2.

**Files changed:** none expected unless the established publication mechanism itself requires an auditable metadata update; any such change must be separately reviewed before execution.

- [ ] Publish only the qualified candidate using the established environment path.
- [ ] Verify the served build corresponds to the intended candidate through the strongest available build identity/receipt.
- [ ] Record publication timestamp, environment and identity evidence.
- [ ] Do not patch the product during publication.

**Exit:** an auditable environment is serving the intended candidate, or publication is classified blocked.

---

## Task 4 — Authentic Journey J1: mobile supervised Copilot

**Surface:** smartphone first; desktop is supplementary.

- [ ] Start from a realistic teacher context rather than a synthetic feature-isolation route.
- [ ] Observe a relevant Copilot opportunity and assess whether the teacher understands what is being proposed.
- [ ] Inspect `why now` and evidence before Play.
- [ ] Open mission preview and verify bounded scope is understandable.
- [ ] Use explicit `▶ Play` and verify execution starts only then.
- [ ] Inspect the result and verify result state is understandable.
- [ ] Close/reopen or interrupt/resume and verify continuity and authority.
- [ ] Record each observation as Class A, B, C or D with reproduction evidence where applicable.

**Exit:** J1 has a human-use disposition, not merely a technical PASS.

---

## Task 5 — Authentic Journey J2: Library source to teaching work

**Surface:** use at least one realistic heterogeneous source relevant to teaching.

- [ ] Acquire one source such as photo, article, web page/post, document, asset or teacher note/concept.
- [ ] Verify ingestion/source identity and provenance are understandable.
- [ ] Connect the source to a real lesson/UDA/activity context.
- [ ] Inspect relevance explanation and source/context binding.
- [ ] Traverse PREPARE/REVIEW as appropriate.
- [ ] Judge the resulting preparation by professional usefulness, not only successful generation.
- [ ] Verify proposal/generated result remains distinct from an adopted professional act.
- [ ] Record Class A/B/C/D findings.

**Exit:** J2 establishes whether Private Library + Copilot creates useful teaching leverage in the integrated product.

---

## Task 6 — Authentic Journey J3: control, interruption and safety

- [ ] Ignore or defer an opportunity and verify expected lifecycle.
- [ ] Change lesson/UDA/source context and verify stale material is not presented as current.
- [ ] Close preparation while work is active and verify interruption semantics.
- [ ] Exercise lock/unlock and Resume.
- [ ] Withhold or decline remote execution consent where applicable and verify fail-closed behavior.
- [ ] Verify no durable professional write occurs without separate confirmation.
- [ ] Record Class A/B/C/D findings.

**Exit:** J3 demonstrates that the teacher retains understandable control across non-happy paths.

---

## Task 7 — Evidence triage and repair gate

**Files:** only if evidence justifies a repair; exact paths are determined by the causal finding, not pre-authorized here.

- [ ] Consolidate J1-J3 observations without collapsing correctness, UX friction and capability requests into one backlog.
- [ ] For every Class A finding, write a deterministic or browser reproduction first.
- [ ] Verify the reproduction is causal RED before implementation.
- [ ] Apply the smallest GREEN that restores the failed contract.
- [ ] Rerun targeted tests, full PREDEPLOY and full Browser Qualification on the new exact SHA.
- [ ] Re-publish only after a fresh human publication decision.
- [ ] Re-run the affected authentic journey.
- [ ] For Class B, repair only material friction supported by observation.
- [ ] For Class C, capture the opportunity for AIC-08 and do not implement it here.

**Exit:** no unresolved Class A blocker remains hidden inside the validation result.

---

## Task 8 — Validation exit note

**File:** create `docs/superpowers/reports/2026-10-28-release-current-02-teacher-validation.md` or the date on which validation actually concludes.

The report must answer four headings explicitly:

- **What works**
- **What confuses or creates material friction**
- **What is missing**
- **What appears unnecessary or lower priority**

- [ ] Record final exact validated SHA and qualification receipts.
- [ ] Record publication/environment evidence if publication occurred.
- [ ] Summarize J1-J3 outcomes and remaining accepted limitations.
- [ ] List Class C evidence candidates for AIC-08 without converting them automatically into requirements.
- [ ] Make an explicit GO / REWORK / HOLD recommendation for opening AIC-08.
- [ ] Do not assign higher maturity solely from automated gate success.

**Exit:** RELEASE-CURRENT-02 has an evidence-backed disposition.

---

## Task 9 — Only after RELEASE-CURRENT-02 exit: choose next tranche

- [ ] If exit = GO, brainstorm AIC-08 from the validation evidence before writing its design.
- [ ] If exit = REWORK, execute only the evidence-backed repair tranche first.
- [ ] If exit = HOLD, document the blocking condition and stop expansion.
- [ ] Run historical Draft/docs-only PR housekeeping as a separate administrative pass when it no longer competes with product validation.

**Exit:** the project advances because evidence justifies the next step, not because the previous feature was merged.

## Canonical sequence

`A0 formalize -> A1 exact-SHA browser qualify -> A2 publication decision -> A3 publish/verify -> A4 J1 -> A5 J2 -> A6 J3 -> triage/repair if needed -> validation exit -> only then design AIC-08`
