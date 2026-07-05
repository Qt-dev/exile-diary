# Exile Diary Staged Refactor Plan

This plan assumes we are following the recommended path from [refactor-options.md](D:/Dev/exile-diary/docs/architecture/refactor-options.md):

- keep Electron for the near-term app shell
- split the runtime out of the Electron main process
- make pricing, OCR, storage, and event processing deterministic and testable
- leave a clean path to move the runtime or OCR/capture stack to Rust later

This is not a big-bang rewrite plan. It is a staged migration that keeps the app shippable.

## Outcome We Are Designing Toward

By the end of this refactor, the app should look like this:

```text
Electron shell
  - lifecycle
  - windows
  - tray
  - shortcuts
  - preload bridge

Renderer UI
  - pages
  - overlay presentation
  - local view state

Runtime process
  - logs
  - run state
  - pricing
  - GGG API
  - stash refresh
  - inventory diffing
  - DB repositories

OCR worker
  - capture
  - image preprocessing
  - OCR
  - mod matching
```

The shell should stop owning domain behavior. The runtime should stop knowing about windows. The renderer should stop having broad access to Electron and Node.

## Build Topology

This migration plan assumes `electron-vite` is the canonical build system for the current desktop app.

Canonical outputs:

- main bundle: `out/electron/main`
- preload bundle: `out/electron/preload`
- renderer bundle: `out/renderer`

Canonical lifecycle commands:

- `npm run dev`
- `npm run build:app`
- `npm run start`
- `npm run package:win`
- `npm run package:portable`
- `npm run package:linux`

Build rules:

- treat [electron.vite.config.ts](D:/Dev/exile-diary/electron.vite.config.ts) as the source of truth for entrypoints, aliases, and output paths
- keep `src/main/index.ts` as the single main entry unless the build graph is intentionally expanded
- treat preload as a separate build product, not as a sibling file inside the main bundle tree
- resolve worker files, preload paths, and copied native assets relative to the `out/electron/*` layout
- keep `npm run sync:electron-assets` explicit as part of the build contract for DB extensions and OCR/image worker files
- treat [src/main/tsconfig.json](D:/Dev/exile-diary/src/main/tsconfig.json) as a type-checking config only, not evidence of a runtime emit tree

## Delivery Strategy

### Core principle

Move behavior behind seams first, then move execution boundaries.

That means:

1. define contracts
2. isolate code inside the existing app
3. move isolated code into packages
4. move those packages into separate processes
5. optionally replace selected packages with Rust implementations later

## Target Repository Shape

This is the target structure for the staged Electron-first refactor.

```text
apps/
  desktop/
    src/
      main/
        bootstrap/
        windows/
        ipc/
        preload/
        tray/
        shortcuts/
      renderer/
        app/
        overlay/

packages/
  shared-contracts/
    src/
      commands/
      events/
      dto/
      schemas/

  domain/
    src/
      runs/
      items/
      pricing/
      ocr/
      stash/
      settings/
      value-objects/

  runtime-core/
    src/
      bootstrap.ts
      scheduler.ts
      event-bus.ts
      use-cases/
      services/
        log-ingest/
        run-tracking/
        ggg/
        pricing/
        stash/
        inventory/
        overlay/

  db/
    src/
      client.ts
      migrations/
      repositories/
      queries/

  ocr-worker/
    src/
      bootstrap.ts
      capture/
      preprocess/
      ocr/
      matching/

  platform-adapters/
    src/
      poe-window/
      file-watch/
      hotkeys/
      notifications/

optional later:
  rust-agent/
  rust-ocr/
```

## Package Boundaries

## 1. `shared-contracts`

Purpose:

- the only place that defines IPC commands, events, and cross-process payloads

Owns:

- command names
- event names
- DTOs
- validation schemas
- versioning rules

Does not own:

- business logic
- repositories
- window code

Example contracts:

- `settings.get`
- `settings.save`
- `runs.list`
- `runs.get`
- `runs.reprocess`
- `overlay.setMoveable`
- `ocr.scanMapMods`
- `runtime.stateChanged`
- `overlay.notification`
- `pricing.snapshotReady`

## 2. `domain`

Purpose:

- pure application rules with no Electron, no IPC, and no direct DB calls

Owns:

- item normalization
- run aggregate logic
- OCR match result model
- price snapshot model
- stash snapshot model
- confidence and explanation metadata models

Does not own:

- API clients
- SQLite
- scheduling
- screen capture

This package should be the part most likely to survive unchanged if the runtime later moves to Rust.

## 3. `runtime-core`

Purpose:

- the orchestration layer for all gameplay and pricing workflows

Owns:

- log ingestion flow
- run tracking flow
- rate refresh scheduling
- inventory diff workflow
- stash refresh workflow
- overlay state publishing
- reprocessing workflows

Depends on:

- `domain`
- `db`
- `shared-contracts`
- `platform-adapters`

Does not own:

- BrowserWindow
- renderer routing
- raw OCR implementation details

## 4. `db`

Purpose:

- all persistence concerns

Owns:

- SQLite bootstrap
- migrations
- prepared statements
- repository interfaces and implementations
- persistence mappers

Rules:

- no repository should return raw SQL-shaped rows outside this package
- repositories return domain-shaped models or DTOs
- all write-heavy workflows should use transactions

## 5. `ocr-worker`

Purpose:

- all capture and OCR work that is too expensive or too platform-sensitive for the shell

Owns:

- locating the PoE client window
- region capture
- image preprocessing
- OCR execution
- mod matching
- OCR confidence calculation
- OCR artifact persistence in debug mode

Rules:

- one explicit job API
- bounded concurrency
- no UI dependencies

## 6. `platform-adapters`

Purpose:

- hide non-portable details behind narrow interfaces

Owns:

- file watchers
- PoE process/window detection
- hotkey registration
- path discovery
- desktop notifications if needed

This makes later Rust replacement much easier, because we will know exactly which seams are platform-specific.

## 7. `apps/desktop`

Purpose:

- host the user experience, not the app brain

Owns:

- window creation
- tray
- menus
- auto update
- preload bridge
- route rendering
- overlay presentation

Rules:

- renderer never imports Node or Electron directly
- preload exports a typed API only
- main process delegates domain actions to runtime services

## Current Code To Future Package Mapping

The easiest migration path is to move by responsibility, not file extension.

| Current area | Current files | Future home |
| --- | --- | --- |
| Main shell orchestration | `src/main/index.ts` | `apps/desktop/src/main/bootstrap`, `windows`, `shortcuts`, `tray` |
| Broad renderer IPC handlers | `src/main/Responder.ts` | split between `apps/desktop/src/main/ipc` and `runtime-core/use-cases` |
| Renderer Electron access | `src/renderer/electron.service.ts` | `apps/desktop/src/main/preload/api.ts` plus `shared-contracts` |
| Log parsing | `src/main/modules/LogProcessor.ts`, `EventParser.ts`, `RunParser.ts` | `runtime-core/services/log-ingest` and `run-tracking`, with pure pieces in `domain/runs` |
| GGG API | `src/main/GGGAPI.ts`, `AuthManager.ts` | `runtime-core/services/ggg` and `platform-adapters/auth` |
| Pricing fetch | `src/main/modules/RateGetterV2.ts`, `RatesManager.ts` | `runtime-core/services/pricing` plus `db/repositories/rates` |
| Item valuation | `src/main/modules/ItemPricer.ts` | `domain/pricing` plus orchestration in `runtime-core/services/pricing` |
| Inventory diffing | `src/main/modules/InventoryGetter.js` | `runtime-core/services/inventory` |
| Stash refresh | `src/main/modules/StashGetter.ts`, `StashTabsManager.ts` | `runtime-core/services/stash` |
| OCR capture/preprocess | `src/main/modules/ImageParser/ScreenshotWatcher.ts` | `ocr-worker/capture` and `preprocess` |
| OCR execution | `src/main/modules/ImageParser/OCRWatcher.js` | `ocr-worker/ocr` |
| Mod matching | `src/main/modules/StringParser/*`, `EnhancedBKTree.ts` | `ocr-worker/matching` with reusable matching logic in `domain/ocr` if kept in TS |
| SQLite | `src/main/db/*` | `db` |
| Overlay UI | `src/renderer/routes/Overlay.tsx` | `apps/desktop/src/renderer/overlay` |
| App pages and stores | `src/renderer/routes/*`, `src/renderer/stores/*` | `apps/desktop/src/renderer/app` |

## Milestone Plan

## Milestone 0: Baseline And Safety Net

Goal:

- freeze current behavior enough that we can refactor confidently

Deliverables:

- architecture decision record confirming this staged path
- dedicated regression harness for correctness and performance, not just ad hoc smoke checks
- golden-path smoke checklist for:
  - login
  - log reading
  - run tracking
  - inventory pricing
  - stash refresh
  - overlay visibility/movement
  - OCR map mod read
- shared test and benchmark matrix for:
  - log parsing and run reconstruction
  - item normalization and pricing
  - stash valuation
  - OCR preprocessing and mod matching
  - end-to-end run completion flow
- benchmark tooling that can be re-run locally and in CI without changing repo-tracked state
- baseline artifacts in a machine-readable format such as JSON or CSV so current and refactored implementations can be compared consistently
- benchmark baselines for:
  - cold start time
  - idle memory
  - run completion latency
  - OCR job latency
  - pricing latency
  - stash refresh duration
- captured fixture outputs for:
  - run reconstruction
  - item pricing
  - stash valuation
  - OCR matching

Current repo help:

- DB benchmark already exists in `test/benchmarks/db/DbQueryBenchmark.ts`
- string matching benchmarks already exist under `test/benchmarks/string-match`
- those should be treated as the seed tooling, then expanded with OCR latency, pricing latency, stash refresh, cold start, and idle memory harnesses

Definition of done:

- we can compare old and new behavior with stable fixtures, benchmark outputs, and repeatable numbers, not guesses

## Milestone 1: Contract First

Goal:

- create clean API boundaries without moving processes yet

Deliverables:

- add `shared-contracts`
- define command/event names and payloads
- replace ad hoc IPC calls with typed wrappers
- introduce a preload API surface
- stop renderer imports of direct Electron/Node objects

Key behavior change:

- renderer calls `window.exileDiary.<typedMethod>()`
- main process maps command to an application service

Definition of done:

- `src/renderer/electron.service.ts` no longer exposes raw `ipcRenderer`, `childProcess`, `fs`, `BrowserWindow`

## Milestone 2: Shell Slimming

Goal:

- reduce `src/main/index.ts` and `Responder.ts` to shell duties

Deliverables:

- split window creation, shortcuts, tray, updater, and overlay shell into separate modules
- move business workflows out of handlers into services
- create app composition root
- preserve `electron-vite` entry stability so the shell refactor does not introduce a second main-build path
- keep preload wiring aligned with `out/electron/preload`, not a sibling artifact under the main bundle

Recommended new folders:

- `apps/desktop/src/main/windows`
- `apps/desktop/src/main/shortcuts`
- `apps/desktop/src/main/ipc`
- `packages/runtime-core/src/use-cases`

Definition of done:

- Electron main can be read as a shell, not as the app’s business brain

## Milestone 3: DB Isolation

Goal:

- make storage deterministic, testable, and reusable

Deliverables:

- move SQLite bootstrap and repositories into `packages/db`
- introduce domain-shaped repositories
- centralize migrations
- add transaction helpers for write-heavy flows

Important subtask:

- normalize naming drift in tables and repository methods without forcing a destructive migration all at once
- keep extracted DB code consumable inside the existing `electron-vite` main graph through standard imports
- preserve compatibility adapters in `src/main/db/*` until the later runtime-core migration is ready

Definition of done:

- runtime services no longer import SQL statements or low-level DB helpers directly

## Milestone 4: Runtime-Core Extraction

Goal:

- isolate all non-UI application workflows inside `runtime-core`

Deliverables:

- `log-ingest` service
- `run-tracking` service
- `pricing` service
- `inventory` service
- `stash` service
- `overlay` publisher
- regression fixtures for run parsing, pricing, and stash workflows before implementation swaps over
- repeatable benchmarks for run-finalization, pricing batches, and stash refresh against frozen inputs
- captured baseline outputs for current and refactored runtime-core paths in a machine-readable format
- first extract runtime code as importable modules inside the existing `electron-vite` main graph, without introducing a second executable boundary yet

Recommended runtime interfaces:

- `RunRepository`
- `ItemRepository`
- `RateRepository`
- `StashRepository`
- `SettingsRepository`
- `OcrGateway`
- `GggGateway`
- `Clock`
- `Logger`

Definition of done:

- runtime services can run in-process first, then be moved out-of-process with minimal internal changes
- replacement runtime-core flows match or improve baseline correctness and performance on the regression suite

## Milestone 5: OCR Worker Extraction

Goal:

- move screenshot/capture/OCR work off the shell and away from the renderer

Deliverables:

- job-based OCR worker
- explicit request/response contract
- image preprocessing pipeline
- mod matching pipeline
- confidence score and fallback rules
- debug artifact capture mode
- fixture-backed OCR benchmarks using the same screenshots and expected mod matches before and after extraction
- machine-readable timing outputs for capture, preprocess, OCR, and matching stages
- explicit worker delivery rules that define whether OCR helpers are bundled by Vite, copied by `sync:electron-assets`, or packaged as dedicated sidecar files before the extraction lands

Recommended job shape:

```ts
type ScanMapModsJob = {
  jobId: string;
  profileId: string;
  league: string;
  trigger: 'manual' | 'map-enter' | 'retry';
  captureRegionHint?: {
    side: 'right';
    windowTitlePattern: string;
  };
};
```

Result shape:

```ts
type ScanMapModsResult = {
  jobId: string;
  status: 'ok' | 'no-window' | 'no-text' | 'low-confidence' | 'error';
  rawLines: string[];
  normalizedLines: string[];
  matchedMods: Array<{
    input: string;
    mod: string;
    confidence: number;
  }>;
  timingsMs: {
    capture: number;
    preprocess: number;
    ocr: number;
    match: number;
  };
};
```

Definition of done:

- OCR latency is measurable
- shell remains responsive during OCR
- OCR failures are diagnosable
- OCR accuracy and latency can be compared against the same fixtures before and after extraction

## Milestone 6: Process Separation

Goal:

- move `runtime-core` and `ocr-worker` into separate execution zones

Deliverables:

- runtime bootstrap process
- event bridge between shell and runtime
- supervision and restart strategy
- health checks
- explicit `electron-vite` build entries or packaging rules for any new out-of-process runtime entrypoint before execution moves out of process

Order:

1. move OCR worker out first
2. move runtime-core out second

Why this order:

- OCR is the most obviously expensive isolated workload
- it gives immediate responsiveness wins with relatively low coordination risk

Definition of done:

- UI and overlay remain responsive even under OCR, stash refresh, and price refresh load

## Milestone 7: Precision Improvements

Goal:

- make pricing and OCR more trustworthy, not just cleaner

Deliverables:

- explicit price snapshot IDs
- item valuation explanations
- persisted raw item payloads for replay
- OCR confidence thresholds and retry policy
- per-item or per-run provenance metadata
- replayable valuation and OCR test cases so confidence logic cannot silently change outcomes

Recommended data additions:

- `price_snapshot`
- `price_source`
- `valuation_explanation`
- `ocr_scan`
- `ocr_match`

Definition of done:

- we can explain why an item or run got its value
- we can re-run valuation against the same captured inputs
- valuation and OCR confidence changes are covered by fixture-based regression tests

## Test And Benchmark Plan

Every major subsystem migration should ship with:

- fixture-based correctness tests
- repeatable benchmarks
- captured baseline outputs

Correctness tests:

- fixture-based run reconstruction from captured `Client.txt` slices
- fixture-based item pricing using frozen price snapshots
- fixture-based stash valuation using saved stash payloads
- fixture-based OCR matching using saved screenshots and expected mod outputs
- overlay-facing runtime state tests so the overlay contract remains stable while the runtime moves

Performance benchmarks:

- startup timing harness
- idle memory sampler
- OCR job latency benchmark
- pricing batch benchmark
- stash refresh benchmark
- run-finalization benchmark
- build-contract verification for `out/electron/main`, `out/electron/preload`, `out/renderer`, and copied runtime assets

Stability rules:

- run each benchmark multiple times
- report median and p95, not a single sample
- treat major variance as a failure to investigate, even if the mean looks good
- keep measurement outputs machine-readable so later CI gating can diff regressions automatically
- run startup, launch-path, and packaging-sensitive checks from fresh `npm run build:app` outputs rather than a separate TypeScript emit tree

## Milestone 8: Optional Rust Introduction

Goal:

- improve the heaviest parts without redoing the whole app

Best first Rust candidates:

1. OCR capture/preprocessing worker
2. mod matching engine
3. runtime agent later

Do not start with:

- renderer UI rewrite
- whole-app Rust migration

Definition of done:

- Rust replaces a bounded workload behind an already-stable contract

## Recommended Order Inside The Current Codebase

This is the least disruptive move order from today’s tree.

1. Introduce `docs/architecture` decisions and a typed contract package.
2. Build a preload bridge and stop direct renderer Electron access.
3. Split `src/main/index.ts` into shell modules.
4. Extract DB repositories into `packages/db`.
5. Extract pricing and log/run workflows into `packages/runtime-core`.
6. Extract OCR into `packages/ocr-worker`.
7. Move OCR worker out-of-process.
8. Move runtime out-of-process.
9. Decide whether Rust should replace OCR only or the full agent later.

Until the build graph intentionally changes, keep one main entry, one preload entry, and one renderer build target.

## Short-Term Implementation Backlog

If we wanted to start immediately, this is the first practical backlog I would queue:

### Wave 1

- create `docs/architecture/migration-plan.md`
- create `packages/shared-contracts`
- create preload API with typed settings and run read methods
- replace raw renderer IPC usage for settings, runs, and overlay state

### Wave 2

- extract `packages/db`
- migrate rates, runs, and settings repositories first
- keep existing UI behavior unchanged

### Wave 3

- extract `packages/runtime-core`
- move log parsing and pricing flows first

### Wave 4

- extract `packages/ocr-worker`
- add benchmarking around OCR timing and confidence

## Risks And Controls

## Risk: Shipping stalls during the refactor

Control:

- each milestone preserves a runnable app
- no milestone requires a UI rewrite and runtime rewrite at the same time

## Risk: Overlay regresses while architecture improves

Control:

- keep overlay UI last among shell responsibilities to rewrite
- stabilize data contracts before changing overlay rendering

## Risk: Pricing changes silently

Control:

- snapshot-based valuation
- golden test cases for representative items
- keep current and new pricers runnable side-by-side during transition

## Risk: OCR gets cleaner architecturally but less accurate

Control:

- keep the existing benchmark datasets
- store OCR intermediates during migration
- compare old and new match outputs against the same captures

## Risk: Linux support becomes the hidden tail

Control:

- treat Wayland as an explicit support tier, not an assumed parity tier
- prioritize Windows and Linux X11/XWayland first

## Acceptance Metrics

The refactor should be considered successful only if the app improves on real numbers.

Target metrics:

- cold start meaningfully lower than current baseline
- idle memory lower than current baseline
- overlay interaction remains responsive during stash refresh and OCR
- OCR end-to-end latency lower than current baseline
- no increase in missed/incorrect map mod matching on benchmark datasets
- no increase in incorrect item valuation on comparison fixtures
- proper automated tests exist for log parsing, pricing, OCR matching, stash valuation, and overlay-facing runtime state
- benchmark tools exist for cold start, idle memory, OCR latency, pricing latency, stash refresh duration, and run completion latency
- benchmark runs are repeatable and report stable aggregates such as median and p95 over multiple executions
- correctness results are compared against fixed fixtures, not only live API behavior
- no migration milestone is complete until its replacement path matches or improves baseline correctness and performance on the benchmark suite
- measurement outputs are easy to diff between current and refactored implementations
- startup, preload resolution, worker resolution, and packaging checks validate the built `electron-vite` outputs from `npm run build:app`, not an old `build/main` tree

## What I Would Build First

If we start implementation now, I would begin with:

1. typed preload bridge
2. `shared-contracts`
3. `db` extraction
4. `runtime-core` extraction for pricing + run tracking

That sequence creates the biggest architectural leverage while keeping product risk low.

## Decision Summary

This plan is optimized for:

- shipping continuously
- getting real performance wins early
- improving pricing and OCR determinism
- preserving a clean future path to Rust

It is intentionally not optimized for ideological purity. It is optimized for getting from the current app to a materially better one without betting the whole project on a single rewrite cutover.
