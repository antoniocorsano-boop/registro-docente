# MOBILE-UX-01 Safe Bottom Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the fixed vault-control bar and mobile bottom navigation from obscuring teacher-facing content or actions.

**Architecture:** Keep both persistent controls fixed and unchanged. Reserve layout clearance once at the `App` shell so every route inherits the safe bottom area without per-screen patches.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Bun tests.

**Spec:** `docs/superpowers/specs/2026-10-23-mobile-ux-01-safe-bottom-controls-design.md`

## Global Constraints
- Baseline is `main@6f7a1f2e4a2f696d81aed3f436d756c4a9074846`.
- Do not change vault behavior, auto-lock timing, bottom navigation behavior, dependencies, configuration, schema, crypto, or persistence.
- Keep vault controls `fixed bottom-16 md:bottom-3` and mobile navigation `fixed bottom-0`.
- Product change is limited to the application-shell bottom clearance.

## Review Focus
- 360–430px mobile widths: final CTA must clear both fixed layers.
- 640–767px widths: clearance must persist until `md`, matching navigation breakpoint behavior.
- Desktop widths: final content must clear the bottom-right vault controls.
- Long translated/teacher-facing lock selector content must not change security behavior.
- Routes with their own bottom CTA, especially `Comportamento`, must remain clickable after scrolling to the end.

---

### Task 1: Reserve persistent-control clearance in the application shell

**Files:**
- Modify: `src/security/p2NavigationVocabularyIntegrity.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: existing fixed mobile navigation (`md:hidden fixed bottom-0`) and vault controls (`fixed bottom-16 md:bottom-3`).
- Produces: application-shell clearance `pb-36 md:pb-20` inherited by every teacher-facing route.

- [ ] **Step 1: Write the failing layout contract**

Change the existing test `content keeps bottom-navigation clearance until the desktop breakpoint` into `content clears bottom navigation and vault controls across responsive breakpoints` and assert:

```ts
expect(app).toContain('pb-36 md:pb-20');
expect(app).not.toContain('pb-16 md:pb-8');
expect(app).not.toContain('pb-36 sm:pb-20');
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `bun test src/security/p2NavigationVocabularyIntegrity.test.ts`

Expected: exactly one failure because `App.tsx` still contains `pb-16 md:pb-8`.

- [ ] **Step 3: Implement the minimal shell change**

In `src/App.tsx`, change only the outer application-shell class from `pb-16 md:pb-8` to `pb-36 md:pb-20`.

- [ ] **Step 4: Verify GREEN and regression safety**

Run the focused test, then all security tests excluding only the sandbox-dependent `outboundBoundaryClosure.test.ts`, then `bun run lint` and `bun run build`.

Expected: 0 failures in the focused and non-SEC3 suites; typecheck/build exit 0.

- [ ] **Step 5: Commit**

Commit test RED separately, then product GREEN separately so the causal sequence remains inspectable.

## Final qualification
- Canonical PREDEPLOY on the exact remote GREEN head must pass all tests including SEC-3, typecheck, build, and production startup smoke.
- Real-browser mobile gate must confirm `Salva Registro Comportamenti` can be scrolled completely above both fixed layers and clicked.
- Desktop gate must confirm bottom content can clear the fixed vault bar.
- Fresh final review must report no unresolved significant finding before integration.
