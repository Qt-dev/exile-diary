# Eval contract

## Goal
Deliver a backwards-compatible hardening of profile database initialization and GGG/profile request flow across Electron main, the runtime sidecar, and the renderer.

## Success criteria
- Migrations are atomic and the version marker is committed last.
- Required schema is checked before the runtime becomes DB-ready.
- Known empty, interrupted databases can recover without deleting non-empty data.
- Profile persistence and relaunch/switch happen only after DB readiness.
- Character selection reuses the character DTO already returned by GGG.
- The renderer receives deterministic transition results and does not depend on a 30-second runtime timeout.

## Integration surfaces
- SQLite manager and repositories.
- Settings/profile transition behavior.
- Runtime-sidecar commands, responses, readiness, and health.
- Renderer preload API and character selection/settings flows.
- GGG request scheduling and caching.

## Downstream consumers
Runtime services, DB repositories, Electron main listeners, renderer route loaders, character store, packaged-sidecar smoke tests.

## Required checks
- DB and migration regression tests with real or faithful SQLite behavior.
- Settings/profile, GGGAPI, runtime client/service, and renderer tests.
- Main and renderer TypeScript checks.
- Main test suite and production build.

## Deliverables
- Atomic migration and schema readiness implementation.
- Explicit profile transition path and safe relaunch/hot-transition behavior.
- Coalesced character API access without redundant profile validation fetch.
- Typed runtime lifecycle/error contracts where needed.
- Workflow integration notes and final audit.

## Blocking conditions
- Existing non-empty DBs would be rebuilt or discarded automatically.
- Existing profile/settings files require an incompatible migration.
- Sidecar cannot distinguish control readiness from DB readiness.
- Required focused tests fail.
