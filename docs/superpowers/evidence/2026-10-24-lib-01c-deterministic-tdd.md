# LIB-01C deterministic teaching-context TDD checkpoint

Baseline: `main@ab1e23c1014dc96231aa92cfe8cf6e39a47c50a0`.

## Resolver cycle

- RED exact SHA: `b99e12256bcca08112558a515ea6dcbad4066017`.
- PREDEPLOY #449 / run `40108957589`: FAILURE causale, 298 PASS / 6 FAIL; i sei FAIL sono esclusivamente i nuovi contratti di suggestion; typecheck, build e startup smoke PASS.
- GREEN resolver SHA: `08913b79c18d6baec2b648554d2f46b0786d50ba`.
- PREDEPLOY #450 / run `40109034710`: SUCCESS.

## UI/browser cycle

- RED browser exact SHA: `9d3d2db095d3b6114ee105b28c19f77f7761c737`.
- PREDEPLOY #451 / run `40109220286`: SUCCESS.
- Browser #197 / run `40109220288`: FAILURE causale, 20/22 PASS. Gli unici due FAIL sono le nuove aspettative LIB-01C `Contesto proposto` desktop e `Scegli dove usarla` mobile; exact checkout e production build PASS; tutti gli altri journey browser PASS.
- Primo GREEN UI materializzato: `9ddca2fa34975845634b80ac768c624aedce6504`. Il commit automatico non è una ricevuta di qualifica: GitHub ha classificato i workflow PR associati come `action_required` senza job.
- Primo exact SHA umano con UI: `17b9d5e1ff2d162cf2e186eb15ccce8b16184260`.
- PREDEPLOY #454 / run `40109611447`: FAILURE per un solo test source-level legacy ancora legato al copy manual-only `Contesto di lavoro`; typecheck PASS, 303/304 security tests PASS, build PASS e startup smoke PASS. Il finding è test drift, non regressione prodotto.
- Correzione successiva: solo il contratto source-level viene riallineato agli invarianti architetturali della nuova UX (`suggestLibraryTeachingContext`, override esplicito, reset del gate, ContextSnapshot/dispatch finale). Nessun file prodotto viene modificato da questa correzione.

La qualifica finale deve avvenire su un successivo exact SHA con PREDEPLOY e Browser entrambi realmente eseguiti e verdi.

Nessun merge o deploy è autorizzato da questo documento.
