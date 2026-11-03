# FLOW-03B — Browser integration checkpoint

Baseline: `main@c56ae67693b773b093e51f131053ce1c205a9508`.

Il browser journey FLOW-03B è integrato nella superficie di qualifica canonica `tests/browser/flow-03-registra.spec.cjs`, già registrata nell’invariante FLOW-03-I01 e nel Browser Qualification esistente.

Il commit applicatore `6a162e58aab588e2638e6ddae9979a53b61af061` ha superato prima del push:

- `bun test src/security/flow03*.test.ts`;
- `bunx tsc --noEmit`;
- `git diff --check`.

I file harness temporanei e la prima spec browser dedicata sono stati rimossi: la prova finale vive nel journey FLOW-03 canonico e verifica M1/M2/M3 su desktop e mobile 390×844.

Questo checkpoint non modifica comportamento prodotto o test; serve a produrre un exact SHA human-authored per la qualifica PR. Nessun merge o deploy è autorizzato.
