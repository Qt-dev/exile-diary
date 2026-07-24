# PoE 3.29 API compatibility

## Goal

Adapt the PoE1 client to the 3.29 item schema while retaining historical saved-item compatibility.

## Success criteria

Structured modifiers render and feed existing pricing/filter logic as descriptions; `frameTypeId` works without `frameType`; focused tests and typechecks pass.

## Current context

The API wrapper and `Item` model assume numeric frames; renderer/parser consumers assume modifier string arrays.

## Constraints

PoE1 only. Do not modify saved raw JSON, credentials, API scopes, or unrelated product behavior.

## Risk level

Medium: shared item data contract across main and renderer.

## Approval gates

None; the work is local and reversible.

## Mode

Delegated, one implementation wave with three bounded packets.

## Work packets

- Parent: shared compatibility adapter and main-model integration.
- Renderer worker: tooltip and renderer item-domain consumption.
- Test worker: fixtures and focused compatibility tests.

## Eval contract

See `eval-contract.md`.

## Integration policy

The parent owns adapter behavior and resolves all cross-packet changes against the official API reference.

## Verification plan

Focused unit tests, renderer tests, then main and renderer typechecks.

## Completion criteria

All consumers accept both legacy and 3.29 payloads, and required checks pass.
