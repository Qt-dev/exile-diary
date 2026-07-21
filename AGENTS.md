# AGENTS.md

This repo is optimized for Codex-style coding work. Keep this file lean and use the linked docs for deeper guidance.

## Repo Map
- Electron app with separate `main`, `preload`, and `renderer` concerns.
- Runtime sidecar lives under `src/main/runtime`.
- OCR sidecar and image parsing live under `src/main/modules/ImageParser`.
- Database setup and repositories live under `src/main/db`.
- Build, dev, packaging, and asset-sync flows are driven from `package.json` and `scripts/`.
- Benchmarks and smoke checks live under `test/benchmarks`; focused tests live under `test/main` and `test/renderer`.

## Default Working Style
- Prefer one implementation thread per milestone.
- Use side threads only for bounded research outputs that can be summarized back into the main thread.
- Avoid mixing planning, implementation, and review unless the task truly needs all three.
- Batch work by subsystem or failure chain, not by tiny incremental edits.
- Preserve reusable findings in repo docs or runbooks instead of paying to rediscover them later.

## Request Packet
Good requests in this repo include:
- Goal
- Affected subsystem or likely files
- Exact repro or desired behavior
- Cheapest acceptable checks
- Done condition

For bugs, include the raw evidence up front:
- exact error or stack
- repro path
- whether it happens in `dev`, `build`, `test:app:smoke`, or packaged mode

## Verification Ladder
Use the cheapest check that can prove the change.

1. Targeted unit tests
   Example: `npm test -- test/main/db/rates.spec.ts test/main/db/stats.spec.ts`
2. Subsystem smoke or benchmark
   Examples: `npm run test:ui:smoke`, `npm run benchmark:db`, `npm run benchmark:ocr:scan-map-mods`
3. Typecheck or build slice
   Examples: `npm run typecheck:main`, `npm run typecheck:renderer`, `npm run build:app`
4. Full app launch
   Use for startup, preload, runtime, windowing, sidecar, or integration changes
5. Packaged smoke
   Use when packaging, app-path, or bundled-resource behavior is part of the risk

## Escalation Rules
- After one failed implementation pass or two failed verification loops, switch to diagnosis/options mode.
- Full app launch is reserved for startup, preload, runtime, windowing, or integration changes.
- If the task spans multiple subsystems or the failure mode is unclear, use the stronger model and tighten the request packet before continuing.

## Model Routing Summary
- `gpt-5.4-mini`: bounded, low-risk tasks such as doc edits, single-file cleanups, simple tests, and straightforward search/explain requests
- `gpt-5.4`: normal default for most implementation, bug fixing, and subsystem reviews
- `gpt-5.5`: broad, risky, or ambiguous work such as architecture, migrations, startup/runtime failures, or cross-subsystem debugging

Full routing guidance: [docs/ai/model-routing.md](/D:/Dev/exile-diary/docs/ai/model-routing.md)
Workflow and support docs: [docs/ai/README.md](/D:/Dev/exile-diary/docs/ai/README.md)
