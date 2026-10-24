# LIB-01A Private Library Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the durable, private, teacher-owned library that can capture heterogeneous sources, persist them in the Secure Local Vault, link them to UDA/lessons, search them, and restore them from encrypted backup without introducing AI-provider coupling.

**Architecture:** Add a `library` domain with a versioned `LibraryStateV1`, store it as one governed logical dataset in `SecureAppStorage`, and expose mutations through the same durable-write semantics used by existing UDA/settings data. The first increment stores source content locally and gives the teacher a simple library surface; contextual/copilot behavior is intentionally deferred to LIB-01B so the Registro does not reimplement the cross-app Contextual Copilot Core.

**Tech Stack:** React 19, TypeScript, Bun tests, Vite, Secure Local Vault / Web Crypto, Tailwind CSS, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-24-lib-01-private-library-contextual-ingest-design.md`

## Global Constraints

- Private by default: a source is persisted locally and never sent to a provider as a side effect of capture.
- No canonical UDA/lesson mutation occurs while capturing, linking, searching, or previewing a source.
- Preserve existing durable-write semantics: no success before persistence commits; failure keeps retry state available.
- Preserve fail-closed data-flow policy; `STUDENT_PERSONAL` and `SECRET` remain denied for remote providers.
- Fail-closed intake: arbitrary teacher-provided text, notes, concepts and web sources start with privacy `unknown`; local capture alone never upgrades them to `teacher-professional`.
- No new package dependency in LIB-01A.
- Do not build a Registro-specific copilot/action resolver in this plan.
- Library entry is available from the secondary drawer under `Didattica e strumenti`; do not add it to the primary class workflow bar.
- Backup remains encrypted and must include the complete library once `library` becomes canonical.
- Existing backup v2/v3 imports remain supported.
- No merge, deploy, or publication is implied by this plan.

## Review Focus

- Oversized image/file: reject before committing anything and leave the capture form usable for retry.
- Malformed or unsupported source payload during restore: reject the candidate backup rather than silently dropping the source.
- Delete while a save is pending: serialize through the existing vault mutation contract; never resurrect a deleted source from a stale write.
- Link to a missing UDA/lesson: keep the source intact, surface the dangling link for repair, and never delete the source.
- Library search with empty/whitespace query: return the default recent list, not an empty result caused by tokenization edge cases.

---

### Task 1: Define the versioned private-library domain

**Files:**
- Create: `src/library/types.ts`
- Create: `src/library/emptyLibraryState.ts`
- Test: `src/library/types.test.ts`

**Interfaces:**
- Produces: `LibrarySourceKind`, `LibrarySourceStatus`, `LibraryPrivacyStatus`, `LibrarySourceLink`, `LibrarySourcePayload`, `LibrarySource`, `LibraryStateV1`, `createEmptyLibraryState()`.
- Later tasks consume `LibraryStateV1` as the only canonical library dataset.

- [ ] **Step 1: Write the failing domain-shape test**

Assert that `createEmptyLibraryState()` returns exactly:

```ts
{
  schemaVersion: 1,
  sources: []
}
```

and that a representative source can express:

```ts
kind: 'image' | 'file' | 'web' | 'text' | 'note' | 'concept' | 'internal'
status: 'captured' | 'ready' | 'needs-review' | 'restricted' | 'failed'
privacy: 'unknown' | 'teacher-professional' | 'student-personal'
```

with zero or more links whose target is `uda`, `lesson`, or `activity`.

- [ ] **Step 2: Run the test and verify RED**

Run: `bun test src/library/types.test.ts`

Expected: FAIL because the library domain files do not exist.

- [ ] **Step 3: Implement the domain types**

In `src/library/types.ts`, define:

```ts
export type LibrarySourceKind = 'image' | 'file' | 'web' | 'text' | 'note' | 'concept' | 'internal';
export type LibrarySourceStatus = 'captured' | 'ready' | 'needs-review' | 'restricted' | 'failed';
export type LibraryPrivacyStatus = 'unknown' | 'teacher-professional' | 'student-personal';

export interface LibrarySourceLink {
  targetType: 'uda' | 'lesson' | 'activity';
  targetId: string;
}

export interface LibrarySourcePayload {
  mimeType?: string;
  text?: string;
  dataUrl?: string;
}

export interface LibrarySource {
  id: string;
  kind: LibrarySourceKind;
  title: string;
  capturedAt: string;
  origin?: string;
  sourceUrl?: string;
  payload: LibrarySourcePayload;
  extractedText?: string;
  status: LibrarySourceStatus;
  privacy: LibraryPrivacyStatus;
  links: LibrarySourceLink[];
  notes?: string;
}

export interface LibraryStateV1 {
  schemaVersion: 1;
  sources: LibrarySource[];
}
```

In `src/library/emptyLibraryState.ts`, export `createEmptyLibraryState(): LibraryStateV1`.

- [ ] **Step 4: Run the domain test and verify GREEN**

Run: `bun test src/library/types.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/library/types.ts src/library/emptyLibraryState.ts src/library/types.test.ts
git commit -m "feat: add private library domain"
```

---

### Task 2: Make the library a first-class Secure Local Vault dataset

**Files:**
- Modify: `src/security/vaultTypes.ts`
- Modify: `src/security/secureAppStorage.ts`
- Modify: `src/security/secureAppStorage.test.ts`
- Modify: `src/App.tsx`
- Test: `src/security/lib01LibraryStorageContract.test.ts`

**Interfaces:**
- Consumes: `LibraryStateV1`, `createEmptyLibraryState()` from Task 1.
- Produces: `SecureAppSnapshot.library`, `CompleteSecureAppSnapshot.library`, `SecureAppStorage.saveLibrary()`, `SecureAppStorage.saveLibraryAndMeta()`.

- [ ] **Step 1: Write the failing storage-contract test**

Assert that:

```ts
VaultRecordKey includes 'library'
SecureAppSnapshot has library: LibraryStateV1 | null
CompleteSecureAppSnapshot has library: LibraryStateV1
SecureAppStorage.loadSnapshot() reads 'library'
SecureAppStorage.saveLibraryAndMeta(library, meta) uses one putMany transaction
restoreSnapshotVerified() includes library in write/readback/rollback equality
```

- [ ] **Step 2: Run the storage-contract tests and verify RED**

Run: `bun test src/security/lib01LibraryStorageContract.test.ts src/security/secureAppStorage.test.ts`

Expected: FAIL only on missing library support.

- [ ] **Step 3: Extend the vault key and snapshot types**

Add `'library'` to `VaultRecordKey`, add the library field to both snapshot interfaces, add it to `SNAPSHOT_KEYS`, and include it in every complete-snapshot atomic write/rollback path.

Add exact methods:

```ts
saveLibrary(value: LibraryStateV1): Promise<void>
saveLibraryAndMeta(library: LibraryStateV1, meta: SecureMeta): Promise<void>
```

- [ ] **Step 4: Initialize App state from the snapshot without introducing a parallel store**

In `src/App.tsx`, initialize:

```ts
const [library, setLibrary] = useState<LibraryStateV1>(
  () => initialSnapshot.library || createEmptyLibraryState()
);
```

Do not persist library through `localStorage`, session state, or a second IndexedDB database.

- [ ] **Step 5: Run storage tests and verify GREEN**

Run: `bun test src/security/lib01LibraryStorageContract.test.ts src/security/secureAppStorage.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/security/vaultTypes.ts src/security/secureAppStorage.ts src/security/secureAppStorage.test.ts src/security/lib01LibraryStorageContract.test.ts src/App.tsx
git commit -m "feat: persist private library in secure vault"
```

---

### Task 3: Version encrypted backup for library restore compatibility

**Files:**
- Modify: `src/security/backupPayload.ts`
- Modify: `src/security/backupPayload.test.ts`
- Modify: `src/security/backupRestore.test.ts`

**Interfaces:**
- Consumes: complete snapshot with `library` from Task 2.
- Produces: `BACKUP_DATA_VERSION_V4 = 4`; v4 payload includes library; v2/v3 normalize with `createEmptyLibraryState()`.

- [ ] **Step 1: Write the failing v4 compatibility tests**

Pin these behaviors:

```ts
createBackupPayload(completeSnapshot).backupDataVersion === 4
v4 restore requires a valid LibraryStateV1
v3 restore yields library.schemaVersion === 1 and sources.length === 0
v2 restore yields empty planning and empty library
legacy restore preserves current non-legacy datasets and yields empty library
```

Also add a corrupted-library v4 case that must throw rather than silently discard invalid sources.

- [ ] **Step 2: Run backup tests and verify RED**

Run: `bun test src/security/backupPayload.test.ts src/security/backupRestore.test.ts`

Expected: FAIL because version 4 and library normalization do not exist.

- [ ] **Step 3: Implement v4 normalization**

Add `BACKUP_DATA_VERSION_V4 = 4` and make `createBackupPayload()` emit v4.

Add `isLibraryStateV1(value: unknown): value is LibraryStateV1` that at minimum verifies:

```ts
schemaVersion === 1
Array.isArray(sources)
each source has string id/title/capturedAt, valid kind/status/privacy, payload object and links array
```

Normalize v2/v3 to `createEmptyLibraryState()`.

- [ ] **Step 4: Run backup tests and verify GREEN**

Run: `bun test src/security/backupPayload.test.ts src/security/backupRestore.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/security/backupPayload.ts src/security/backupPayload.test.ts src/security/backupRestore.test.ts
git commit -m "feat: include private library in encrypted backup"
```

---

### Task 4: Add governed source capture and normalization

**Files:**
- Create: `src/library/intake.ts`
- Test: `src/library/intake.test.ts`

**Interfaces:**
- Produces:

```ts
export const MAX_LIBRARY_SOURCE_BYTES = 8 * 1024 * 1024;
export function createTextSource(input: { id: string; title: string; text: string; capturedAt: string; kind?: 'text' | 'note' | 'concept' }): LibrarySource;
export function createWebSource(input: { id: string; title: string; url: string; capturedAt: string; capturedText?: string }): LibrarySource;
export async function createFileSource(input: { id: string; file: File; capturedAt: string }): Promise<LibrarySource>;
```

- Later UI tasks call only these factory functions, not ad-hoc source constructors.

- [ ] **Step 1: Write failing intake tests**

Cover:

- empty text is rejected;
- malformed URL is rejected;
- text, note, concept and web sources default privacy to `unknown` and remain local until policy review authorizes any less restrictive classification; text/note/concept sources use status `ready`;
- file/image capture stores MIME type and a `dataUrl` locally;
- file/image capture defaults privacy to `unknown` and status to `captured`;
- input above `MAX_LIBRARY_SOURCE_BYTES` is rejected before a source object is returned;
- unsupported file MIME type is stored as `file` if size is valid, without pretending extracted text exists.

- [ ] **Step 2: Run intake tests and verify RED**

Run: `bun test src/library/intake.test.ts`

Expected: FAIL because intake helpers do not exist.

- [ ] **Step 3: Implement intake helpers**

Use browser `FileReader` to create `dataUrl` payloads. Do not call remote APIs. Do not add OCR or document parsing in LIB-01A.

Normalize URL with `new URL()` and preserve the exact normalized URL as `sourceUrl`.

- [ ] **Step 4: Run intake tests and verify GREEN**

Run: `bun test src/library/intake.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/library/intake.ts src/library/intake.test.ts
git commit -m "feat: add private source intake"
```

---

### Task 5: Add pure library mutations, linking and search

**Files:**
- Create: `src/library/libraryState.ts`
- Test: `src/library/libraryState.test.ts`

**Interfaces:**
- Consumes: `LibraryStateV1`, `LibrarySource`, `LibrarySourceLink`.
- Produces:

```ts
addLibrarySource(state: LibraryStateV1, source: LibrarySource): LibraryStateV1
updateLibrarySource(state: LibraryStateV1, sourceId: string, patch: Partial<Pick<LibrarySource, 'title' | 'notes' | 'status' | 'privacy' | 'extractedText'>>): LibraryStateV1
removeLibrarySource(state: LibraryStateV1, sourceId: string): LibraryStateV1
linkLibrarySource(state: LibraryStateV1, sourceId: string, link: LibrarySourceLink): LibraryStateV1
unlinkLibrarySource(state: LibraryStateV1, sourceId: string, link: LibrarySourceLink): LibraryStateV1
searchLibrarySources(state: LibraryStateV1, query: string): LibrarySource[]
```

- [ ] **Step 1: Write failing mutation/search tests**

Assert:

- add is immutable and rejects duplicate IDs;
- update preserves payload and links not present in the patch;
- link is idempotent;
- unlink never removes the source itself;
- remove deletes exactly one source;
- search matches title, extracted text, notes, origin, source URL and link target IDs case-insensitively;
- blank search returns sources newest-first by `capturedAt`.

- [ ] **Step 2: Run tests and verify RED**

Run: `bun test src/library/libraryState.test.ts`

Expected: FAIL because the state helpers do not exist.

- [ ] **Step 3: Implement pure state helpers**

No persistence or React calls belong in this file.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `bun test src/library/libraryState.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/library/libraryState.ts src/library/libraryState.test.ts
git commit -m "feat: add private library state operations"
```

---

### Task 6: Wire durable library mutations into App

**Files:**
- Create: `src/persistence/libraryMutation.ts`
- Test: `src/security/lib01LibraryMutationContract.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: pure library helpers from Task 5 and `SecureAppStorage.saveLibraryAndMeta()` from Task 2.
- Produces one mutation entry point used by UI so state is committed only after durable persistence succeeds.

- [ ] **Step 1: Write the failing durable-mutation contract test**

Pin that add/update/link/unlink/delete:

- call `saveLibraryAndMeta(nextLibrary, nextMeta)`;
- do not expose success before the promise resolves;
- preserve current committed React state if the promise rejects;
- increment `meta.changes` only on successful committed mutation;
- serialize with existing pending state so two rapid library mutations cannot commit out of order.

- [ ] **Step 2: Run the contract test and verify RED**

Run: `bun test src/security/lib01LibraryMutationContract.test.ts`

Expected: FAIL because the mutation helper does not exist.

- [ ] **Step 3: Implement `src/persistence/libraryMutation.ts`**

Expose a small helper that receives committed library/meta, a pure mutation function, and a persistence callback; return the committed next state only after persistence succeeds.

- [ ] **Step 4: Integrate App handlers**

Add App-level handlers for add/update/link/unlink/delete and pass pending/error state to the future `LibraryView`.

Do not set `library` optimistically before the durable write completes.

- [ ] **Step 5: Run mutation/security regression tests**

Run: `bun test src/security/lib01LibraryMutationContract.test.ts src/security/persist01hMutationHelpers.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/persistence/libraryMutation.ts src/security/lib01LibraryMutationContract.test.ts src/App.tsx
git commit -m "feat: add durable private library mutations"
```

---

### Task 7: Add the simple private-library surface with progressive disclosure

**Files:**
- Create: `src/components/LibraryView.tsx`
- Create: `src/components/LibrarySourceCard.tsx`
- Test: `src/security/lib01LibraryUiContract.test.ts`
- Modify: `src/types.ts`
- Modify: `src/components/Navbar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: library state, intake factories, App durable mutation handlers.
- Produces: teacher-facing library surface; no AI generation.

- [ ] **Step 1: Write the failing UI-contract test**

Assert source text contains:

- `ActiveTab` includes `'biblioteca'`;
- drawer label `Biblioteca privata` under `Didattica e strumenti`;
- no `Biblioteca privata` button is added to the desktop primary class workflow hub;
- initial LibraryView controls are limited to search, `Aggiungi fonte`, and recent/linked/review status selectors;
- each source card exposes one primary `Usa` action and secondary actions through an overflow/details control;
- advanced transformation labels such as `rubrica`, `debate`, `verifica formativa` are absent from the static LibraryView source.

- [ ] **Step 2: Run the UI-contract test and verify RED**

Run: `bun test src/security/lib01LibraryUiContract.test.ts`

Expected: FAIL because the library UI does not exist.

- [ ] **Step 3: Implement `LibrarySourceCard`**

Render only:

- preview/title;
- source kind;
- origin/date;
- current UDA/lesson links count;
- primary `Usa` button;
- secondary menu/details for rename, link/unlink and delete.

`Usa` must not generate or write anything in LIB-01A. It may select the source and display `Funzioni contestuali disponibili con il copilota` until LIB-01B is integrated.

- [ ] **Step 4: Implement `LibraryView` capture/search flow**

`Aggiungi fonte` expands a compact chooser for:

- foto/file;
- URL;
- testo/appunto/concetto.

After a successful durable save, collapse the capture form and show the saved source. On failure, keep entered text/URL/file selection where the browser permits so retry is possible.

- [ ] **Step 5: Add drawer navigation and App render branch**

Add `'biblioteca'` to `ActiveTab`, add a secondary drawer entry, and render `LibraryView` from `App.tsx`.

- [ ] **Step 6: Run UI and type checks**

Run:

```bash
bun test src/security/lib01LibraryUiContract.test.ts
bun run lint
bun run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/LibraryView.tsx src/components/LibrarySourceCard.tsx src/security/lib01LibraryUiContract.test.ts src/types.ts src/components/Navbar.tsx src/App.tsx
git commit -m "feat: add private library interface"
```

---

### Task 8: Qualify persistence, backup and mobile behavior

**Files:**
- Create: `src/security/lib01IntegratedContract.test.ts`
- Update only if needed for testability: existing files touched by Tasks 1–7

**Interfaces:**
- Consumes the complete LIB-01A implementation.
- Produces exact-SHA qualification evidence; no feature expansion.

- [ ] **Step 1: Add integrated contract coverage**

Pin at least:

- source add → vault save → snapshot reload preserves payload, privacy and links;
- backup v4 → normalize/restore preserves source and links;
- v3 restore yields empty library without failing;
- failed save leaves committed library unchanged;
- delete does not return after a later serialized save;
- blank search returns recent sources.

- [ ] **Step 2: Run complete automated qualification**

Run:

```bash
bun test
bun run lint
bun run build
```

Expected: all PASS.

- [ ] **Step 3: Run browser qualification on production preview**

At minimum verify mobile `390×844` and desktop `1280×900`:

1. add a text source and reload;
2. add an image under the size limit and reload;
3. add a URL;
4. link/unlink a source to an existing synthetic UDA;
5. search and clear search;
6. attempt oversized file and verify no false success;
7. export encrypted backup, remove a source, restore, and verify the source returns;
8. confirm the drawer exposes one `Biblioteca privata` entry while the primary workflow hub remains unchanged;
9. confirm no horizontal overflow and touch-safe controls.

- [ ] **Step 4: Record exact candidate SHA and evidence**

Do not merge or deploy from this task. Hand off the exact SHA for independent review and human decision.
