# FLOW-03 — Final Independent Review P1 Repair Receipt

Date: 2026-11-03
PR: #110
Base: `main@18cbbbdb040f2f6ad08a242c469f1f55c3b3e290`

## Finding

Final Independent Review on `5b2913c7e2de06b04e8bcfb79f205698b8a80a47` found one P1: an editing `lesson-log` session was implicitly preserved by ordinary `handleNavigateTab` navigation, allowing the Registra mission/focused UDA prefill to reappear after an unrelated navigation away and a later ordinary return to UDA.

## Causal RED

`35478189e2b5d3d282ace219493477919da319eb` added `flow03OrdinaryUdaNavigationInvalidationContract.test.ts`. FLOW-03 Contract Qualification #179 failed specifically because the old `lesson-log` preservation exception was still present.

## Minimal repair

Product repair commit: `d980eb72b33e68af2b873af5e142e56fe767497c`.

- ordinary navigation preserves FLOW-03 only when `preserveRecordSession` is explicitly requested;
- the `lesson-log` evidence kind no longer grants implicit preservation;
- explicit Registra entry/return semantics remain separate and unchanged;
- browser qualification now covers focused UDA → close fascicolo → ordinary navigation to Storico → ordinary return to UDA, requiring no mission banner and no `Registrazione rapida` resurrection;
- no persistence path or specialist write authority changed.

The one-shot repair harness was removed before the product commit. Its targeted contracts, browser contract, TypeScript and `git diff --check` were GREEN before push.

This receipt is a human-authored documentation checkpoint to trigger fresh exact-SHA PR qualification. No merge or deploy is authorized.