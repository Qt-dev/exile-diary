# Migration 0 Baseline Suite

This document is the execution guide for Milestone 0 of the staged refactor.

## Purpose

Milestone 0 creates a baseline safety net before architecture work begins. The baseline suite should answer:

- what behaviors must stay correct?
- what metrics must stay measurable?
- how do we compare current and future implementations with the same inputs?

## Smoke Checklist

Run this checklist manually when verifying the current app or a milestone branch:

- login and restore the active profile
- confirm client log reading starts without crashing
- confirm run tracking updates after entering and completing a map
- confirm inventory pricing runs after map completion
- confirm stash refresh can be triggered and updates visible totals
- confirm overlay visibility and movement still work
- confirm OCR map-mod reading completes and produces matched mods

## Practical Smoke Path

Use two layers so routine checks stay fast:

- `npm run test:ui:smoke`
- `npm run test:app:smoke`

What each layer covers:

- `test:ui:smoke` runs a renderer-only smoke suite in `jsdom`. It verifies the shared route tree, auth redirect, and main shell rendering without starting Electron.
- `test:app:smoke` reuses the lifecycle startup harness to launch the compiled Electron app once and confirm the main process still boots cleanly.

Suggested workflow:

- use `test:ui:smoke` while iterating on renderer routes, preload-driven UI wiring, or shell layout
- use `test:app:smoke` after touching startup, preload registration, window creation, or before release verification

## Fixture Matrix

Fixtures live under `test/Fixtures/migration-0`.

| Area | Fixture family | Current purpose |
| --- | --- | --- |
| Run reconstruction | `run-reconstruction/` | sample log slices and expected event snapshots |
| Pricing | `pricing/` | frozen rates and sample item payloads |
| Stash valuation | `stash/` | sample stash payloads and expected totals |
| OCR matching | `ocr/` | sample OCR line inputs and expected mod matches |

These fixtures are seeds. They should grow with real captured data as migration work continues.

## Benchmark Commands

- `npm run benchmark:db`
- `npm run benchmark:db:json`
- `npm run benchmark:string-match`
- `npm run benchmark:string-match:json`
- `npm run benchmark:app:start`
- `npm run benchmark:app:idle`
- `npm run baseline:collect`
- `npm run baseline:collect -- --include-app`

Note:

- app lifecycle benchmarks run the compiled Electron main bundle from `build/main`
- rebuild the main-process bundle before trusting startup or idle-memory results

## Outputs

Machine-readable baseline outputs are written to `test/baselines/migration-0`.

Expected artifact types:

- per-benchmark JSON output
- aggregated baseline summaries with repeated samples
- fixture manifests describing what was compared

## Stability Rules

- repeat deterministic benchmarks multiple times before comparing branches
- compare median and p95, not a single run
- use fixed fixtures for correctness gating whenever possible
- treat large variance as an investigation trigger even when the mean looks acceptable
