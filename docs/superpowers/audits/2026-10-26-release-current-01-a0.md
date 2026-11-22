# RELEASE-CURRENT-01 — A0 Preliminary Release Audit

**Date:** 2026-10-26  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Audit type:** A0 — baseline / contract / evidence audit  
**Decision:** `PROCEED`

## 1. Exact baseline

Current canonical branch:

`main@0ebda92248b9bb984f2e3e201661292daa47e96d`

Current main tree:

`87483ccc4b693b0250ec3d338015fd2a9f6b350b`

The merge commit is GitHub-signed and verified.

At audit time there are no open pull requests competing for the release freeze. The planning work is isolated on `docs/audit-gated-product-roadmap` and is not part of the proposed application release source.

## 2. LIB-CONSOLIDATE-01 lineage

Qualified exact application candidate:

`6c1c3d3473267845b9faeade54c5c3dea03d33ca`

Candidate tree:

`87483ccc4b693b0250ec3d338015fd2a9f6b350b`

Integration merge:

`0ebda92248b9bb984f2e3e201661292daa47e96d`

Merge tree:

`87483ccc4b693b0250ec3d338015fd2a9f6b350b`

Therefore the integrated application content is tree-identical to the final qualified candidate.

Qualification evidence already present:

- PREDEPLOY #721: PASS on exact candidate `6c1c3d...`;
- Browser Qualification #428: PASS, 43/43 Chromium on exact candidate `6c1c3d...`;
- UX-QA-01: PASS, 0 findings;
- UX-QA-02: PASS, 0 findings;
- final whole-branch review: PASS, 0 findings in the recorded scope;
- post-merge PREDEPLOY #722 / run `40286021872`: PASS on exact merge SHA `0ebda922...`.

Evidence boundary: Browser #428 remains a run on `6c1c3d...`. Tree identity supports source lineage but this audit does not relabel Browser #428 as a browser run on the merge SHA.

## 3. Current public/live baseline

Latest canonical live-release receipt:

`docs/superpowers/receipts/2026-10-24-uxt-deploy-01-live-release.md`

Last live-verified release source:

`76c837470485bfcf9eaddb7e14aeff68a15a26ef`

Public target:

`https://registro-docente.ai.studio`

The 2026-10-24 live receipt records:

- explicit human deploy authorization;
- existing AI Studio / Cloud Run publication path;
- exact-source live runner checkout of `76c837...`;
- public HTTP probe PASS;
- mobile 390×844 PASS;
- desktop 1280×900 PASS;
- zero page errors and unexpected console errors;
- artifact `12552829482` with digest `sha256:94a96e2f102762a912a48ef798973e42f8308385820f542ab73e1dd195f14c18`.

The public live baseline therefore predates the current main by multiple integrated product programs. Aligning the public product to current main is a real release gap, not duplicate work.

## 4. Current qualification-harness coverage

The permanent `.github/workflows/browser-qualification.yml` currently checks out an exact candidate SHA, uses frozen application dependencies, builds the production app, installs Playwright 1.64.1 in an isolated toolchain and runs the current regression inventory.

Its current browser inventory includes:

- generic production smoke;
- LIB-01 private library;
- LIB-01B contextual Core;
- LIB-01C Teaching Context;
- LIB-01D governed proposals;
- LIB-01E provider runtime/disclosure;
- LIB-02 source acquisition;
- LIB-03C progressive relevance;
- LIB-04B Composer;
- LIB-04C LINK;
- LIB-04D PREPARE;
- LIB-05A local semantic retrieval;
- contextual Copilot handoff;
- ONLINE-01;
- RELEASE-01 integrated acceptance;
- UX-TRUST qualification/full regression;
- UX-QA-01 navigation/regressions;
- UX-QA-02 progressive disclosure.

The workflow also runs UX-QA-01/02 analyzers and preserves browser evidence with `if: always()`.

Conclusion: no product-code change is needed merely to create a fresh pre-release regression qualification.

## 5. Evidence gaps before deploy

The following remain intentionally open:

1. no fresh Browser Qualification has been executed with application checkout exactly on merge SHA `0ebda922...`;
2. the current public target has not been republished from `0ebda922...`;
3. consequently there is no live verification receipt for the current main;
4. no deploy action is authorized by this audit.

The correct next action is therefore qualification-only: create an isolated runner whose **application checkout is exactly `0ebda922...`**, execute PREDEPLOY-equivalent and full Browser Qualification evidence, then stop at the human deploy decision.

## 6. Architecture / authority audit

No release preparation currently requires:

- application behavior change;
- persistence/schema migration;
- Arena authority change;
- TRAMA Contextual Copilot Core change;
- intent threshold change;
- new provider or remote fallback;
- new cloud service/domain/database/authentication mechanism;
- production-data mutation.

This supports keeping RELEASE-CURRENT-01 qualification-only until the deploy boundary.

## 7. Risks to carry into A1

- temporary operational workflow must not be merged into `main` by accident;
- runner branch must be created and exact-base verified before contents mutation (OR-009);
- runner must checkout the frozen application source, not its own workflow commit, for product qualification;
- no evidence from candidate `6c1c3d...` may be silently relabeled as a run on `0ebda922...`;
- any `main` drift after this freeze requires an explicit new release-source decision;
- any qualification failure must be classified before product changes.

## 8. A0 ruling

`PROCEED`

Frozen release-source candidate:

`0ebda92248b9bb984f2e3e201661292daa47e96d`

Next gate:

`A1 — FRESH FROZEN-SOURCE QUALIFICATION`

Allowed next actions:

- isolated operational branch/workflow;
- exact frozen-source checkout;
- PREDEPLOY-equivalent tests;
- full Browser Qualification + UX-QA;
- artifact/evidence capture;
- review and deploy-readiness documentation.

Not authorized:

- deploy/publish;
- product code changes without a demonstrated failure;
- merge of operational runner into `main`;
- migration/config/provider changes.