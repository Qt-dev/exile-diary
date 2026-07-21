# ADR 0001: Migration 0 Baseline Safety Net

## Status

Accepted

## Context

The refactor plan depends on comparing current and future implementations with stable evidence instead of intuition. The repo already had targeted unit tests plus a few standalone benchmarks, but they were not organized as a baseline suite and did not consistently produce machine-readable outputs.

Without an explicit Milestone 0 safety net, later migrations would risk:

- silent regressions in pricing or OCR behavior
- performance changes that cannot be measured consistently
- implementation swaps without frozen fixtures to compare against

## Decision

Milestone 0 establishes a dedicated baseline harness with four parts:

1. Fixture-backed correctness assets under `test/Fixtures/migration-0`
2. Repeatable benchmark scripts under `test/benchmarks`
3. Machine-readable baseline artifacts under `test/baselines/migration-0`
4. A documented smoke checklist and benchmark matrix in docs

The baseline suite should prefer:

- fixed fixtures over live network responses
- repeated benchmark runs over single samples
- JSON outputs over console-only reporting

App lifecycle benchmarks for cold start and idle memory are included as opt-in tooling, while deterministic core benchmarks remain the default collection path.

## Consequences

Positive:

- current behavior becomes measurable before refactors begin
- runtime-core and OCR migrations have a fixed baseline to match or beat
- CI can later consume JSON outputs directly

Tradeoffs:

- Milestone 0 adds maintenance cost for fixtures and benchmark outputs
- lifecycle benchmarks are more environment-sensitive than deterministic in-memory benchmarks
- some benchmark tooling exists before all fixture families are fully populated with production-grade data

## Follow-up

- grow the fixture corpus with real captured logs, stash payloads, OCR inputs, and frozen price snapshots
- hook baseline collection into CI once command stability is proven
- add milestone-specific pass/fail thresholds after enough historical data exists
