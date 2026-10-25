# LIB — Post-LIB-06A End-to-End Audit

**Data:** 2026-10-25  
**Repository:** `antoniocorsano-boop/registro-docente`  
**Audit baseline:** `main@4e370d214cc2ec6ff00a2032667d7697a7f6e868`  
**Origin contract:** `docs/superpowers/specs/2026-10-24-lib-01-private-library-contextual-ingest-design.md`  
**Status:** AUDIT COMPLETE / NEXT PRODUCT BOUNDARY PROPOSED / DOCS ONLY

## 1. Executive ruling

The Library program is now technically strong in the areas that are hardest to retrofit later: local-first persistence, heterogeneous intake, privacy classification, governed provider boundary, explicit human confirmation, teaching/planning context, deterministic relevance, local semantic retrieval, shared Contextual Copilot Core consumption and local intent discovery.

The next limiting factor is **not missing AI infrastructure**. It is the interaction architecture.

After LIB-06A the product exposes two partially overlapping transformation surfaces:

1. `LibrarySourceCard` after `Usa`, with teaching-context selection, relevance, proposal panel and contextual actions;
2. global `LibraryCopilotComposer`, with source selection/acquisition, free text, local intent discovery, LINK and PREPARE handoff.

This duplication weakens the original LIB-01 mental model:

`Porto dentro qualcosa -> scelgo cosa voglio farne -> vedo una proposta -> decido se usarla -> la fonte resta disponibile.`

The recommended next boundary is therefore **consolidation before expansion**: make the contextual copilot the single transformation surface, pass it an explicit visible launch context, keep the Library surface focused on source memory/management/retrieval, and establish an intent-evaluation corpus before adding more intents or a heavier local model.

## 2. Baseline verified

Current `main` is:

`4e370d214cc2ec6ff00a2032667d7697a7f6e868`

It is the merge of PR #59 / LIB-06A. The qualified candidate was `cc6d086ebb720f2b539fe6a91f161483b32d398b`; Browser Qualification #391 passed 41/41 Chromium journeys and post-merge PREDEPLOY #683 passed.

LIB-06A adds local text-intent routing for exactly:

- `REVIEW`
- `LINK`
- `PREPARE`

`SUMMARIZE` remains out of text-intent routing. Discovery does not authorize or mutate. LINK remains Core-governed with human confirmation. PREPARE only hands off to the existing proposal flow.

## 3. What is complete and should not be reopened

### 3.1 Source foundation and intake — STRONG

Current intake supports:

- image/photo;
- general file;
- web URL with optional captured text;
- text;
- note;
- concept;
- internal derived material.

Limits and behavior are explicit: 8 MiB source ceiling, 256 KiB text ceiling, URL restricted to HTTP(S), no arbitrary page crawling, locally readable text formats extracted locally, source retained even when extraction is unavailable.

**Ruling:** do not redesign the source domain or build a second ingestion engine.

### 3.2 Persistence, reversibility and privacy — STRONG

The source stays in the encrypted/local application snapshot, survives backup/restore, and durable mutations publish only after persistence. Unknown/student-personal material remains fail-closed for remote use; provider use is governed separately from local storage.

**Ruling:** preserve this boundary exactly.

### 3.3 Teaching and Planning Context — STRONG FOUNDATION

Teaching Context is deterministic and teacher-overridable. Planning Context is a separate fail-closed bridge. Neither the relevance resolver nor intent routing acquires curricular authority.

**Ruling:** keep context authority separate from the copilot and from relevance ranking.

### 3.4 Relevance, semantic retrieval and intent discovery — CORRECTLY SEPARATED

Three different problems are currently represented by three different mechanisms:

- `relevanceResolver.ts`: where this source may be useful (`UDA` / `lesson`), deterministic and explainable;
- `semanticRetrieval.ts`: which Library sources match a search query by meaning, explicitly invoked and local-provider-only;
- local IntentPort: what the teacher is asking the copilot to do (`REVIEW` / `LINK` / `PREPARE`).

**Ruling:** this separation is an architectural invariant. Do not reuse LIB-03B as an intent classifier and do not turn semantic retrieval into hidden intent routing.

### 3.5 Shared Core authority — STRONG

The consumer uses `@trama/contextual-copilot-core@0.3.0` and the qualified `@trama/contextual-copilot-intent-embedding@0.1.0` adapter. Intent discovery narrows user intent; it cannot create capability. LINK still passes through Core policy/dispatch and explicit teacher confirmation.

**Ruling:** no new local policy engine and no Registro-specific authorization layer.

## 4. Findings

Severity here means product/architecture priority, not security severity.

### F1 — HIGH — Two transformation surfaces now compete

`LibrarySourceCard` currently does much more than source management. After `Usa` it:

- proposes or lets the teacher select Teaching Context;
- renders `LibraryRelevancePanel`;
- renders `LibraryProposalPanel` directly when context is valid;
- resolves Core context actions;
- implements REVIEW disclosure;
- implements LINK confirmation.

The global Composer independently provides source selection/acquisition, intent discovery, LINK and PREPARE.

This is a real post-LIB-06A architecture debt: future capabilities would need to decide which surface owns them or be duplicated.

**Ruling:** Library cards should remain the source-memory surface. Transformation should converge on the contextual copilot.

### F2 — HIGH — Global copilot is not yet bound to the exact work surface

`LibraryCopilotComposer` is mounted globally for teacher mode, but App passes only:

- Library;
- UDA collection;
- Planning state;
- current class name.

It does not receive an explicit current surface, selected UDA, selected lesson or selected activity from the place where the teacher opened it. It therefore derives context from current class + deterministic current-date suggestion.

This is useful fallback behavior, but it is weaker than the origin requirement "contesto prima delle funzioni" and can become surprising when the teacher is editing a specific artefact.

**Ruling:** introduce an explicit, minimal, visible `CopilotLaunchContext`. Fallback suggestion may remain, but explicit launch context must win and be changeable/clearable.

### F3 — HIGH — PREPARE leaks through progressive disclosure

Inside the current Composer, the PREPARE section is rendered whenever:

`selectedSource && resolvedTeachingContext && proposalUda`

This is independent of the discovered message intent. The teacher can therefore see/open PREPARE even after asking for REVIEW or LINK, or without asking for PREPARE.

The source-card flow also renders `LibraryProposalPanel` directly whenever context is available.

**Ruling:** proposal generation must be disclosed by explicit PREPARE intent/action, not merely by the existence of context.

### F4 — MEDIUM/HIGH — REVIEW is semantically weak

In the Composer, REVIEW can be resolved but is presented as a non-clickable label. In `LibrarySourceCard`, REVIEW opens mainly metadata/context/privacy/link information. That is useful, but it is closer to "controlla contesto e privacy" than a pedagogical review of the source.

**Ruling:** either narrow/rename REVIEW truthfully or implement a real local review contract. Do not imply deeper pedagogical analysis than the system performs.

### F5 — HIGH before expanding intents — No calibrated teacher-utterance corpus

The current consumer catalog is intentionally small and the local embedding is deterministic feature hashing. Known journeys pass, but there is not yet a broad reference set of realistic Italian teacher utterances covering:

- paraphrases;
- typos/noisy text;
- short commands;
- mixed intents;
- near-neighbor intents;
- unsupported requests;
- hard-negative out-of-scope requests.

The adapter default similarity is `0.75`; the Registro consumer currently sets `0.55`, while retaining the adapter margin default `0.08`. Those values have causal product evidence for the current browser cases, but not yet corpus-level calibration evidence.

**Ruling:** build the corpus and evaluator before adding intents or lowering thresholds again.

### F6 — MEDIUM — Source retrieval is not handed into the Copilot

LIB-05A semantic retrieval is an explicit secondary disclosure in `LibraryView`. The global Composer, however, selects a source with a flat `<select>` over the entire Library.

This works with a small Library but does not scale to a teacher's long-term source memory.

**Ruling:** add a secondary "Trova nella Biblioteca" handoff in the Copilot, reusing the existing retrieval engine. Retrieval remains separate from intent classification and must never run embeddings on each keystroke.

### F7 — MEDIUM — Provenance exists technically but is not teacher-visible enough

`LibrarySource.provenance` stores `derivedFromSourceId` and generation metadata. Current source cards show origin/URL but not a clear `Derivato da ...` path for generated internal materials.

**Ruling:** add compact progressive provenance disclosure before expanding the transformation catalog.

### F8 — MEDIUM/LATER — Existing Registro material is not a general source intake

The original contract included material already present in Registro. `internal` is currently used for adopted generated material, but there is no general command that turns an arbitrary existing Registro artefact into a reusable `LibrarySource`.

**Ruling:** valid gap, but not before single-surface consolidation.

### F9 — LATER / BLOCKED — `activity` link type exists without canonical activity identity

`LibrarySourceLink` permits `activity`, but current relevance candidates deliberately stop at `uda | lesson`. No reliable canonical activity entity/ID is available across the current operational model.

**Ruling:** do not fake an activity target. Define canonical activity identity first.

### F10 — LATER — Advanced transformations and multi-source remain correctly deferred

The origin vision includes Level-2 transformations, Level-3 refinement, variants and multi-source derivation. These should not be added while the primary interaction surface is duplicated and intent quality has no corpus-level evidence.

## 5. Research synthesis

### 5.1 Progressive disclosure supports consolidation

Nielsen Norman Group's progressive-disclosure guidance recommends showing a small number of important choices first and revealing specialized options on request. This supports a source-memory Library plus one contextual transformation surface; it argues against rendering proposal controls everywhere context happens to exist.

Source: https://www.nngroup.com/articles/progressive-disclosure/

### 5.2 Human-AI guidance supports explicit context and abstention

Microsoft's Human-AI Interaction Guidelines recommend timing services based on context, showing contextually relevant information, supporting invocation/dismissal/correction and scoping services when in doubt. The HAX guidance specifically recommends disambiguation or graceful degradation under uncertainty.

Sources:
- https://www.microsoft.com/en-us/research/articles/guidelines-for-human-ai-interaction-eighteen-best-practices-for-human-centered-ai-design/
- https://www.microsoft.com/en-us/haxtoolkit/guideline/scope-services-when-in-doubt/

### 5.3 PAIR supports partial automation and human takeover

Google's People + AI Guidebook recommends supervising automation, starting from lower automation, and giving control back when automation fails. This matches the existing Core/human-confirmation architecture and argues against auto-running transformations from intent discovery.

Sources:
- https://pair.withgoogle.com/guidebook-v2/patterns
- https://pair.withgoogle.com/guidebook-v2/chapter/feedback-controls/
- https://pair.withgoogle.com/chapter/errors-failing/

### 5.4 Education guidance supports privacy and human agency

UNESCO's guidance for GenAI in education emphasizes human-centred adoption and data-privacy protection. The current local-first intake/intent path and one-shot provider boundary are therefore strategic strengths rather than temporary implementation details.

Source: https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research

### 5.5 Intent research supports OOS corpora and clarification, not threshold guessing

Recent intent-recognition research treats out-of-scope detection as essential. NAACL 2024 work on conformal intent classification shows that targeted clarification can help ambiguous requests; LREC-COLING 2024 research highlights threshold-based OOS detection and the difficulty of hard-negative OOS examples.

Sources:
- https://aclanthology.org/2024.findings-naacl.156/
- https://aclanthology.org/2024.lrec-main.763/
- https://aclanthology.org/2024.lrec-main.674/

**Product consequence:** first build a realistic teacher-utterance reference set and measure abstention/confusion. Clarification is a later governed enhancement for genuine ambiguity; unsupported requests should remain no-match.

### 5.6 A heavier on-device model is technically possible but not justified yet

Transformers.js can run models directly in-browser using WASM or WebGPU, including quantized models. WebGPU support is broad but not universal, and model download/runtime cost would be material on mobile.

Source: https://huggingface.co/docs/transformers.js/en/index

**Ruling:** do not replace the current deterministic local feature-hash intent embedding unless the reference corpus demonstrates a material quality ceiling. Model complexity is not currently the proven bottleneck.

### 5.7 Local-first remains aligned with the product

Local-first principles emphasize user ownership, agency, offline resilience, privacy and long-term control. These principles align with the Secure Local Vault and should remain design constraints for source memory and intent discovery.

Source: https://www.inkandswitch.com/essay/local-first/

## 6. Approaches considered

### A. Consolidate before expanding — RECOMMENDED

- one transformation surface: contextual Copilot;
- explicit launch context;
- Library remains source memory/management/retrieval;
- PREPARE only on explicit request;
- truthful REVIEW;
- intent corpus/calibration before new intents;
- retrieval/provenance handoffs next.

**Pros:** directly improves the origin user journey, low architecture risk, avoids feature wall, preserves privacy/authority.  
**Cons:** fewer immediately visible new capabilities.

### B. Add SUMMARIZE/ASK/CREATE now — REJECTED FOR NEXT BLOCK

**Pros:** visible feature growth.  
**Cons:** multiplies duplicate interaction paths, worsens progressive disclosure, expands evaluation surface before current intent quality is calibrated.

### C. Replace local feature hashing with an on-device Transformer now — REJECTED FOR NEXT BLOCK

**Pros:** potentially richer semantic generalization.  
**Cons:** download/runtime/browser-support complexity, mobile cost, and no current evidence that the deterministic model is the limiting factor.

## 7. Recommended next product boundary

Do **not** canonize a `LIB-06B` or `LIB-07` number from this audit alone.

The next boundary should be described by outcome first:

> **Single contextual Copilot workflow:** from any teacher work surface or Library source, pass an explicit source + work context into one Copilot surface; show only the transformation requested or a small contextual suggestion set; retain Core authority and human decision gates.

Break execution into independently reviewable blocks:

1. **Context handoff + single transformation surface**
2. **Intent reference corpus + calibration/abstention**
3. **Library retrieval handoff + visible provenance**
4. **Re-audit, then decide the next capability (likely SUMMARIZE only if justified)**
5. **Separate release/live-verification step after integration**

## 8. Governance findings

### G1 — stale audit PR

PR #53 (`LIB-AUDIT-01`) is still open and Draft against a pre-LIB-04 baseline. Its main findings were useful at the time, but the missing composer/free-text/intent-routing work it proposed has since been implemented through LIB-04/05/06.

**Recommendation:** close PR #53 as `SUPERSEDED` after this post-LIB-06A audit is available for review. Do not merge #53.

### G2 — current-main live verification remains separate

Engineering qualification of current `main` is strong. The last canonical live/public verification receipt in the historical audit predates the later Library program. This is an operational release gap, not a reason to change Library code.

**Recommendation:** after the next consolidated product block is integrated, run a human-approved publication/live-verification cycle on that frozen main. Do not couple deployment to the engineering PR.

## 9. Exit criteria for the next product block

A candidate is acceptable only if:

1. Library cards no longer duplicate the generative proposal surface;
2. Copilot receives explicit visible launch context when opened from a work surface;
3. context can be changed/cleared by the teacher;
4. no-match/ambiguous intent produces no mutation;
5. PREPARE does not appear merely because context exists;
6. LINK retains Core dispatch + explicit human confirmation;
7. provider use still requires the existing disclosure/consent boundary;
8. source/context changes invalidate stale intent/proposal/link state;
9. existing relevance, semantic retrieval and intent classification remain separate;
10. browser qualification covers source handoff + intent + human decision on desktop/mobile;
11. UX-QA-01/02 have no new blocking findings;
12. no deploy/publish occurs as an implicit consequence of merge.

## 10. Canonical audit state proposed

`LIB FOUNDATION + CONTEXT + RETRIEVAL + LOCAL INTENT = ENGINEERING INTEGRATED`

`PRIMARY GAP = INTERACTION CONSOLIDATION + EXPLICIT CONTEXT HANDOFF`

`INTENT EXPANSION = BLOCKED ON REFERENCE-CORPUS EVIDENCE`

`NEXT = SINGLE CONTEXTUAL COPILOT WORKFLOW — DESIGN/PLAN PROPOSED`
