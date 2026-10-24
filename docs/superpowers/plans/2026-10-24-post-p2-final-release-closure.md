# POST-P2 Final Release Closure Receipt

**Date:** 2026-10-24  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Released product source:** `64672ba04f4afc99a3530632b832a07160c181f4`  
**Released product tree:** `ba5ba02d12d2920d8aa50167546516835a6cede0`  
**Public target:** `https://registro-docente.ai.studio`  
**Status:** `POST-P2 = COMPLETE / RELEASE LIVE VERIFIED`

## Purpose

This document is the canonical closure receipt for the post-P2 release-readiness program initiated by the read-only audit preserved in superseded PR #17.

The program had three ordered product fronts:

1. `PERSIST-01` — durable write semantics, followed by bounded hardening `PERSIST-01H`;
2. `ONLINE-01` — student submission integrity;
3. `RELEASE-01` — integrated exact-SHA acceptance and deploy-decision handoff.

All three fronts have been implemented, qualified, integrated, published to the existing public target and verified with Chromium against the live deployment.

PR #17 is intentionally closed without merge because its baseline and planning state are historical and fully superseded by the completed program recorded here.

## Canonical integration sequence

### 1. PERSIST-01 — durable write semantics

- PR: #18 — merged;
- integrated branch head: `70078d67dc1ae3ee49fbd975a7805cd112c9813d`;
- scope: atomic and serialized durable writes, commit-first mutation coordination, failure isolation and truthful persistence boundaries.

### 2. PERSIST-01H — mutation contract hardening

- PR: #19 — merged;
- final merged branch head: `d76960312af7e9a5f9ed9e17b9e1b83ea28f9765`;
- merge commit: `6f7a1f2e4a2f696d81aed3f436d756c4a9074846`;
- scope: UI pending/reentrancy guarantees, backup/restore serialization, atomic restore, retry-state preservation and broader mutation-contract hardening;
- browser failure-injection and terminal independent review were completed before integration.

Together PR #18 + PR #19 close the post-P2 `PERSIST-01` front.

### 3. ONLINE-01 — student submission integrity

- PR: #26 — merged;
- qualified exact candidate: `e626a57974d35d7c3046554069f8edc841e5cfb0`;
- merge commit: `76c0f9ce2ec4d16f522f6d8affb1b622f7e30fb2`;
- exact-head PREDEPLOY: run `40020827933` — PASS;
- exact-head Browser Qualification: run `40020828350` — PASS, 3/3 Playwright;
- artifact: `12529643868`;
- artifact digest: `sha256:34b10bb610b1c5f4af6506d4e77261cd2ef3d7c6d5544d5a9af408f13651a8b0`;
- terminal independent review: PASS, 0 findings / 0 unresolved findings.

ONLINE-01 established truthful pending/retry submission semantics, non-reentrant final submit, stable retry identity, register-derived class choices and full-screen student-flow isolation.

### 4. RELEASE-01 — integrated release acceptance

- PR: #27 — merged;
- qualified exact candidate: `4d983ba420f35ddb6523de7d3b770248e8463b1b`;
- merge commit / released product source: `64672ba04f4afc99a3530632b832a07160c181f4`;
- exact-head PREDEPLOY #272 / run `40038717630`: PASS — 227 PASS / 0 FAIL, 1369 assertions, 45 files; typecheck, production build and startup smoke PASS;
- exact-head Browser Qualification #37 / run `40038717690`: PASS — 4/4 Playwright;
- candidate browser artifact: `12538670199`;
- candidate artifact digest: `sha256:145cc51938004fad40d9c8de04c835572d70f70bca5d37f102d8280fb22c69da`;
- terminal Codex re-review: COMPLETED / 0 findings / 0 unresolved findings.

The integrated RELEASE-01 journey verified with synthetic-only data:

`Classi → Valutazioni → Comportamento → Tabellone → Analisi → Scheda alunno → UDA → Verifiche online → reload/unlock → manual lock/unlock → persistence verification`.

Before reload, the journey explicitly observed the synthetic student's Analytics annual average as `8,0`. After reload and lock/unlock, the terminal checks reverified persistence of the synthetic class, student, grade `8`, behavior, UDA and online submission, including explicit student/class/test submission identity. The terminal phase did not revisit Analytics, so this receipt does not claim that the `8,0` Analytics rendering itself was re-observed after reload.

## Post-merge main qualification

The RELEASE-01 merge produced source commit `64672ba04f4afc99a3530632b832a07160c181f4` with parents:

- previous main `0df596a67416101460cfe9d95bf1e132b1a6ad7d`;
- qualified RELEASE-01 candidate `4d983ba420f35ddb6523de7d3b770248e8463b1b`.

Post-merge PREDEPLOY #273 / run `40058270306` initially encountered a transient SEC-3 server-readiness timeout. The same run was retried on the same source SHA with no content change and completed PASS on attempt 2:

- 227 PASS / 0 FAIL;
- 1369 assertions;
- 45 files;
- typecheck PASS;
- production build PASS;
- production startup smoke PASS.

The retry demonstrated that the first attempt was a non-deterministic readiness flake, not a reproducible product regression.

## Publication and live verification

The existing deployment target was preserved. No new Cloud Run service, domain or provider was introduced.

The application was republished to:

`https://registro-docente.ai.studio`

A dedicated isolated GitHub runner then exercised the public deployment directly, using the already qualified browser harness and synthetic-only browser-local data.

### Live release verification

- workflow run: `40059096035` (`Live Release Browser Verification` #40);
- expected released source checkout: `64672ba04f4afc99a3530632b832a07160c181f4` — exact match;
- public HTTP probe: PASS;
- live asset fingerprints observed:
  - `assets/index-DsejJ0Zu.js`;
  - `assets/index-BuJkchQK.css`;
- Chromium suite: **4/4 PASS** in 14.2 s;
- covered live scenarios:
  1. production shell smoke;
  2. ONLINE-01 mobile pending/non-reentrant path at 390×844;
  3. RELEASE-01 integrated stateful journey at 1280×900;
  4. ONLINE-01 desktop failure/retry identity path at 1280×800;
- live artifact: `12546239401`;
- live artifact digest: `sha256:a005c5df0004351d6e8fd20ccceb1a0648b97aa85de8b66c33a491560062c9de`;
- zero unexpected console errors;
- zero page errors;
- no horizontal overflow in the qualified viewports.

The temporary operational verification branch was reset to the released source SHA after evidence capture; no live-check workflow modification remains pending for integration.

## Repository-head note after publication

During this closure task, an accidental one-line placeholder file was briefly committed to `main` and then immediately removed with a compensating commit before the closure branch was created.

- accidental add commit: `40f16bd901c83491638109c9cc85b1e143412e3e`;
- compensating delete commit: `482c62a7811655112ce91c613241e70e67464bc3`;
- resulting tree: `ba5ba02d12d2920d8aa50167546516835a6cede0` — exactly identical to released source `64672ba...`.

Therefore the repository history advanced, but product and repository content returned byte-for-byte to the released tree before this closure branch was created. The incident is preserved as a lesson learned and promoted to an operating rule requiring branch creation and verification before any non-default-branch contents mutation.

## Superseded planning record

PR #17 (`POST-P2-AUDIT`) is closed without merge and explicitly marked **SUPERSEDED**.

Reason: its historical baseline `8afb734a184403f03153d493e1ea677f6d1e5abb` predates the completed PERSIST-01/PERSIST-01H, ONLINE-01 and RELEASE-01 integrations. Merging it after release would reintroduce stale planning state rather than preserve current canonical truth.

## Governance conclusion

The post-P2 program is closed.

- `PERSIST-01`: CLOSED / INTEGRATED;
- `PERSIST-01H`: CLOSED / INTEGRATED;
- `ONLINE-01`: CLOSED / INTEGRATED;
- `RELEASE-01`: CLOSED / INTEGRATED;
- released source: `64672ba04f4afc99a3530632b832a07160c181f4`;
- released tree: `ba5ba02d12d2920d8aa50167546516835a6cede0`;
- public release: REPUBLISHED;
- public Chromium verification: PASS;
- prior POST-P2 audit PR #17: SUPERSEDED / CLOSED WITHOUT MERGE.

Canonical state:

`POST-P2 = COMPLETE / RELEASE REPUBLISHED / PUBLIC LIVE / REAL-BROWSER VERIFIED`

## Next-action boundary

This closure receipt does **not** authorize another product feature, redesign, migration or infrastructure change.

Any work after this point must start as a new bounded program with its own goal, baseline, design/plan where needed, causal verification strategy and separate human integration/deploy decisions.
