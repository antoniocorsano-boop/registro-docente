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

- [x] Scrivere test per: zero prove; `0/0`; radar sintetico; forza/debolezza fabbricate; `null` classificato nello scrutinio.
- [x] Eseguire la suite di sicurezza e verificare RED pulito: 75 PASS / 5 FAIL, tutte e sole ANALYTICS-01; typecheck, build e smoke PASS.
- [x] Commit test-only: `0883241be1e954da707414e78380fa5d764e72af`.

### Task 2: GREEN — comportamento fail-closed

**Files:**
- Modify: `src/components/AnalyticsView.tsx`
- Modify: `src/components/StudentReportView.tsx`

**Interfaces:**
- Consumes: contratti RED del Task 1.
- Produces: UI che preserva assenza/parzialità dei dati senza inventare metriche.

- [x] Rendere `suffRate` nullable e visualizzare `—` / `Nessun dato` quando non esistono medie valide.
- [x] Mostrare stato vuoto per la distribuzione livelli quando non esistono studenti valutati.
- [x] Rendere `Non disponibile` lo stato scrutinio/export per media assente.
- [x] Rimuovere tutti i fallback numerici dal profilo competenze e calcolare ogni dimensione solo da prove pertinenti.
- [x] Mostrare il radar, i conteggi livello e forza/area da consolidare solo con almeno 3 dimensioni valutate.
- [x] Mantenere Q1/Q2 e singole dimensioni indipendenti dalla media generale.
- [ ] Eseguire il test mirato e ottenere GREEN.
- [x] Commit implementazione minima: `e8933eaffece0a1681cf51d3c1b2b80a1104d9c6`.

### Task 3: Verifica bounded

**Files:** nessuna modifica prevista.

- [ ] Eseguire `bun test src/security/*.test.ts`.
- [ ] Eseguire `npx tsc --noEmit`.
- [ ] Eseguire `npm run build`.
- [ ] Verificare diff limitato al piano, al nuovo test e alle due viste.
- [x] Aprire PR Draft con evidenza RED→GREEN, senza merge e senza deploy: PR #6.
