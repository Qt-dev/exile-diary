# Eval contract

## Goal

Make the current PoE1 integration compatible with API 3.29 item responses.

## Success criteria

- Modifiers are consumed as text descriptions while retaining flag-based presentation metadata.
- `frameTypeId` is preferred and legacy frames still work.
- Historical stored payloads with string and separate modifier arrays render and parse.

## Integration surfaces

Shared raw-item compatibility adapter; main `Item` model; renderer tooltip and parsed-item store.

## Downstream consumers

Item pricing, parser filters, item tooltips, and persisted raw-data display.

## Required checks

Focused compatibility and renderer tests; `npm run typecheck:main`; `npm run typecheck:renderer`.

## Deliverables

Adapter/types integration, renderer behavior, tests, workflow report.

## Blocking conditions

An API frame identifier cannot be mapped safely, or an existing consumer requires raw structured values instead of descriptions.
