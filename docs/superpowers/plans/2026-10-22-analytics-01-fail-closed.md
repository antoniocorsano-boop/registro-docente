# ANALYTICS-01 Fail-Closed Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminare ogni dato analitico inventato quando mancano evidenze reali, mantenendo visualizzabili solo le metriche sostenute da dati propri.

**Architecture:** Il cambiamento resta confinato a `AnalyticsView` e `StudentReportView`. Le viste devono propagare `null`/assenza di evidenza fino alla UI, usare stati vuoti espliciti e costruire il profilo competenze solo sulle dimensioni realmente valutate; nessun fallback sintetico o promozione implicita.

**Tech Stack:** React 19, TypeScript, Bun test, Recharts.

**Spec:** design bounded ANALYTICS-01 approvato in chat il 22/10/2026.

## Global Constraints

- Nessun dato inventato e nessun fallback numerico.
- Profilo competenze mostrato solo con almeno 3 dimensioni dotate di evidenze reali.
- Nessuna modifica a nomenclatura D.M. 221, responsive o grafica.
- Nessun merge o deploy incluso.
- Dati parziali ammessi solo quando ogni metrica ha evidenza propria.

## Review Focus

- Studente con zero valutazioni: nessun livello, rischio o profilo sintetico.
- Classe con zero medie valide: nessun `0%` o distribuzione a quattro zeri.
- Una o due dimensioni con prove: mostrare i dati puntuali ma non il radar complessivo.
- Q1/Q2 privo di prove: non derivare il valore dalla media generale.
- Export/scrutinio: `null` deve diventare `Non disponibile`, non `Regolare` o `A rischio`.

---

### Task 1: RED — contratti di integrità dei dati

**Files:**
- Create: `src/security/analyticsDataIntegrity.test.ts`
- Read: `src/components/AnalyticsView.tsx`
- Read: `src/components/StudentReportView.tsx`

**Interfaces:**
- Consumes: sorgenti correnti delle due viste.
- Produces: test che devono fallire sull'head di baseline esclusivamente per i fallback e gli stati sintetici esistenti.

- [ ] Scrivere test per: zero prove; `0/0`; radar sintetico; forza/debolezza fabbricate; `null` classificato nello scrutinio.
- [ ] Eseguire `bun test src/security/analyticsDataIntegrity.test.ts` e verificare RED pulito.
- [ ] Commit test-only.

### Task 2: GREEN — comportamento fail-closed

**Files:**
- Modify: `src/components/AnalyticsView.tsx`
- Modify: `src/components/StudentReportView.tsx`

**Interfaces:**
- Consumes: contratti RED del Task 1.
- Produces: UI che preserva assenza/parzialità dei dati senza inventare metriche.

- [ ] Rendere `suffRate` nullable e visualizzare `—` / `Nessun dato` quando non esistono medie valide.
- [ ] Mostrare stato vuoto per la distribuzione livelli quando non esistono studenti valutati.
- [ ] Rendere `Non disponibile` lo stato scrutinio/export per media assente.
- [ ] Rimuovere tutti i fallback numerici dal profilo competenze e calcolare ogni dimensione solo da prove pertinenti.
- [ ] Mostrare il radar, i conteggi livello e forza/area da consolidare solo con almeno 3 dimensioni valutate.
- [ ] Mantenere Q1/Q2 e singole dimensioni indipendenti dalla media generale.
- [ ] Eseguire il test mirato e ottenere GREEN.
- [ ] Commit implementazione minima.

### Task 3: Verifica bounded

**Files:** nessuna modifica prevista.

- [ ] Eseguire `bun test src/security/*.test.ts`.
- [ ] Eseguire `npx tsc --noEmit`.
- [ ] Eseguire `npm run build`.
- [ ] Verificare diff limitato al piano, al nuovo test e alle due viste.
- [ ] Aprire PR Draft con evidenza RED→GREEN, senza merge e senza deploy.
