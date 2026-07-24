# Result 01: item compatibility

## Summary

Added a shared compatibility adapter and applied it to the main item model, parser data, and pricing path.

## Evidence

`getItemModDescriptions` converts both API 3.29 objects and legacy strings; `getLegacyFrameType` prefers `frameTypeId` then falls back to `frameType`.

## Handoff

- Summary: Consumers retain string modifier arrays; renderer can retain structured flags.
- Changed surfaces: helper, item model, parser, pricing.
- Contracts satisfied: current and historical payload compatibility.
- Assumptions: documented frame IDs map to normalized PoE1 names.
- Local checks: main typecheck passed.
- Integration evidence: focused helper tests passed.
- Risks: unknown future frame IDs fall back to legacy field or unknown rarity.

## Files changed

- `src/helpers/poeItemApi.ts`
- `src/helpers/types.ts`
- `src/main/models/Item.ts`
- `src/main/modules/ItemData.js`
- `src/main/modules/ItemPricer.ts`
