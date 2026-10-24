# UX-TRUST-01 — Full Application Audit Baseline

**Date:** 2026-10-24  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Product source baseline:** `ad4dfcc2fabacbb05ce7d9a080ad06be73de0fed`  
**Public target:** `https://registro-docente.ai.studio`  
**Status:** `AUDIT COMPLETE / REMEDIATION DESIGN DECISION PENDING`

## Purpose

Open a new bounded program after POST-P2 closure to improve mobile usability and analytical trust without reopening persistence, security, or release-integrity work that is already closed.

The audit covers the complete teacher-facing application plus Student Portal. It is evidence-first: no product source was modified to produce these findings.

## Evidence

A dedicated isolated audit branch captured the public deployment with Chromium using synthetic-only browser-local data.

- audit branch: `audit/ux-trust-01-full-app`;
- audit harness SHA: `544e0f24e3614f4710787314d177ff276df7d948`;
- live workflow: `UX-TRUST-01 Full App Audit` #43;
- run: `40060720252`;
- result: **3/3 PASS**;
- mobile viewport: `390×844`;
- desktop viewport: `1280×900`;
- artifact: `12547143322`;
- artifact digest: `sha256:c50f4a08ef85142053d331f8260f7a9640be994ca685f46c55b1ddeb36c5513b`;
- artifact contents: 81 files including top/full/bottom screenshots and structured DOM/layout metrics;
- live assets: `assets/index-BuJkchQK.css`, `assets/index-DsejJ0Zu.js`;
- page errors: 0;
- unexpected console errors: 0;
- root horizontal overflow: none on all audited teacher surfaces in both target viewports.

### Audited surfaces

1. Home / Classi;
2. Riepilogo classe;
3. Valutazioni;
4. Comportamento;
5. Tabellone;
6. Analisi;
7. Storico prove;
8. Scheda alunno;
9. Gestione alunni;
10. Verifiche online;
11. UDA;
12. Impostazioni;
13. Privacy;
14. Privacy Shield state;
15. Student Portal, mobile and desktop.

## What is already healthy

The audit does **not** support a full redesign.

- the public app renders reliably and navigates through the full inventory;
- no document-level horizontal overflow was found at 390 px;
- desktop hierarchy is generally stable;
- Riepilogo classe has a clear KPI/action hierarchy;
- mobile Tabellone already uses dedicated cards rather than shrinking the desktop matrix;
- Analisi and Scheda alunno correctly fail closed when evidence is insufficient;
- Privacy provides the clearest explanation of local-first storage, encrypted vault, LIM shield and encrypted backup;
- Student Portal remains visually isolated in the real viewport. A stitched `fullPage` capture showed underlying document content because the portal is a fixed overlay, but the viewport-at-bottom countercheck remained fully covered by Student Portal. This is a capture artifact, not a demonstrated privacy defect.

## Findings

### P1 — UXTRUST-F01 — Global mobile Vault bar obstructs primary work

**Evidence:** every class-level mobile surface has three persistent layers: sticky header (~65 px), fixed bottom navigation (~53 px) and the fixed Vault control (~302×53 px at approximately y=727 on 390×844). The Vault control sits directly above the bottom navigation and overlays ordinary document content while scrolling.

Observed interference includes Valutazioni, Comportamento, Tabellone, Analisi, Scheda alunno, Gestione alunni, Verifiche online, UDA, Impostazioni and Privacy.

**Root source:** `SecureRegistroRoot.tsx` renders the auto-lock selector + `Blocca Registro` as `fixed bottom-16 md:bottom-3 right-3 z-50` for the whole READY application.

**Required outcome:** security controls remain immediately available without covering task content. Mobile must reserve layout space or use a compact/contextual affordance instead of a floating 302 px toolbar over primary work.

### P1 — UXTRUST-F02 — Backup language contradicts the actual encrypted-backup contract

The product has already moved to encrypted secure backup, but teacher-facing copy still advertises generic/plain JSON in multiple places.

Observed labels:

- Home: `Ultimo backup JSON`, `Esporta Backup JSON`;
- drawer: `Esporta Backup JSON`, `Ripristina da JSON`;
- Settings: `Esporta File Backup (.json)`, `Ripristina Registro da File JSON`, plus prose asking for a JSON backup;
- Privacy correctly describes AES-256-GCM encrypted backup and `.enc.json`.

This is a trust/security UX contradiction even though the actual handlers route to the protected Privacy flow.

**Required outcome:** one vocabulary and one canonical place for backup: `Backup cifrato` / `.enc.json`, with Home/Settings/drawer linking to Privacy instead of implying plaintext JSON export.

### P1 — UXTRUST-F03 — UDA gap severity incorrectly becomes critical whenever no formal test exists

The UI can show `GAP CRITICI` for an UDA that is still active months before its estimated end date while simultaneously saying `Pianificazione in corso` / `Nessuna verifica sommativa ancora registrata`.

**Causal source:** `UdaGanttView.tsx` computes:

`hasCriticalGap = gapCount > 0 && (isEnded || isEndingNow || formalTestSessions.length === 0)`

Therefore *absence of any formal test* alone promotes an otherwise future/open UDA to critical.

**Required outcome:** time-sensitive states must be distinct: `da pianificare` → `in scadenza` → `critico/scaduto`. Lack of a test during an active future UDA must not itself be critical.

### P1 — UXTRUST-F04 — Gap remediation can incentivize creating a grade instead of planning evidence

Several UDA gap recommendations direct the teacher to `Registra una valutazione`, `Inserisci le valutazioni`, or directly navigate to Voti. This can make the indicator feel like a target to satisfy by producing a grade.

**Required outcome:** the primary remediation is professional planning: `Pianifica o collega una prova`, `Collega evidenza esistente`, `Valuta con rubrica quando svolto`. Creating a new grade is an execution option, not the semantic goal.

### P1 — UXTRUST-F05 — Relative weakest competency is presented as an absolute weakness

In `StudentReportView.tsx`, all evaluated competency dimensions are sorted and the last element is always assigned to `growthCompetency` whenever at least three dimensions have evidence. The UI labels it `Area da Consolidare` and recommends reinforcement even when the score is high (observed at 9/10 with all three evidenced dimensions in the highest band).

**Required outcome:** only call a dimension an area to consolidate when an explicit absolute criterion justifies it. When all evidenced dimensions are strong, show `Dimensione relativamente meno forte` or omit the remediation entirely.

### P1/P2 — UXTRUST-F06 — `6 Competenze Chiave` mode can render only three axes without explaining the missing dimensions

The source defines six potential competency dimensions, but `activeRadarData` filters out dimensions without evidence. With only three evidenced dimensions the UI still labels the mode `6 Competenze Chiave`, while the radar physically contains three axes.

**Required outcome:** preserve fail-closed filtering but make evidence coverage explicit, e.g. `Dimensioni di competenza · 3/6 con evidenze`, and list unavailable dimensions rather than implying all six are represented.

### P2 — UXTRUST-F07 — Broad mobile touch-target debt

The audit identified recurring controls materially below a 44 px mobile target in operational areas. High-impact examples include:

- Home destructive class delete icons (~22×22);
- evaluation quick-grade and row controls (~30 px high);
- delayed/recovery toggle (~37×29);
- behavior status chips (~26–27 px high);
- history edit/delete icon buttons (~32×32);
- student delete controls (~28×28);
- UDA temporal shift controls (~22×22) and several action chips around 24–35 px high;
- Settings weight fields around 26 px high;
- Privacy password/input controls around 34 px high.

The audit does not claim WCAG compliance/non-compliance from screenshots alone; it establishes a concrete mobile hit-area risk that needs browser-level keyboard/touch/focus verification after remediation.

### P2 — UXTRUST-F08 — Mobile data presentation still contains desktop-shaped islands

Although the document does not overflow globally, some data sections rely on local horizontal scrolling or dense tabular layouts on phone, including class comparison and the expanded student evaluation dossier.

**Required outcome:** use mobile cards/rows for teacher reading tasks; preserve dense tables on desktop where they are efficient.

### P2 — UXTRUST-F09 — Tabellone duplicates concepts in the unweighted/default mode

Mobile cards show both `Media` and `Indicatore`; in the current unweighted state they frequently repeat the same numeric value. The extra `Indicatore media: VISIBILE` state adds more cognitive load.

**Required outcome:** only expose the analytical indicator when it differs materially or when the teacher explicitly opens analytical detail; keep the primary card focused on the grade history and current average.

### P2 — UXTRUST-F10 — Analytics becomes vertically expensive on mobile

The mobile Analytics document measured roughly 3061 px high with the synthetic 8-student class. Repeated Q1/Q2/Anno/fascia blocks make scanning slow even though the underlying fail-closed mathematics is correct.

**Required outcome:** preserve the class summary first, then use progressive disclosure/search/sort to reveal individual student analytics rather than rendering every analytical card at full prominence.

### P2 — UXTRUST-F11 — UDA exposes two similar internal point scales without enough conceptual separation

The live UDA view shows both an `Indice Attività UDA` (derived as weighted activity hours / 10) and `Punti attività interni` / weighted hours. Example values such as 1.6 pt and 16.3 pt represent related quantities on different scales and are easy to confuse.

**Required outcome:** one primary teacher-facing progress concept. If both values remain, one must be secondary/explanatory and named in a way that makes the mathematical relationship obvious. Neither may resemble certified credits/hours.

### P2 — UXTRUST-F12 — Sufficiency KPI denominator is not visible in the label

Dashboard computes `Tasso Sufficienze` from the percentage of students who have a valid student average and whose average is ≥6. The current card does not state that denominator, so it can be read as percentage of grades or all enrolled students.

**Required outcome:** label or helper text should make the denominator explicit: e.g. `Alunni con media ≥6` and `7 su 8 con media disponibile`.

### P2 — UXTRUST-F13 — Mobile shell status icons are visually cryptic

Privacy Shield and save/sync state are technically exposed with titles/labels, but on mobile the persistent header presents mostly icon/color state. The green save indicator in particular can be read as an unlabeled status light.

**Required outcome:** retain the compact header but provide discoverable text state/tooltip/accessible naming and a consistent explanation of what green/purple states mean.

## Surface health summary

| Surface | Health | Main concern |
| --- | --- | --- |
| Home / Classi | WATCH | legacy JSON backup copy, tiny destructive action, dense comparison |
| Riepilogo | GOOD/WATCH | clear hierarchy; sufficiency denominator and Vault overlay |
| Valutazioni | REWORK | Vault obstruction + small row/quick-entry controls |
| Comportamento | REWORK | very small status chips + Vault obstruction |
| Tabellone | WATCH | good mobile cards; analytical duplication + Vault obstruction |
| Analisi | WATCH | trustworthy fail-closed math; mobile density + Vault obstruction |
| Storico | GOOD/WATCH | clean flow; small edit/delete hit targets |
| Scheda alunno | REWORK | semantic radar/growth issues + deep mobile density |
| Gestione alunni | WATCH | small destructive hit targets + Vault obstruction |
| Verifiche online | WATCH | dense multi-tool surface + Vault obstruction |
| UDA | REWORK | gap severity, remediation semantics, dual point scales, tiny controls |
| Impostazioni | REWORK | backup vocabulary contradiction + small numeric controls |
| Privacy | GOOD/WATCH | strongest security explanation; Vault overlay obscures its own content |
| Student Portal | GOOD | viewport isolation verified; full-page stitching artifact is not a product defect |

## Program boundary

This audit does not authorize implementation yet. `UX-TRUST-01` should remain bounded to teacher-facing trust and mobile usability. It must not reopen persistence architecture, replace the visual identity, change grading mathematics without an explicit semantic requirement, or introduce new infrastructure.

## Remediation strategy options

### Option A — Patch-by-screen

Fix each visible defect where it appears: move the Vault bar, resize controls, rewrite labels, adjust UDA and radar copy.

- advantage: smallest individual diffs;
- disadvantage: repeats responsive and semantic logic across many components and risks drift;
- assessment: **not recommended** for this cross-app pattern.

### Option B — Shared trust/mobile primitives + bounded semantic corrections — RECOMMENDED

Create a small shared layer for the repeated problems, then apply it across screens:

1. one mobile-safe `VaultControls`/security affordance with reserved layout contract;
2. shared minimum-touch control primitives or utility contract for compact buttons/chips;
3. one canonical `Backup cifrato` navigation/copy contract;
4. shared semantic helpers for `gap severity`, `competency evidence coverage`, and `growth recommendation`;
5. targeted responsive cards/progressive disclosure where current tables or long analytical lists remain dense.

- advantage: fixes systemic causes instead of symptoms while keeping the existing product architecture and visual identity;
- disadvantage: slightly broader initial design work;
- assessment: **best balance of reuse, bounded scope and regression control**.

### Option C — Navigation/shell redesign

Rework header, bottom navigation, security state and screen hierarchy as a new mobile shell before touching screen internals.

- advantage: maximum long-term visual simplification;
- disadvantage: high blast radius, unnecessary given that navigation and desktop hierarchy already work;
- assessment: **too broad for the evidence found**.

## Recommended decision

Adopt **Option B** and split implementation into independently qualifiable slices:

- `UXT-A` — mobile shell/Vault obstruction + shared touch contract;
- `UXT-B` — trust vocabulary: encrypted backup + KPI denominator;
- `UXT-C` — analytical semantics: radar coverage + growth-area rule;
- `UXT-D` — UDA semantics: severity states, evidence-planning actions, point-scale simplification;
- `UXT-E` — targeted mobile presentation: assessments/tables/long analytics progressive disclosure;
- `UXT-F` — full mobile/desktop regression + live browser qualification.

Each slice should use causal RED → GREEN, synthetic-only browser evidence, independent review on the same exact SHA, and a separate human integration decision.
