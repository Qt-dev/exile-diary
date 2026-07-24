# Orchestration

## Parent critical path

Define and integrate the shared compatibility adapter used by all item consumers.

## Packets

- `01-item-compat`: parent, write-capable, shared adapter and main model.
- `02-renderer`: worker, write-capable, renderer tooltip/store only.
- `03-tests`: worker, write-capable, focused compatibility tests/fixtures only.

## Delegation

Native delegation is enabled by the explicit Ultracode request.

## Agents

Two workers in one implementation wave.

## Delegation limits

Two agents; one implementation wave; parent integration and verification.

## Wait points

Wait after parent adapter is available before resolving worker integration issues.

## Fallback

Parent completes narrowly scoped worker work if a packet is blocked.

## Verification order

Focused tests, main typecheck, renderer typecheck, diff review.
