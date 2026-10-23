# MOBILE-TAB-01 — Teacher-first mobile Tabellone design

## Intent
Eliminare la dipendenza dallo scroll orizzontale del Tabellone su smartphone, mantenendo intatta la matrice desktop e senza alterare dati, medie o indicatori.

## Evidence
Nella baseline `main@804f98f916f9aaaa34915fd3a63951439c4f6ea6`, la vista cronologica dichiara colonne fisse per almeno 410 px prima delle colonne delle prove (`Alunno 150 + MEDIA 70 + IND. MEDIA 110 + Trend 80`). Su viewport 360–390 px lo scroll orizzontale è strutturale.

## Goals
- Sotto `md`: una card verticale per studente, leggibile senza scroll orizzontale.
- La card mostra nome, media, indicatore matematico opzionale, trend compatto e voti pertinenti alla modalità selezionata.
- Il nome/scheda resta l'accesso al report studente.
- I voti secondari usano progressive disclosure, non una mini-tabella orizzontale.
- Da `md` in su: la tabella esistente resta funzionalmente invariata.

## Non-goals
- Nessuna modifica a formule, pesi, soglia 6/10 o semantica deliberativa.
- Nessuna modifica a persistenza, Vault, Analytics, UDA o navigazione globale.
- Nessun intervento COPY-01 o UDA-SEM-01 in questo task.

## Approaches considered
1. Ridurre larghezze/padding della tabella: respinto, conserva il problema strutturale.
2. Scroll orizzontale più evidente: respinto, migliora discoverability ma non l'uso in aula.
3. Dual rendering responsive: scelto. Card `< md`, matrice `>= md`; separa i due casi senza degradare desktop.

## Mobile card contract
- Container mobile: `md:hidden`, `space-y-3`, nessun overflow orizzontale proprio.
- Ogni studente: card con pulsante/intestazione `min-h-[44px]` che apre il report.
- Sintesi sempre visibile: media; indicatore solo se `showProposedGrade`; Sparkline trend.
- `cron`: elenco verticale delle prove filtrate, con data/tipologia/voto.
- `type`: medie verticali per tipologia con conteggio prove.
- `avg`: Q1, Q2, media anno e indicatore opzionale.
- Desktop wrapper: `hidden md:block overflow-x-auto` e markup tabellare esistente.
- Stato vuoto coerente con l'attuale `Nessun alunno presente in questa classe.`

## Qualification
TDD RED→GREEN, full PREDEPLOY, browser reale 360 px e 390 px, verifica desktop 1280 px, review indipendente Codex. Nessun merge/deploy automatico.
