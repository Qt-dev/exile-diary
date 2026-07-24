# Result 02: renderer

## Summary

Updated tooltip and renderer item normalization for structured API modifiers and `frameTypeId`.

## Handoff

- Summary: Tooltip renders modifier descriptions and uses crafted/fractured flags for styling.
- Changed surfaces: tooltip and renderer item domain store.
- Contracts satisfied: legacy separate modifier arrays remain fallback-only for historical payloads.
- Assumptions: mutation/vestigial flags require no current CSS treatment.
- Local checks: renderer typecheck passed.
- Integration evidence: renderer tooltip tests passed.
- Risks: pre-existing React test warnings remain.

## Files changed

- `src/renderer/components/Item/ItemTooltip.tsx`
- `src/renderer/stores/domain/item.ts`
