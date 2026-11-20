# DOC-01/D4c3e6 — Verifica Android v9 del recupero istituzionale

Data: 20 novembre 2026. Base sequenziale: PR #382 `962520275c5da276c905519f3836108cfca4be81`. Solo laboratorio; nessun cambiamento all'app docente.

## Scelta architetturale

La PR #382 verifica la transazione DB2 e il supervisore V9 nel navigatore. Il precedente laboratorio Android prova invece V8 (documenti dimostrativi V1). Un archivio V8 non può diventare V9 mediante eliminazione o reinterpretazione implicita di revisioni. La prova V9 viene quindi eseguita in **installazioni sintetiche indipendenti** dal precedente percorso V7/V8, sui medesimi livelli API 32 e 36, senza cancellazioni nel processo di prova e senza modifiche al prodotto.

Il contenuto logico di backup V9, lo schema storico istituzionale V2 e l'involucro cifrato AES-GCM V2 restano versioni distinte.

## Procedura e riscontri richiesti

1. In un nuovo emulatore Android, installazione dell'applicazione debug isolata `it.trama.registrodocente.lab.val01`. Il programma sintetico prepara DB2 con dieci record e uno storico V2 valido; nessun V1 dimostrativo viene introdotto.
2. Creazione delle due copie cifrate V9 (recupero della situazione corrente e destinazione con un'ulteriore revoca documentale). Il selettore nativo Android scrive ciascun file e ne controlla byte e SHA-256. ADB legge i byte realmente conservati e ne verifica separatamente l'impronta.
3. Annullamento della selezione di destinazione: nessun permesso di sostituzione e archivio fisico invariato. Successiva selezione distinta dei due file mediante Android SAF, controllo integrale dei byte e impronte.
4. Preparazione tramite `prepareInstitutionalRestore` e proiezione V9 senza perdita, con ambiti approvati dal laboratorio, chiusura dell'accesso precedente e confronto atomico di DB2. La conferma viene consumata una sola volta; il secondo tentativo fallisce e tutti i dieci record cifrati cambiano dopo la sostituzione.
5. Arresto reale e verificato del processo con due osservazioni successive di assenza PID, senza `pm clear`, disinstallazione o reinstallazione. Nuovo avvio, nuova apertura autenticata del Vault/DB2, decifrazione di tutti i record e verifica del corpus documentale V2 con due eventi immutabili (conferma e revoca).
6. Confronto dei voti, dei dati valutativi e dell'intero inventario cifrato con il risultato del commit; conferma di identità di installazione conservata e divieto di accesso tramite vecchio proprietario.

## Evidenze verificabili

- Percorso di prova: `scripts/diagnostics/doc01-native-v9-evidence.mjs`.
- Collegamento al sistema di file nativi: `mobile/android-probe/val01-native-restore.fixture.ts`.
- Generazione dati e lettura dopo riavvio: `tests/browser/fixtures/val01-s6d-db2.fixture.ts`.
- Contratti: `src/security/doc01NativeV9RecoveryBoundary.test.ts`.
- GitHub Actions: `.github/workflows/val01-native-evidence.yml`; matrice API 32/36, modalità `legacy` e `v9`, risultati separati per ramo e SHA esatto.
- Registro di invarianti: `DOC-01-D4C3E6-I01` (n. 149).

Le **sei fasi richieste** per ciascun emulatore non sono da dichiarare superate prima dell'esito effettivo su GitHub. La qualifica del codice V9/Android non vale da sola come autorizzazione alla pubblicazione o al trattamento di dati personali.

## Vincoli non modificati

Nessun inserimento di dati reali o recupero nel Registro Docente distribuito. Nessuna migrazione V1→V2, nessuna attivazione su App/Privacy, nessun rilascio Android, nessuna firma professionale, nessuna pubblicazione. Riesame indipendente e condizioni di utilizzo rimangono distinti dai controlli automatici. Le prove V7/V8 esistenti restano inalterate e conservano la loro qualifica separata.
