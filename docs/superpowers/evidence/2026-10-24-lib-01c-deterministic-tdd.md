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
- Browser #200 / run `40109611475`: FAILURE con 21/22 PASS. L'unico FAIL desktop non vede `Contesto proposto`; il mobile e tutti gli altri journey sono PASS.
- Diagnosi Browser #200: il fixture creava correttamente una classe corrente ma le UDA sintetiche senza assegnarle a quella classe. Il resolver fail-closed restituiva quindi correttamente nessun candidato. La correzione è esclusivamente fixture-side e usa il selettore `Classe` già canonico nei browser test del repository; nessun file prodotto viene modificato.
- PREDEPLOY #457 / run `40109795700` sul successivo candidato umano `aa4ffc1fc55b7c679f8175af4125a96ce739faed`: SUCCESS, 304/304 test PASS, 1815 assertion, 61 file; typecheck, build e startup smoke PASS.

La qualifica finale richiede un exact SHA successivo alla correzione fixture con PREDEPLOY e Browser entrambi verdi sullo stesso commit.

Nessun merge o deploy è autorizzato da questo documento.
