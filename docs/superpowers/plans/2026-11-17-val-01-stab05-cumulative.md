# STAB-05 — Qualificazione cumulativa
Base #306 e444abf5d69af1c217d0d06f35a8521bebf04c7f, run 44126527776: 21/21 driver, 10/10 fasi native API36 precommit. Riesame tecnico #306 registrato; non è revisione indipendente.

## Criteri di accettazione
- Quattro casi di interruzione RC2: API32 e API36, prima e dopo il commit. Stesso candidato, dati sintetici, integrità e autenticazione attestate.
- Qualificazione browser database sui tre predecessori storici, regressioni applicative generali, contratti di sicurezza e navigazione mobile, registro invarianti e compilazione.
- Conservare risultati e identificativi di esecuzione riferiti al candidato esatto; non promuovere prove mancanti a PASS.
- Revisione indipendente del cambiamento e revisione specifica della sicurezza obbligatorie. Riesaminare anche revoca delle autorizzazioni, assenza di fallback in chiaro, non creazione di archivi su errore e confini di attivazione.
- Nessun merge, rilascio o aggiornamento di dispositivi. Il candidato resta disattivato nella build di produzione.

## Stato
Ramo predisposto. La configurazione dei workflow cumulativi non è stata applicata: esecuzioni e revisioni ancora da acquisire. Il PASS di STAB-04b non dimostra la causa originaria del guasto né tutti gli scenari hardware. Nessun PASS cumulativo attribuito.
