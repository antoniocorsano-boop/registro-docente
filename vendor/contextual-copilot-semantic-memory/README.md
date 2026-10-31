# @trama/contextual-copilot-semantic-memory

Shared, provider-neutral contract for TRAMA local semantic memory.

This package defines a **derived** semantic index boundary. It has **no authority** over canonical professional data: source products remain canonical and consumers may rebuild the index from governed projections at any time.

## Guarantees

- no storage, network client, model runtime or application-specific action logic;
- allowed v1 data classes are `PUBLIC_APP`, `TEACHER_PROFESSIONAL`, `CURRICOLO`, and `AGGREGATED_NON_IDENTIFIABLE`;
- every projection carries source identity, opaque `revision`, and `canonicalRef` provenance;
- mutations use compare-and-swap through mandatory `expectedRevision` (`null` means create-if-absent);
- search hits are relevance evidence only and never authorize dispatch or professional writes;
- consumers remain responsible for data classification, canonical writes, conflict handling, and policy enforcement.

## Consumer flow

A consumer validates a projection, sends an upsert/remove request to a separately qualified local runtime, validates returned envelopes, and resolves every semantic hit back through its canonical object using `canonicalRef` before taking any governed action.
