# LIB-02 — Acquisizione e comprensione governata delle fonti

**Data:** 2026-10-25  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Baseline:** `main@3ea4f3396bcd785de89961fee96981b5ff60b968`  
**Stato:** APPROVED FOR IMPLEMENTATION  
**Ambito:** normalizzazione dell'ingresso eterogeneo della Biblioteca privata, senza modificare il contratto di generazione LIB-01E

## Intento

Completare il tratto mancante tra **Aggiungi fonte** e il Copilota contestuale già qualificato. Una fonte deve entrare nel vault con uno stato veritiero, conservare l'originale, esporre una rappresentazione testuale locale quando disponibile e non apparire pronta quando il contenuto effettivo non è stato acquisito.

Il docente deve poter portare foto, PDF, file testuali, URL, articoli/post copiati, appunti e idee senza dover normalizzare manualmente i formati prima del salvataggio. Il runtime multimodale governato di LIB-01E resta l'unico percorso remoto per foto/PDF e non viene duplicato.

## Stato attuale verificato

- `LibrarySource` supporta `image | file | web | text | note | concept | internal`.
- Foto e PDF sono già trasmissibili al runtime multimodale LIB-01E dopo classificazione `teacher-professional`, disclosure provider e consenso one-shot.
- `createFileSource()` conserva il file come `dataUrl`, ma non estrae localmente i file testuali.
- `createWebSource()` oggi assegna `ready` anche a una URL senza testo acquisito; successivamente `buildLibraryProposalRequest()` fallisce perché una fonte web richiede contenuto testuale.
- I test `src/library/*.test.ts` esistono ma PREDEPLOY esegue soltanto `src/security/*.test.ts`; uno dei test di intake è infatti già fuori sincronia con il contratto privacy canonico (`unknown`).

## Principi vincolanti

1. **Local-first.** Nessun materiale lascia il browser durante la semplice acquisizione.
2. **Privacy unknown by default.** Testi, URL e file acquisiti restano `privacy: unknown`; la classificazione professionale continua a essere una decisione umana separata.
3. **Originale preservato.** L'estrazione testuale non sostituisce `dataUrl`, URL originario o altri dati di provenienza.
4. **Stato veritiero.** Una URL senza contenuto acquisito non è `ready`.
5. **No silent truncation.** Il testo oltre il budget governato non viene troncato e presentato come completo.
6. **No arbitrary server fetch.** LIB-02 non effettua fetch server-side di URL fornite dall'utente: evita SSRF, redirect non governati e ambiguità sulla copia effettivamente acquisita.
7. **Reuse, not duplication.** Foto/PDF continuano a usare il provider multimodale già qualificato di LIB-01E.
8. **Progressive disclosure.** La correzione di una fonte web incompleta appare solo quando serve; nessuna nuova parete di funzioni.
9. **Proposta prima della mutazione didattica.** LIB-02 prepara la fonte, non modifica UDA o lezioni.

## Approcci considerati

### A — Nuovo provider di “source understanding”

Un secondo endpoint IA estrarrebbe/sintetizzerebbe ogni fonte prima del Copilota.

**Scartato:** duplica governance, consenso, error taxonomy e provider runtime già presenti in LIB-01E; aumenta superficie dati senza necessità.

### B — Fetch server-side automatico delle URL

Il server scaricherebbe la pagina e ne estrarrebbe il testo.

**Rinviato:** richiede un gateway SSRF-safe con risoluzione DNS/redirect governata, limiti di contenuto e policy di accessibilità. Non è necessario per rendere coerente la prima pipeline LIB-02.

### C — Normalizzazione local-first + completamento esplicito delle URL

File testuali piccoli vengono letti localmente; immagini/PDF restano originali binari; una URL senza testo è `needs-review` e può essere completata incollando il contenuto/estratto effettivamente acquisito.

**Scelto:** minimizza dati e codice, preserva la provenienza, riusa LIB-01E e rende subito utilizzabili i casi più frequenti senza introdurre rete implicita.

## Contratto di intake

### Testo, appunto, concetto

- `status: ready`;
- `privacy: unknown`;
- contenuto in `payload.text`;
- nessun invio remoto durante il salvataggio.

### URL / pagina web

Con testo/estratto acquisito:
- URL normalizzato e conservato;
- testo locale entro `262144` byte UTF-8;
- `payload.text` e `extractedText` valorizzati in creazione;
- `status: ready`;
- `privacy: unknown`.

Senza testo/estratto:
- URL normalizzato e conservato;
- `status: needs-review`;
- nessuna finzione di contenuto;
- il docente può completare successivamente la fonte incollando il testo effettivo.

### File testuale locale

Sono leggibili localmente i MIME `text/*`, `application/json`, `application/xml` e `text/xml`.

Se `file.size <= 262144` byte e il testo normalizzato non è vuoto:
- originale `dataUrl` preservato;
- `payload.text` ed `extractedText` valorizzati;
- `status: ready`;
- `privacy: unknown`.

Se il file testuale supera il budget o è vuoto:
- originale preservato;
- nessun troncamento silenzioso;
- `status: needs-review`.

### Immagine e PDF

- originale `dataUrl` preservato;
- `status: captured` finché non esiste una rappresentazione testuale locale;
- `privacy: unknown`;
- restano utilizzabili dal runtime multimodale LIB-01E solo dopo classificazione e consenso.

### Altri binari

- salvabili entro il limite generale di 8 MiB;
- `status: captured`;
- nessuna promessa di trasformazione remota se il MIME non è ammesso da LIB-01E.

## Completamento di una fonte web

Quando il docente seleziona `Usa` su una fonte web senza testo:

1. il prodotto mostra `Contenuto web non ancora acquisito`;
2. non mostra il pannello `Prepara una proposta didattica`;
3. offre `Aggiungi testo della pagina`;
4. il docente incolla testo/estratto;
5. il salvataggio durevole aggiorna `extractedText` e `status: ready`;
6. solo dopo la fonte rientra nel normale flusso LIB-01C/D/E.

Il salvataggio deve rispettare il coordinatore durevole esistente: nessun successo UI prima del commit.

## Esperienza di acquisizione URL

Nel form `URL` viene aggiunto un campo facoltativo `Testo o estratto della pagina` con copy esplicito:

> Se non lo aggiungi ora, conserveremo l'URL come fonte da completare.

Non vengono introdotti fetch, scraping o navigazione automatica.

## Budget

`MAX_LIBRARY_TEXT_BYTES = 262144` byte UTF-8, allineato al `maxTextBytes` del runtime LIB-01E.

Il limite generale del file resta `8 MiB`.

## Qualità e test

I test `src/library/*.test.ts` diventano un gate PREDEPLOY separato. La loro attivazione deve prima esporre e correggere l'aspettativa storica errata sulla privacy dei testi, senza cambiare il comportamento canonico `privacy: unknown`.

La qualificazione finale richiede:
- PREDEPLOY verde con security + library tests + typecheck + build + production smoke;
- Browser exact-SHA con scenario URL incompleta → completamento → `ready`;
- regressioni LIB-01A…E verdi;
- UX-QA-01 e UX-QA-02 senza finding bloccanti;
- review indipendente terminale senza finding irrisolti.

## Non-obiettivi

- OCR locale;
- estrazione PDF locale;
- fetch automatico di pagine web;
- ricerca semantica;
- `SUMMARIZE` remoto;
- nuove trasformazioni didattiche;
- modifica automatica di UDA/lezioni;
- merge o deploy automatici.

## Criterio di completamento

LIB-02 è qualificabile quando una fonte entra con stato coerente con il contenuto realmente disponibile, i file testuali piccoli diventano utilizzabili senza provider, le URL senza copia non possono raggiungere la preparazione remota come se fossero complete, e il docente può completarle esplicitamente senza perdere URL/provenienza/originale.