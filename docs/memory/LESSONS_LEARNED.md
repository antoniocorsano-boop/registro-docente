# Lessons Learned

Ledger append-only delle lesson episodiche. Non riscrivere retroattivamente una lesson per adattarla a nuove conclusioni: aggiungere una nuova capsule o marcare la precedente `SUPERSEDED` con riferimento esplicito.

### LL-001 — Browser gate canonico fuori dalle sandbox conversazionali
- Stato: ACTIVE
- Ciclo/data: MEM-QUAL-01 · 2026-10-23
- Exact SHA/riferimento: baseline `main@023a6a036c4a43b71fcd408f6ecda1d92bf7a787`
- Obiettivo: rendere la qualificazione browser riproducibile e legata al candidato reale.
- Ha funzionato: i cicli recenti hanno mostrato che Chromium reale + preview di produzione + dati sintetici forniscono evidenza utile quando ambiente e candidato sono controllati.
- È fallito: affidare la disponibilità del browser gate canonico a sandbox conversazionali o ambienti non garantiti rende la certificazione non riproducibile e può interrompere il ciclo per ragioni infrastrutturali non legate al prodotto.
- Causa reale: disponibilità e co-locazione delle risorse browser non sono un contratto stabile delle sandbox conversazionali.
- Regola generalizzabile: la certificazione canonica deve usare infrastruttura effimera riproducibile e verificare l'exact candidate SHA; il browser manuale resta diagnostico.
- Recipe: `TR-003 — Stable browser qualification`.
- Non ripetere: dichiarare BROWSER QUALIFIED sulla sola base di una prova in ambiente non riproducibile o non verificato contro l'exact candidate.
- Evidenza: specifica `docs/superpowers/specs/2026-10-23-project-memory-browser-qualification-design.md` e cicli browser PERSIST-01H precedenti.
- Promozione candidata: operating rule — promossa come `OR-004`.
- Sostituita da: —
