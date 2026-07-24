# Integration

## Accepted

- Shared PoE item compatibility adapter.
- Main parsing/pricing normalization.
- Structured tooltip rendering with flag-based styling.
- Focused compatibility tests.

## Rejected

None.

## Conflicts

None; worker file ownership did not overlap parent integration files.

## Decisions

- Preserve raw stored JSON; normalize only at consumption boundaries.
- Prefer `frameTypeId`, retaining `frameType` as a fallback.
- Keep legacy crafted/fractured arrays solely for historical records.

## Final changes

Main and renderer item consumers now accept API 3.29 modifier objects without changing downstream string-based pricing/filter contracts.

## Verification still needed

None.

## Remaining risks

Future undocumented frame IDs safely use the legacy field when present; otherwise they render as unknown.
