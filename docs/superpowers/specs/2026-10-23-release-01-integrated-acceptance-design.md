# RELEASE-01 — Integrated Acceptance Design

**Date:** 2026-10-23  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Baseline:** `main@0df596a67416101460cfe9d95bf1e132b1a6ad7d`  
**Baseline tree:** `aeee0d324fec50989f477348cbf654ef17e9f08f`  
**Status:** APPROVED FOR QUALIFICATION EXECUTION

## Intent

Close the post-P2 release-readiness program with one consolidated, reproducible browser acceptance journey on the integrated product, after PERSIST-01/PERSIST-01H and ONLINE-01 have been merged.

RELEASE-01 is a qualification program, not a feature program. The default expectation is zero product-code change. If the integrated browser journey exposes a real defect, that defect must be isolated and corrected under the repository RED → GREEN rules before qualification resumes.

## Release acceptance journey

The canonical teacher journey is:

`Classi → Valutazioni → Comportamento → Tabellone → Analisi → Scheda alunno → UDA → Verifiche online → reload/lock-unlock → persistence verification`

One Chromium context must carry the same synthetic state through the whole journey. Passing isolated screen smoke tests is not equivalent to passing RELEASE-01.

## Acceptance dataset

Use synthetic-only data:

- class: `Classe Sintetica RELEASE-01`;
- student: `Studente Sintetico RELEASE-01`;
- evaluation title: `Valutazione RELEASE-01`;
- numeric grade: `8`;
- behavior state: `Costruttivo 👍`;
- UDA title: `UDA Sintetica RELEASE-01`;
- online submission student identity: `Studente Sintetico RELEASE-01`.

The acceptance journey should create or mutate state through teacher/student UI wherever the product already exposes that path. Test-only direct storage mutation is not accepted as a substitute for the teacher journey.

## Required assertions

### Classi
- Fresh Secure Local Vault can be configured.
- The synthetic class can be created and selected.
- The synthetic student can be added through Gestione alunni.

### Valutazioni
- A numeric evaluation can be committed for the synthetic student.
- The UI leaves no false-success state before the durable save finishes.

### Comportamento
- A behavior record can be committed for the synthetic student.

### Tabellone / Analisi / Scheda alunno
- The screens are reachable from the same class state.
- The committed evaluation is reflected in the downstream teacher-facing views without console/page errors.
- The student report is reachable and represents the same synthetic student.

### UDA
- A synthetic UDA can be created through the teacher UI.
- The UDA remains reachable in the integrated journey.

### Verifiche online
- Reuse the already-qualified ONLINE-01 semantics rather than weakening them.
- A student submission must become visible to the teacher only after its durable save succeeds.

### Reload / lock-unlock
- Reload the production page after the journey.
- Unlock the same Vault using only the qualification password.
- Verify the same synthetic class, student, evaluation, behavior, UDA and online submission remain present.
- This persistence verification is the terminal release assertion; PASS cannot be assigned before it succeeds.

## Browser and evidence contract

- Canonical environment: GitHub-hosted `ubuntu-22.04` runner.
- Browser: isolated `@playwright/test@1.64.1` + Chromium.
- Application dependencies: `bun install --frozen-lockfile`.
- Production application: `bun run build` then `NODE_ENV=production PORT=4173 bun run start`.
- Exact candidate SHA must be explicitly checkout-verified.
- Synthetic data only; no user data, secrets or external credentials.
- Capture screenshots at meaningful journey checkpoints and after terminal persistence verification.
- Capture a structured JSON receipt containing candidate SHA, journey checkpoints, persistence assertions, overflow metrics, console errors and page errors.
- Required evidence generation is part of the gate. Missing evidence is FAIL.
- Final `result: PASS` is assigned only after the last screenshot and final page/console error assertions.

## Approaches considered

### A. One stateful end-to-end browser journey — chosen

Runs the full release path in one Chromium context and verifies the same state after reload/unlock. This directly proves integration, continuity and durability, which is the purpose of RELEASE-01.

### B. Aggregate existing screen-specific qualifications — rejected

Cheaper, but it proves independent surfaces rather than one integrated product state. It cannot close the audit requirement for a consolidated release acceptance journey.

### C. Seed the Vault directly and navigate screens — rejected as canonical path

Useful for diagnosis, but it bypasses the mutation boundaries RELEASE-01 is meant to certify. Direct fixture seeding may be used only if needed for an auxiliary diagnostic, never as the terminal acceptance proof.

## Product-change boundary

No product code is changed merely to make RELEASE-01 exist. If the gate fails:

1. classify the failure as harness/infrastructure or product;
2. fix harness-only causes without weakening acceptance assertions;
3. for a real product defect, add a causal failing regression contract first;
4. apply the minimum product fix;
5. re-run full PREDEPLOY and integrated Browser Qualification on the new exact candidate.

## Decision boundary

Technical qualification and deployment remain separate decisions.

RELEASE-01 may end in:

`ENGINEERING QUALIFIED / INTEGRATED BROWSER QUALIFIED / INDEPENDENT REVIEW PASS / HUMAN DEPLOY DECISION PENDING`

It must not deploy, publish, create a release, or mutate production infrastructure automatically.
