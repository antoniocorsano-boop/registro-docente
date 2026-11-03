# FLOW-03 — Final Review P1 Qualification Checkpoint

Date: 2026-11-03
PR: #110
Base: `main@18cbbbdb040f2f6ad08a242c469f1f55c3b3e290`

The P1 repair is now present in product/tests and its new contract is registered under `FLOW-03-I01`.

- causal RED contract: `35478189e2b5d3d282ace219493477919da319eb`;
- product/browser repair: `d980eb72b33e68af2b873af5e142e56fe767497c`;
- invariant registration: `aafc865160b3d43f13884e91d1f8a0749effa3b1`;
- one-shot workflows removed before their respective bot-authored commits;
- ordinary UDA navigation now invalidates the recording session unless preservation is explicitly requested;
- browser regression covers ordinary navigation away from focused UDA and a later normal return without resurrecting the Registra mission or focused mode.

This human-authored checkpoint changes documentation only and establishes the exact candidate for fresh qualification. No merge or deploy is authorized.