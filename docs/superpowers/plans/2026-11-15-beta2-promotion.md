# BETA2-PROMOTION — RC1: promozione selettiva e gate residui

Base main `dcf70a21391ba1a0ec2d4c8fc1173419947dbc14`; laboratorio `e622506852fb9a7bb68eb5d924537ec59c389839` (PR #280 integrata, lint e due scenari compatibilità PASS). Candidato di promozione da main: preservare byte per byte sorgenti `src/`, prove, plugin nativi, preparazione e firma, asset e invarianti; nessuna modifica al formato dati o all'identità Android professionale. Le procedure di collaudo isolate rimangono nel laboratorio, non nella promozione.

## Perimetro

- Packaging professionale non firmato: `it.trama.registrodocente`, 10003, `0.1.0-beta.2-rc.1`; non è un rilascio. La configurazione B4.3 resta nel laboratorio.
- Workflow permanenti: contratti e Chromium (ex riferimento, ora PR su main), Browser Qualification storico con test sessione, compatibilità RC2 su IndexedDB/WebCrypto reale, workflow packaging e invarianti. Il controllo coverage impedisce omissioni/duplicazioni fra i due workflow browser di riferimento.
- Esclusioni (conservate integralmente nel laboratorio `e622506852fb9a7bb68eb5d924537ec59c389839`):
- `.github/workflows/beta2-native-upgrade.yml`
- `.github/workflows/beta2-update-readiness.yml`
- `.github/workflows/nav-restore-01-diagnostic.yml`
- `.github/workflows/sec-session-01-manual-lock.yml`
- `.github/workflows/sec-session-01-quiescence.yml`
- `.github/workflows/sec-session-01-suspension.yml`
- `.github/workflows/sec-session-final-boundary.yml`
- `mobile/android-probe/prepare-b43-lab.mjs`
- `scripts/diagnostics/back-exact-apk.mjs`
- `scripts/diagnostics/backup-b43-exact-apk.mjs`
- `scripts/diagnostics/beta2-native-upgrade.py`
- `scripts/diagnostics/prepare-b43-emulator.sh`
- `scripts/diagnostics/run-back-exact-apk.sh`
- `scripts/diagnostics/run-backup-b43-exact-apk.sh`
- `scripts/diagnostics/run-sec-session-final-boundary.sh`
- `scripts/diagnostics/run-sec-session-native-qualification.sh`
- `scripts/diagnostics/sec-session-final-boundary.mjs`
- `scripts/diagnostics/sec-session-native-qualification.mjs`
- Il workflow NAV-CONTEXT isolato torna alla versione main precedente: il gate Chromium di riferimento conserva la copertura.
- Documenti storici conservati per tracciabilità, non sono autorizzazioni di rilascio.

## Evidenze e decisione

#279: installazione reale RC2 → RC1 su API36, run 43746568018, 6/6 PASS, certificato effimero, UID e data prima installazione invariati. Il binario testato è quello di #278 (`4236d6d7deef630685e3fe8853d64cf91b5dab63`), non il futuro binario di promozione. #277/#280: dieci record cifrati, due scenari cross-version, lint PASS. #274/#275: blocco e Back, navigazione e identificativo sorgente. #276: recupero voto accodato in sessione sospesa. #250 rimane laboratorio; non integrarlo direttamente.

Gate: confronto sorgenti esatti e allowlist; qualificazione completa del candidato; APK professionale ricostruito e identificato con SHA sorgente e digest; ripetizione dell'upgrade sul nuovo APK in laboratorio con firma sintetica; qualifica nativa residua su candidato effettivo e HPR mirata offline, blocco/ripresa, PDF, restore, onboarding e aggiornamento. Firma proprietaria solo locale con precedente APK e certificato corrispondente, previa verifica della versione installata. No main merge automatico, no tag, no pubblicazione, no dati reali, nessun APK firmato da CI distribuito. La prova nativa precedente riguarda una classe sintetica, non tutti i record su Android; la prova storage copre dieci record separatamente.
