# EDU-PLAN-01C Private Teaching Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher identify a textbook by ISBN and privately retain/analyse a teacher guide or personal PDF/DOCX source without exposing copyrighted source files outside the encrypted local boundary.

**Architecture:** Planning metadata and extracted source structure live inside `PlanningStateV1`; original source bytes live as separately encrypted dynamic vault records keyed by resource ID. Extraction runs locally in the browser. ISBN lookup sends only the normalized ISBN to a metadata service and always has a manual fallback. No book/guide bytes or extracted text are sent to an ISBN provider or AI provider in this tranche.

**Tech Stack:** TypeScript, React, Bun tests, Web Crypto/IndexedDB Secure Local Vault, `mammoth` (existing DOCX extraction), `pdfjs-dist` (new PDF text extraction), Express for the ISBN metadata proxy.

**Spec:** `docs/superpowers/specs/2026-10-24-edu-plan-01-programmazione-didattica-design.md`

## Global Constraints

- ISBN identifies bibliographic metadata; it never grants content access/licensing.
- Source files are private teacher resources and never become student-portal assets.
- No automatic sharing, public library or remote file upload.
- File bytes are encrypted before IndexedDB persistence.
- Extracted content retains source/page/section provenance and source fingerprint.
- Unsupported/encrypted/scanned-image-only PDFs fail clearly; OCR is not silently introduced.
- Resource deletion removes metadata, extracted chunks and encrypted source bytes.
- ISBN lookup failure never blocks manual resource creation.
- No AI-generated interpretation or authoritative curriculum conclusion in this tranche.

## Review Focus

- 30–50 MB guide or malformed PDF → clear size/parse failure without partial “saved” state.
- Browser reload while source save is pending → no metadata record without corresponding encrypted blob.
- Resource deletion fails after metadata removal → transaction/compensation preserves a coherent retry state.
- ISBN provider returns wrong/missing edition fields → teacher sees/editable metadata before acceptance.
- PDF contains no extractable text → mark `textExtractionStatus: 'unavailable'`, retain source privately, do not fabricate content.

---

## File structure

**Create**
- `src/planning/library/isbn.ts`
- `src/planning/library/resourceExtraction.ts`
- `src/planning/library/resourceChunks.ts`
- `src/planning/library/resourceFingerprint.ts`
- `src/components/planning/TeachingLibraryPanel.tsx`
- `src/security/privateResourceBlob.test.ts`
- `src/security/privateResourceExtraction.test.ts`
- `src/security/isbnMetadata.test.ts`
- `src/security/privateResourceBackup.test.ts`

**Modify**
- `package.json` / lockfile — add `pdfjs-dist`; do not add a second DOCX parser.
- `server.ts` — metadata-only ISBN proxy route.
- `src/planning/types.ts`
- `src/security/vaultTypes.ts`
- `src/security/cryptoPrimitives.ts`
- `src/security/vaultStore.ts`
- `src/security/secureVault.ts`
- `src/security/secureAppStorage.ts`
- `src/security/backupPayload.ts` — bump backup format to v4 to include encrypted-resource export material while retaining v3/v2/legacy import.
- `src/components/planning/PlanningProfileView.tsx`
- `src/App.tsx`

### Task 1: Add metadata-only ISBN lookup with manual fallback

**Files:**
- Create: `src/planning/library/isbn.ts`
- Create: `src/security/isbnMetadata.test.ts`
- Modify: `server.ts`

**Interfaces:**
```ts
export function normalizeIsbn(value: string): string;
export async function lookupBookMetadata(isbn: string): Promise<BookMetadataLookupResult>;
```

`BookMetadataLookupResult` is `{ status: 'found'; metadata: BookMetadataCandidate } | { status: 'not_found' }`.

- [ ] **Step 1: Write failing ISBN tests**

Cover ISBN-10/ISBN-13 normalization, invalid checksum/input rejection, provider not-found, partial metadata and network failure. Assert the request payload/query contains ISBN only.

- [ ] **Step 2: Run focused tests**

Run: `bun test src/security/isbnMetadata.test.ts`
Expected: FAIL because lookup/route do not exist.

- [ ] **Step 3: Implement `/api/books/isbn/:isbn`**

Use one allowlisted metadata provider (initially Open Library ISBN metadata) server-side. Return only normalized bibliographic fields: ISBN, title, authors, publisher, publication year/date and cover URL if supplied. Never fetch or proxy full-text/book files.

- [ ] **Step 4: Implement client normalizer/lookup**

Provider failure returns a recoverable result/error that the UI can route to manual entry.

- [ ] **Step 5: Run tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server.ts src/planning/library/isbn.ts src/security/isbnMetadata.test.ts
git commit -m "feat: add ISBN metadata lookup"
```

### Task 2: Add encrypted dynamic resource-blob storage

**Files:**
- Create/modify security files listed above.
- Test: `src/security/privateResourceBlob.test.ts`

**Interfaces:**
```ts
export type PrivateResourceRecordKey = `planningResource:${string}`;
export async function encryptBinaryRecord(...): Promise<EncryptedVaultRecord>;
export async function decryptBinaryRecord(...): Promise<ArrayBuffer>;
```

`SecureVault` produces:
```ts
putResourceBlob(resourceId: string, bytes: ArrayBuffer): Promise<void>;
getResourceBlob(resourceId: string): Promise<ArrayBuffer | null>;
deleteResourceBlob(resourceId: string): Promise<void>;
```

- [ ] **Step 1: Write failing crypto/store tests**

Assert binary round-trip, tamper failure, distinct additional authenticated data per resource ID, list/delete behavior and `clearAll()` deletion.

- [ ] **Step 2: Run focused test**

Run: `bun test src/security/privateResourceBlob.test.ts`
Expected: FAIL.

- [ ] **Step 3: Generalize record-key validation safely**

Keep the fixed application keys explicit while accepting only the `planningResource:<non-empty-id>` dynamic namespace. Do not widen the vault to arbitrary strings.

- [ ] **Step 4: Add binary AES-GCM helpers**

Reuse the current key/IV/AAD scheme; binary helpers differ only in plaintext serialization.

- [ ] **Step 5: Add SecureVault blob methods and store tests**

No plaintext file bytes may be persisted.

- [ ] **Step 6: Run focused + existing vault tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/security
git commit -m "feat: encrypt private teaching resource blobs"
```

### Task 3: Extract PDF/DOCX structure locally with provenance

**Files:**
- Create: `src/planning/library/resourceExtraction.ts`
- Create: `src/planning/library/resourceChunks.ts`
- Create: `src/planning/library/resourceFingerprint.ts`
- Create: `src/security/privateResourceExtraction.test.ts`
- Modify: `src/planning/types.ts`
- Modify: `package.json` / lockfile

**Interfaces:**
```ts
export async function extractTeachingResource(input: {
  resourceId: string;
  fileName: string;
  mediaType: string;
  bytes: ArrayBuffer;
}): Promise<ExtractedTeachingResource>;

export function chunkTeachingResource(extracted: ExtractedTeachingResource): ResourceChunk[];
export async function fingerprintResource(bytes: ArrayBuffer): Promise<string>;
```

Every `ResourceChunk` contains `resourceId`, stable chunk ID, text, page/section reference where available and ordinal.

- [ ] **Step 1: Add failing extraction tests**

Use tiny synthetic PDF/DOCX fixtures committed under `src/security/fixtures/`. Assert page/paragraph provenance, stable chunk ordering, fingerprint stability and explicit no-text state.

- [ ] **Step 2: Run test and confirm RED**

- [ ] **Step 3: Add `pdfjs-dist` and implement PDF extraction**

Do not enable OCR. Preserve page number for each extracted text block.

- [ ] **Step 4: Implement DOCX extraction using existing `mammoth`**

Preserve heading/paragraph order as far as the parser exposes it; never invent page numbers for DOCX.

- [ ] **Step 5: Implement deterministic chunking/fingerprinting**

Chunking must be independent of AI provider and stable for the same extracted representation.

- [ ] **Step 6: Run extraction tests/typecheck**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json bun.lock src/planning/library src/planning/types.ts src/security/privateResourceExtraction.test.ts src/security/fixtures
git commit -m "feat: extract private teaching resources locally"
```

### Task 4: Commit resource metadata + encrypted blob coherently

**Files:**
- Modify: `src/security/secureAppStorage.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/planning/TeachingLibraryPanel.tsx`
- Modify: `src/components/planning/PlanningProfileView.tsx`
- Test: `src/security/privateResourceBlob.test.ts`

**Interfaces:**
App exposes:
```ts
savePrivateTeachingResource(input: PendingPrivateTeachingResource): Promise<PrivateTeachingResource>;
deletePrivateTeachingResource(resourceId: string): Promise<void>;
```

- [ ] **Step 1: Add failing atomicity/compensation tests**

A failed blob write cannot publish resource metadata. A failed planning-state write after blob creation must delete the staged blob or leave it marked as recoverable staging, never visible as a completed library resource.

- [ ] **Step 2: Run focused tests**

- [ ] **Step 3: Implement save/delete orchestration through serialized application tasks**

Reuse the existing durable mutation coordinator; do not use optimistic success messages.

- [ ] **Step 4: Build the library panel**

Flow: ISBN lookup/manual metadata → select private guide/material → local extraction preview → explicit “Salva nella biblioteca privata”. Show file type, fingerprint, extraction status and source-private badge.

- [ ] **Step 5: Run tests/type/build**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/planning src/security/secureAppStorage.ts src/security/privateResourceBlob.test.ts
git commit -m "feat: add private teaching library workflow"
```

### Task 5: Extend encrypted backup to include private resources

**Files:**
- Modify: `src/security/backupPayload.ts`
- Modify: backup preparation/import orchestration in `src/App.tsx`
- Test: `src/security/privateResourceBackup.test.ts`

**Interfaces:**
- Backup v4 contains the complete JSON snapshot plus resource-blob bundle entries keyed by resource ID.
- v3/v2/legacy remain importable and simply contain no source blobs.

- [ ] **Step 1: Write failing round-trip tests**

Export one synthetic source blob + planning metadata, restore into an empty vault, then prove byte equality and resource metadata consistency. Also test missing referenced blob is rejected for v4 rather than reported as restored.

- [ ] **Step 2: Run focused test**

- [ ] **Step 3: Implement v4 bundle creation/import**

The outer backup remains protected by the existing encrypted-backup user flow; do not expose source bytes in ordinary JSON UI/logs.

- [ ] **Step 4: Run full security suite/type/build**

```bash
bun test src/security/*.test.ts
bun run lint
bun run build
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/security/backupPayload.ts src/App.tsx src/security/privateResourceBackup.test.ts
git commit -m "feat: include private resources in encrypted backup"
```

## Tranche exit gate

Browser qualification must prove PDF and DOCX private ingestion using synthetic files, reload/unlock persistence, deletion, ISBN lookup failure→manual fallback, no source bytes in student portal/network requests, and backup/restore survival. No Arena conclusion or AI proposal is produced by this tranche.
