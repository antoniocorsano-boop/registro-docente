# SEC-SESSION-01 — Contratto di chiusura sessione (S2a)
Baseline 3160a181, HPR REWORK #262. Diagnostica S1 #263 separata.
## Autorità e confini
- SecureRegistroRoot resta l'unico proprietario di chiave, gate e snapshot. Il coordinatore già presente in App serializza le mutazioni; nessun secondo motore.
- Prima della dismissione della sessione: oscuramento immediato della superficie, chiusura sincrona delle ammissioni, attesa limitata delle operazioni già ammesse; il drain segnala solo conclusione, non successo. I chiamanti conservano esiti distinti. Non aprire una sessione nuova mentre una transazione precedente può ancora pubblicare: su scadenza rimanere protetti e richiedere risoluzione/riavvio verificato, non sbloccare alla cieca.
- Bozze: mai promuoverle automaticamente a voti. Uscita volontaria passa dai guard esistenti (salva, resta, scarta esplicito). Per sospensione involontaria con bozza occorre una strategia verificata di recupero protetto; non dichiarare chiuso il requisito con perdita silenziosa o mantenimento indefinito della chiave.
- Android Home/recents/schermo spento e ripresa: autentica con password esistente; la superficie nativa deve essere coperta prima che i dati possano apparire nell'anteprima o al ritorno. Nessuna dipendenza esclusiva da timer JS.
- Picker PDF/backup: separare operazione autorizzata e sospensione ordinaria; legare eccezione all'Activity/risultato esatto, scadenza e cancellazione, niente eccezione globale. Non consentire rientro con sessione sbloccata dopo uscita reale. Conservare integrità del restore e receipt.
- Comando «Blocca ed esci» nel menu, lucchetto esistente invariato nella posizione; non cambiare Back a radice e non forzare stop del processo.
## S2a
Aggiunta sealAndDrain al coordinatore: chiude per sempre le ammissioni, attende settlement della coda, non converte errori in successi e non riapre la vecchia sessione. Nessun collegamento al ciclo Android in questo slice. Test su scrittura e checkpoint in corso, rifiuto nuove ammissioni, fallimento persist, idempotenza e nuova sessione separata.
## S2b/S3 ancora necessari
Integrare autorità, guard, lifecycle, picker, protezione recents, timeout reale e concorrenza unlock/lock; verificare su Android 12/16, non promettere protezione dalla sola S2a. Nessuna modifica all'archivio reale, firma, main o distribuzione.
