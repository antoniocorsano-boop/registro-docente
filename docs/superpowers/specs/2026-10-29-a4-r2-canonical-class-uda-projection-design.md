# RELEASE-CURRENT-02 / A4-R2 — Canonical Class / UDA Projection design

**Date:** 2026-10-29  
**Status:** selected direction / execution authorized for design+planning only  
**Consumer repository:** `antoniocorsano-boop/registro-docente`  
**Consumer baseline:** `main@a6ede2f1e0c4b72e8594f00025e09b06e9627e5e`  
**Producer repository:** `antoniocorsano-boop/docente-os-2026-27`  
**Producer baseline:** `develop@2b4464a1c18382f887689df175d0da5dfa84d178`  
**Live target:** `https://registro-docente.ai.studio`  
**Trigger:** RELEASE-CURRENT-02 A4 authentic teacher validation after A4-R1 integration — class duplication + Docente OS UDA visibility failure

## 1. Why A4-R2 exists

A4-R1 successfully changed the Copilot entry from source-first to teacher-first, but authentic use exposed a deeper identity problem that A4-R1 was not designed to solve.

The live product can contain:

- a real Registro class named `1A` or `3A`;
- a legacy `UdaRecord.className` such as `1ª A` or `3ª A`;
- teacher-first class discovery that unions `appData.classes[].name` with `udas[].className` and deduplicates only exact strings;
- UDA selection that still relies on exact `uda.className === selectedClassName` matching.

Therefore `3A` and `3ª A` can appear as different classes even when they represent the same professional class, and selecting the real class can make the legacy UDA appear unavailable.

The same audit confirmed a second, independent gap: Registro Docente does not currently consume a governed Docente OS → Registro UDA/class projection. Its cross-product planning contract is Arena → Registro only. The UDA domain visible to Copilot is still the Registro-local `UdaRecord[]` collection.

A4-R2 exists to close these two gaps without deleting data, silently retargeting professional state, or giving Registro write authority over Docente OS.

## 2. Selected approach

Three approaches were considered.

### A. Normalize class labels only inside the Copilot

Example: normalize `3ª A` to `3A`, deduplicate the visible buttons, and continue using legacy UDA strings.

**Rejected as the architectural solution.** It is useful as one ingredient of A4-R2A, but string normalization alone would preserve the wrong authority model: labels would continue to be treated as identity and Docente OS UDA would remain absent.

### B. Connect Registro directly to the live Docente OS database/API

Registro would query the Docente OS runtime or Supabase directly for classes and UDA.

**Rejected for v1.** Registro is local-first and its Secure Local Vault is an explicit privacy/security boundary. A direct network consumer would introduce authentication, availability, remote state, coupling and data-flow decisions that are unrelated to the immediate A4 defect. It would also make the cross-product contract implicit in runtime code.

### C. Canonical local class resolution + versioned read-only Docente OS projection — selected

A4-R2 is split into two independently qualifiable slices:

1. **A4-R2A — Canonical Class Identity Repair**: stop using label strings as class identity inside teacher-first/Copilot read models; reconcile known equivalent labels through a pure, explainable resolver; never merge/delete data automatically.
2. **A4-R2B — Docente OS → Registro Teaching Projection**: define a versioned professional, non-personal, read-only projection contract; export it explicitly from Docente OS; validate/preview/accept it in Registro; persist the accepted projection in the existing encrypted Planning record; expose projected UDA through a unified read model without cloning them into Registro-local `UdaRecord` storage.

The initial transport is an explicit JSON export/import, consistent with the already-integrated Arena → Registro read-only handoff. The contract is transport-independent: a future trusted sync may carry the same payload without changing identity, provenance or consumer semantics.

## 3. Program boundary

A4-R2 is a repair within RELEASE-CURRENT-02. It is not a general cross-product synchronization program.

The target flow is:

`Docente OS canonical class/UDA state -> governed read-only projection -> Registro accepted professional context -> canonical local class resolution -> unified UDA read model -> Copilot/Biblioteca teaching context`

Authority remains split:

- Arena remains curricular authority.
- Docente OS remains authority for its own planning/UDA projection.
- Registro remains authority for Registro-local class/student/evaluation/diary data.
- A4-R2 never writes back to Docente OS.
- Contextual Copilot Core remains authority for shared action authorization.

## 4. Two-slice execution model

### 4.1 A4-R2A — Canonical Class Identity Repair

A4-R2A is Registro-only and must be independently shippable.

It solves the immediate live defect before any cross-repo producer work.

#### Canonical identity rule

For Registro-owned classes, `ClassData.id` is identity.

A human-readable class label is presentation metadata and a reconciliation signal only.

A new pure helper derives a strict semantic key from supported Italian lower-secondary labels, for example:

- `1A` -> `1:A`
- `1 A` -> `1:A`
- `1ª A` -> `1:A`
- `3A` -> `3:A`
- `3ª A` -> `3:A`

The parser MUST fail closed for strings that do not unambiguously encode grade 1..3 plus one section token. It is not a fuzzy matcher.

#### Resolution result

The resolver returns an explicit state, never an arbitrary winner:

```ts
export type CanonicalClassResolution =
  | { status: 'resolved'; semanticKey: string; classId: string; label: string; aliases: string[] }
  | { status: 'ambiguous'; semanticKey: string; candidates: Array<{ classId: string; label: string }> }
  | { status: 'unresolved'; sourceLabel: string };
```

Exact type names may be adjusted during implementation, but the semantics are fixed.

#### Legacy UDA behavior

Legacy `UdaRecord.className` remains unchanged on disk in A4-R2A.

The teacher-first read model resolves legacy UDA to a canonical class candidate through the semantic resolver. It does not rewrite the UDA and it does not rewrite/delete duplicate `ClassData` entries.

If one semantic class resolves to exactly one real Registro class, the UDA is presented under that class regardless of typographic variant.

If multiple real Registro classes share the same semantic key, the resolver returns `ambiguous` and the UI requires teacher disambiguation. A4-R2A must not choose based on array order, UDA presence, student count or visual label preference.

#### Copilot behavior

The teacher-first class picker consumes the canonical class read model rather than concatenating raw class/UDA strings.

The authentic regression is mandatory:

- real classes: `1A`, `1C`;
- legacy UDA: `className = '1ª A'`;
- teacher request: `Attività per le classi prime`;
- class picker shows one `1A` and one `1C`, never a second `1ª A`;
- selecting `1A` exposes the legacy UDA instead of the false “nessuna UDA disponibile” state.

## 5. A4-R2B — Docente OS → Registro Teaching Projection

### 5.1 Contract identity

The v1 contract is:

`DOCENTE_OS_REGISTRO_TEACHING_PROJECTION_V1`

Required envelope fields:

```ts
export interface DocenteOsRegistroTeachingProjectionV1 {
  contract: 'DOCENTE_OS_REGISTRO_TEACHING_PROJECTION_V1';
  contractVersion: 1;
  sourceProduct: 'DOCENTE_OS';
  targetProduct: 'REGISTRO_DOCENTE';
  importMode: 'READ_ONLY_PROJECTION';
  acceptanceRequired: true;
  automaticWriteAllowed: false;
  schoolYear: string;
  disciplineName: string;
  generatedAt: string;
  projectionFingerprint: {
    algorithm: 'sha256';
    hash: string;
  };
  provenance: {
    repository: 'antoniocorsano-boop/docente-os-2026-27';
    sourceCommit: string;
    sourceBranch: string;
  };
  classes: DocenteOsProjectedClassV1[];
  privacyClass: 'PROFESSIONAL_NON_PERSONAL';
}
```

The exact serializer/validation implementation is left to the builder; these field names and values are contract decisions.

### 5.2 Projected class

Each projected class carries stable source identity plus presentation labels:

```ts
export interface DocenteOsProjectedClassV1 {
  sourceSectionId: string;
  grade: 1 | 2 | 3;
  sectionCode: string;
  compactLabel: string;
  displayLabel: string;
  sectionStatus: 'PROVVISORIA' | 'DA_CONFERMARE' | 'CONFERMATA';
  canonicalPlan: {
    code: string;
    assetId: string;
    generationId: string;
  };
  udas: DocenteOsProjectedUdaV1[];
}
```

`sourceSectionId` is the Docente OS `AnnualPlanSection.id`. `compactLabel` and `displayLabel` are presentation only; they do not replace `sourceSectionId` as producer identity.

### 5.3 Projected UDA

The projection exposes enough professional context for selection, relevance and read-only Copilot use without exporting student data or session/evaluation details.

```ts
export interface DocenteOsProjectedUdaV1 {
  sourceUdaRef: string;
  projectedUdaId: string;
  title: string;
  focus: string;
  plannedHours: number;
  period: string;
  packRefs: string[];
  canonicalGenerationId: string;
}
```

`projectedUdaId` is deterministic and collision-resistant within the consumer namespace. V1 uses:

`docente-os:<sourceSectionId>:<canonicalGenerationId>:<sourceUdaRef>`

The producer MUST reject duplicate `projectedUdaId` values in one payload.

### 5.4 Data minimization

The projection MUST NOT contain:

- student names/IDs;
- grades/evaluations;
- behavior records;
- attendance;
- health/SEN/PEI/PDP data;
- session notes that can contain student-personal content;
- arbitrary Library/private-source bodies;
- secrets, tokens or Supabase identifiers not required by the professional contract.

The payload is classified `PROFESSIONAL_NON_PERSONAL`.

## 6. Producer behavior in Docente OS

Docente OS owns projection generation.

The producer reads only current professional planning state:

- current academic year;
- `AnnualPlanSection` identity/grade/section code/status;
- canonical plan source identity;
- canonical UDA segments/blocks needed to derive unique UDA entries;
- discipline metadata needed by the projection.

It does not infer classes from labels and does not query/export student datasets.

V1 exposes an explicit teacher action such as `Esporta per Registro Docente` from the planning/settings surface. Export produces one JSON file and performs no write in Registro.

No background synchronization, webhook, shared login or remote push is introduced by A4-R2B.

## 7. Consumer validation and acceptance in Registro

Registro validates the payload before it can influence any teaching context.

Validation is fail-closed for at least:

- wrong contract/version;
- wrong source/target product;
- import mode other than `READ_ONLY_PROJECTION`;
- `acceptanceRequired !== true`;
- `automaticWriteAllowed !== false`;
- invalid school year;
- missing/invalid provenance source commit;
- non-SHA256 fingerprint shape;
- invalid grade/section identity;
- duplicate source section IDs;
- duplicate projected UDA IDs;
- canonical generation mismatch inside one class;
- unexpected root/class/UDA properties;
- privacy class mismatch.

Before persistence, the UI shows a preview with:

- source commit;
- generated timestamp;
- school year;
- discipline;
- class count;
- UDA count;
- class reconciliation results (`resolved`, `ambiguous`, `unresolved`).

Teacher acceptance is explicit.

Invalid or ambiguous class mapping cannot silently bind a projected UDA to a Registro class.

## 8. Persistence model

The imported projection must survive reload, therefore some durable local state is justified: unlike a derived read model, the external source payload cannot be reconstructed from Registro state alone.

A4-R2B persists the accepted projection inside the existing encrypted `planning` vault record. It does not introduce a new IndexedDB store or plaintext cache.

The implementation SHOULD advance the planning payload to an explicit next schema version rather than silently changing `PlanningStateV1` semantics.

The next version contains at least:

```ts
export interface PlanningStateV2 {
  schemaVersion: 2;
  profiles: TeachingProfile[];
  arenaContexts: ArenaPlanningContext[];
  resources: PrivateTeachingResource[];
  masterPrograms: MasterProgram[];
  classInstances: ClassProgramInstance[];
  docenteOsProjections: AcceptedDocenteOsTeachingProjection[];
}
```

The exact accepted-projection wrapper may additionally store `acceptedAt` and reconciliation decisions.

Compatibility requirements:

- existing v1 planning records normalize losslessly to v2 with `docenteOsProjections: []`;
- encrypted backup/restore remains valid;
- restore verification remains commit-first/atomic;
- the projection is never written into the existing `udas` vault record merely to make old UI code see it.

## 9. Unified UDA read model

A4-R2B introduces a derived read model consumed by teacher-facing context selection.

Conceptually:

```ts
export interface TeachingUdaCandidate {
  id: string;
  origin: 'registro' | 'docente-os';
  classId: string;
  classLabel: string;
  title: string;
  periodLabel: string;
  plannedHours: number | null;
  sourceRef: string;
  writableByRegistro: boolean;
}
```

Registro-local UDA remain `writableByRegistro: true`.

Docente OS projections are `writableByRegistro: false`.

The Copilot, Biblioteca Teaching Context and relevance surfaces may use a projected UDA as professional context after successful class reconciliation.

The projection is not cloned into `UdaRecord` and is not presented as a Registro-authored UDA.

Teacher-facing provenance should be concise, for example `Da Docente OS`.

## 10. Write boundaries for projected UDA

Read-only projection means:

- selecting a Docente OS UDA as context is allowed;
- REVIEW against that professional context is allowed when other policy gates permit it;
- PREPARE may use it as bounded context when the governed provider path is otherwise allowed;
- a Library source may be linked locally to the projected UDA reference because that mutates the teacher-owned Library link, not Docente OS;
- Registro MUST NOT append lessons, rewrite title/content, change planning status, or mark the projected UDA as completed in Docente OS;
- any existing UI outcome equivalent to `Adotta e aggiungi all'UDA` must be unavailable for `writableByRegistro: false` until a separately governed write-back design exists.

A4-R2B introduces no write-back protocol.

## 11. Re-import and staleness

The fingerprint and provenance make repeated import deterministic.

- Same fingerprint already accepted -> idempotent/no duplicate projection.
- New fingerprint for the same school year + discipline -> preview as an update; teacher acceptance required before replacement/activation.
- Old accepted data remains the committed state until the new projection has been durably written and read back.
- Failed persistence cannot publish a success message or replace the current in-memory projection.
- A projection whose class binding is no longer valid after local class changes becomes unresolved/ambiguous at read-model time; it is never silently retargeted.

## 12. Required teacher journeys

### J-R2A1 — legacy label equivalence

`1A` exists as the real class; an existing UDA says `1ª A`. Teacher enters `Attività per le classi prime`, chooses `1A`, and sees that UDA as available. The picker contains no duplicate `1ª A` option.

### J-R2A2 — genuine ambiguity

Two real Registro class records normalize to the same semantic key. The system does not hide/delete either and does not choose one automatically. The teacher receives an explicit reconciliation choice before UDA targeting.

### J-R2B1 — projection import

Teacher exports a synthetic professional projection from Docente OS, imports it into Registro, sees provenance + class/UDA counts, accepts it, reloads/unlocks and still sees the accepted projection.

### J-R2B2 — projected UDA in Copilot

With `1A` reconciled and a Docente OS UDA projected for that class, `Attività per le classi prime` -> `1A` exposes both valid local and projected teaching contexts with provenance. No duplicate class appears.

### J-R2B3 — read-only authority

Projected UDA can be selected for review/preparation context, but no flow can mutate the projected UDA or falsely report a write-back success.

### J-R2B4 — stale update

An accepted projection is followed by a new fingerprint. Before explicit acceptance the old projection remains active. Persistence failure during acceptance leaves the old projection active and retryable.

## 13. Required contract corpus

A shared fixture/corpus must exist in both repositories for contract conformance.

At minimum it contains:

- one canonical positive payload;
- wrong source product;
- wrong target product;
- wrong contract version;
- automatic write enabled;
- acceptance not required;
- invalid provenance commit;
- invalid fingerprint;
- duplicate class ID;
- duplicate projected UDA ID;
- unexpected property;
- invalid grade;
- privacy mismatch;
- one payload containing a prohibited student-personal field and therefore rejected.

Producer and consumer must agree on the same corpus semantics before browser wiring.

## 14. Explicit non-goals

A4-R2 does not:

- merge/delete duplicate Registro classes automatically;
- rewrite existing `UdaRecord.className` values automatically;
- migrate all legacy Registro UDA into Docente OS;
- give Registro write authority over Docente OS;
- add background sync, webhooks or shared authentication;
- query Supabase directly from Registro;
- change Arena curricular authority;
- add new Copilot capability IDs, providers, RAG or multi-source synthesis;
- expose student-personal Docente OS data;
- deploy or publish either product automatically.

## 15. TDD / qualification contract

A4-R2A and A4-R2B are independently qualified.

### A4-R2A minimum gates

1. Pure resolver RED proving `1A` and `1ª A` currently diverge.
2. Ambiguity RED proving multiple real class IDs cannot be auto-selected.
3. Minimal GREEN resolver/read-model wiring.
4. Browser RED/GREEN for the authentic `Attività per le classi prime` journey with a legacy `1ª A` UDA.
5. Historical A4-R1 browser contract remains green.
6. PREDEPLOY exact-SHA PASS.
7. Browser Qualification desktop + 390x844 PASS.
8. UX-QA-01/02 remain PASS with zero blocking findings.
9. Fresh whole-slice review with zero unresolved Important/Critical findings.
10. Separate human integration decision.

### A4-R2B minimum gates

1. Producer contract tests RED before implementation.
2. Consumer contract tests RED before implementation.
3. Shared positive/negative corpus passes byte/semantic conformance in both repos.
4. Docente OS export contains zero student-personal fields and stable provenance/fingerprint.
5. Registro preview/accept persistence is commit-first and survives reload/unlock.
6. v1 planning state normalizes to v2 without data loss.
7. Backup/restore round trip preserves accepted projection.
8. Unified UDA read model exposes projected UDA only after successful class reconciliation.
9. Read-only projected UDA cannot enter a local UDA mutation/write-back path.
10. Browser synthetic export/import -> Copilot selection journey PASS on 390x844 and desktop.
11. PREDEPLOY/Browser exact-SHA PASS in each changed repository.
12. Fresh review in each repository.
13. Separate integration decisions per repository.
14. No deploy/publication until a later explicit decision.

## 16. Exit criteria

A4-R2 is complete when authentic-looking synthetic evidence demonstrates all of the following:

- typographic class variants no longer create duplicate teacher-first class choices;
- ambiguous real duplicates remain explicit and safe rather than silently merged;
- Docente OS can produce a privacy-minimized governed UDA/class projection;
- Registro can validate, preview, accept and durably retain it;
- projected UDA are visible as read-only professional context under the correct real Registro class;
- Copilot/Biblioteca can use that context without cloning or mutating the Docente OS UDA;
- historical A4-R1 authority/privacy behavior remains intact.

The decisive product question is:

> `Quando dico al Registro su quale classe e UDA sto lavorando, vede una sola identità professionale coerente e può usare le UDA che ho già progettato in Docente OS senza costringermi a ricrearle o duplicarle?`
