# Orchestration

## Parent critical path

Implement the import/classification correction, truthful run-start result, missing-run persistence guard, tests, and final verification.

## Packets

- `01-test-discovery`: read-only test seam and fixture discovery.
- `02-risk-review`: read-only independent failure-chain and edge-case review.
- `03-implementation`: parent-owned source and test edits.
- `04-integration-verification`: parent-owned integration and checks.

## Delegation

One read-only discovery wave with two agents. No agent owns source edits.

## Agents

- Agent 1: focused test discovery.
- Agent 2: independent risk review.

## Delegation limits

Two agents, one wave. No write-capable agents.

## Wait points

Agent results are required before finalizing tests, but do not block initial parent implementation.

## Fallback

If an agent fails, the parent completes its packet through direct source inspection.

## Verification order

Targeted tests, main typecheck, production build, bundled behavior probe, diff audit.
