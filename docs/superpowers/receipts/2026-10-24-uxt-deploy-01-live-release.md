# UXT-DEPLOY-01 Live Release Receipt

Date: 2026-10-24
Repository: `antoniocorsano-boop/registro-docente`
Public target: `https://registro-docente.ai.studio`
Release source: `76c837470485bfcf9eaddb7e14aeff68a15a26ef`

## Final status

`UX-TRUST-01 Option B / UXT-A→F = QUALIFIED / INTEGRATED / DEPLOYED / LIVE VERIFIED`

Publication was explicitly authorized by the human operator and then performed manually through AI Studio against the existing public target. This session did not invoke the provider-side publish action.

The provider deployment/revision identifier was not available to this session and is therefore not asserted. The public deployment was verified independently from an isolated GitHub-hosted Chromium runner after the human reported publication complete.

## Application lineage and evidence boundary

Application lineage:

1. exact qualified application candidate: `1f98efb6638a5ef43d3da94f671fae2ca5a6b614`;
2. application merge: `7491ed86941ca677b49ce15bb413affe45971cdd`;
3. integrated repository release source: `76c837470485bfcf9eaddb7e14aeff68a15a26ef`.

The qualified candidate and application merge share application tree:

`cce9c8ae9f9b8c161aa65b79cb77420911ca195c`

Browser Qualification #72 remains evidence only for exact candidate `1f98efb6638a5ef43d3da94f671fae2ca5a6b614`. The live evidence below does not transfer that exact-candidate qualification to another SHA; it verifies the behavior observed on the public deployment after publication while binding the verification harness to the frozen release source `76c837...`.

## Deploy decision

Human decision on 2026-10-24:

`DEPLOY AUTHORIZED`

Authorized boundary:

- existing AI Studio / Cloud Run publication path only;
- existing target `https://registro-docente.ai.studio`;
- no new service, domain or provider;
- no schema/config migration;
- no production-data mutation;
- post-publication fail-closed live browser verification required.

The human operator subsequently reported the AI Studio publication as completed.

## Isolated live verification

Temporary operational branch:

`ops/uxt-deploy-01-live-verify`

The branch was created directly from:

`76c837470485bfcf9eaddb7e14aeff68a15a26ef`

A temporary workflow was added only on that operational branch. The workflow itself checked out the frozen released source rather than the operational workflow commit.

Temporary operational PR: `#35` — `UXT-DEPLOY-01 — live verification runner`.

Live workflow:

- name: `UXT-DEPLOY-01 Live Verification`;
- run: `40077159945`;
- runner: GitHub-hosted `ubuntu-22.04`;
- Playwright: `1.64.1`;
- Chromium: real headless Chromium installed by Playwright;
- expected release SHA: `76c837470485bfcf9eaddb7e14aeff68a15a26ef`;
- actual checkout SHA: `76c837470485bfcf9eaddb7e14aeff68a15a26ef`;
- exact-source check: PASS;
- public HTTP probe: PASS.

Observed public asset fingerprints:

- `assets/index-gXXBbfk0.css`;
- `assets/index-h5XjTLOH.js`.

## Live Chromium result

The existing UXT-F full-application inventory was executed directly against the public target with synthetic browser-local data only.

Viewports:

- mobile `390×844`: PASS;
- desktop `1280×900`: PASS.

Playwright result:

`2 passed (18.9s)`

The passing UXT-F contract includes:

- route markers across the full application inventory;
- no document-level horizontal overflow at the qualified checkpoints;
- Privacy Shield interaction;
- Student Portal viewport ownership/isolation;
- zero uncaught `pageerror`;
- zero unexpected console errors.

The workflow then performed an explicit required-evidence gate and required both mobile and desktop JSON to contain:

- `result: PASS`;
- empty `pageErrors`;
- empty `consoleErrors`.

That required-evidence step completed PASS.

## Live evidence artifact

Artifact:

- ID: `12552829482`;
- name: `uxt-deploy-01-live-76c837470485bfcf9eaddb7e14aeff68a15a26ef`;
- digest: `sha256:94a96e2f102762a912a48ef798973e42f8308385820f542ab73e1dd195f14c18`;
- size: `75,553` bytes;
- files uploaded: `8`;
- retention: 7 days.

Required evidence includes mobile/desktop screenshots, mobile/desktop JSON, public HTTP material, release metadata and asset fingerprints.

## Governance conclusion

The release source stayed frozen on `main@76c837470485bfcf9eaddb7e14aeff68a15a26ef` throughout the deploy handoff and live verification.

No application file, dependency, persistence/security contract, grading behavior, Student Portal behavior, cloud configuration or production data was changed by the verification cycle.

Canonical state:

`UX-TRUST-01 Option B / UXT-A→F = QUALIFIED / INTEGRATED / DEPLOYED / LIVE VERIFIED`

## Documentation integration boundary

Human documentation integration decision on 2026-10-24:

`APPROVED`

This receipt is documentation-only and is the approved documentation candidate for PR #34. Integration must be performed with `expected_head_sha` pinned to the exact documentation head after final gates are green.

The authoritative execution record for the documentation merge is PR #34 metadata and its merge commit. The merge commit is intentionally not self-embedded in this pre-merge receipt, avoiding a self-referential documentation mutation.

No additional deploy, publication, application change or production-data mutation is authorized by this documentation integration decision.
