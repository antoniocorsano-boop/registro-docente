# AI Teacher Copilot v1 — Human Design Approval

**Status:** APPROVED FOR IMPLEMENTATION PLANNING  
**Date:** 2026-10-26  
**Approved design:** `docs/superpowers/specs/2026-10-26-ai-teacher-copilot-v1-design.md`  
**Design branch baseline:** `main@315c467494fbdc7d4185863410483c96dc79899c`

## Human decision

The product direction in the referenced design is approved as the canonical basis for implementation planning.

Approved decisions include:

- two-level architecture: intelligent orchestration + governed generation;
- Copilot as principal but non-exclusive entry point;
- privacy-first as a non-negotiable authority boundary;
- no remote model access to individual student data, including pseudonymized individual data;
- professional memory that is configurable, inspectable, correctable and removable;
- learning from teacher choices without using student-personal data;
- proactive assistance only when relevant, unobtrusive and local-first by default;
- configurable dynamic AI budget with explicit escalation choices;
- autonomous low-risk/privacy-safe actions only; persistent writes remain teacher-confirmed;
- incremental evolution of the existing governed Copilot architecture rather than a separate autonomous agent runtime.

## Planning boundary

This approval authorizes **planning only**. It does not authorize product-code changes, merge, deployment or publication. Each implementation slice remains subject to its own RED→GREEN evidence, exact-SHA qualification, review and separate human integration decision.
