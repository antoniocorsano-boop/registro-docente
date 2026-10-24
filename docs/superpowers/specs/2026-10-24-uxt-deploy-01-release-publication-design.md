# UXT-DEPLOY-01 — Release Publication Design

**Date:** 2026-10-24  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Baseline:** `main@76c837470485bfcf9eaddb7e14aeff68a15a26ef`  
**Existing public target:** `https://registro-docente.ai.studio`  
**Status:** DESIGN APPROVED / DEPLOY NOT AUTHORIZED

## Intent

Publish the already integrated UX-TRUST-01 Option B application through the existing Registro Docente publication path, then verify the public result with a fail-closed Chromium run against the live URL.

The goal is not to change the product. The goal is to preserve source identity, publish the integrated baseline without introducing an infrastructure migration, and produce explicit evidence that the public deployment serves the expected application behavior.

## Source lineage

The release source is frozen at:

`main@76c837470485bfcf9eaddb7e14aeff68a15a26ef`

This commit contains the integrated UX-TRUST-01 application plus its documentation-only qualification receipt.

Application lineage remains explicit:

- exact qualified application candidate: `1f98efb6638a5ef43d3da94f671fae2ca5a6b614`;
- qualified candidate tree: `cce9c8ae9f9b8c161aa65b79cb77420911ca195c`;
- application merge commit: `7491ed86941ca677b49ce15bb413affe45971cdd`;
- application merge tree: `cce9c8ae9f9b8c161aa65b79cb77420911ca195c`;
- final documentation merge / release-source baseline: `76c837470485bfcf9eaddb7e14aeff68a15a26ef`.

Browser Qualification #72 remains canonical only for exact candidate `1f98efb...`. It is not relabeled as evidence for `76c837...`. Publication therefore requires its own live verification receipt.

## Existing qualification evidence

Before this deploy cycle:

- PREDEPLOY #319 / run `40075017659` — PASS on exact application candidate `1f98efb...`;
- Browser Qualification #72 / run `40075017775` — 15/15 PASS on exact application candidate `1f98efb...`;
- independent Codex review — COMPLETED, 0 findings on `1f98efb...`;
- application merge `7491ed...` has byte-identical application tree to the qualified candidate;
- PREDEPLOY #321 / run `40075547236` — PASS on application integration SHA `7491ed...`;
- PREDEPLOY #324 / run `40075730238` — PASS on final current `main@76c837...`.

This is sufficient deploy-readiness evidence while `main` remains exactly `76c837...`. If the release source changes, this design no longer authorizes using the existing evidence.

## Publication target and infrastructure boundary

Preserve the existing target:

`https://registro-docente.ai.studio`

The prior release already used the existing AI Studio / Cloud Run publication path. UXT-DEPLOY-01 must not create a new Cloud Run service, domain, provider, repository, secret, database, authentication system or persistence layer.

No production data migration is part of this cycle.

## Decision boundary

Preparing this cycle does not authorize publication.

Publication requires a distinct human deploy decision after the planning branch is reviewed. Until that decision, allowed actions are limited to read-only verification and documentation/planning changes on the isolated branch.

The deploy action must be source-pinned to the frozen baseline above. If the publication UI cannot prove or preserve the intended source, stop and re-establish the release source before publishing.

## Live verification contract

After publication, use an isolated GitHub-hosted runner and Playwright against the public URL.

The existing UX-TRUST-01 browser harness already reads `BASE_URL`, so it can exercise the public deployment without product changes. Qualification data remains browser-local and synthetic only.

Minimum live inventory at both 390×844 and 1280×900:

- Home;
- Riepilogo;
- Valutazioni;
- Comportamento;
- Tabellone;
- Analisi;
- Storico;
- Scheda alunno;
- Gestione alunni;
- Verifiche online;
- UDA;
- Impostazioni;
- Privacy;
- Privacy Shield;
- Student Portal.

The live gate fails closed on:

- public HTTP failure;
- unexpected page errors;
- unexpected console errors;
- horizontal document overflow at qualified checkpoints;
- Student Portal viewport isolation failure;
- inability to produce required evidence;
- mismatch between the expected release source recorded by the verification job and the frozen release source.

## Evidence

A successful live verification must preserve at least:

- expected release source SHA;
- public URL;
- observed public asset fingerprints where available;
- Playwright result;
- viewport-specific screenshots;
- JSON evidence from the UXT-F harness;
- page-error and console-error arrays;
- workflow run ID;
- artifact ID and digest.

The final receipt must distinguish source qualification evidence from live-deployment evidence.

## Success state

Only after publication and live verification both succeed may the cycle be recorded as:

`UX-TRUST-01 Option B / UXT-A→F = QUALIFIED / INTEGRATED / DEPLOYED / LIVE VERIFIED`

A successful deploy without live verification is not sufficient for closure.

## Non-goals

- no feature work;
- no UI redesign;
- no persistence/security redesign;
- no dependency upgrade;
- no grading or Student Portal behavior change;
- no infrastructure migration;
- no new cloud service or domain;
- no secret rotation;
- no production-data mutation;
- no claim that candidate Browser #72 automatically certifies the deployed site.

## Considered approaches

### A. Publish first and perform only a manual browser check

Rejected. It is fast but does not produce reproducible exact-source evidence and would weaken the project's canonical browser-certification discipline.

### B. Add a permanent live-release workflow to `main` before publication

Not selected for this cycle. It may be useful later, but introducing a new permanent release subsystem would expand the scope beyond publishing an already qualified application.

### C. Reuse the existing publication target and run a temporary, isolated GitHub live-verification workflow

Selected. This mirrors the previously successful RELEASE-01 closure path, preserves infrastructure, reuses the existing `BASE_URL`-aware harness and keeps temporary release mechanics out of the product tree unless later promoted deliberately.
