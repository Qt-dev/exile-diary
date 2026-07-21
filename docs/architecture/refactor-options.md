# Exile Diary Refactor Options

This document maps two plausible full-refactor directions for Exile Diary:

1. A Rust-first desktop app
2. An Electron app rebuilt with a cleaner architecture

The goal is not just parity with the current app. The goal is a version that is:

- more precise in pricing
- more precise in text reading
- faster during play
- lighter on memory
- maintainable on both Windows and Linux

## What The Current App Already Proves

The current codebase already demonstrates that the product is viable. It successfully combines:

- GGG API access
- poe.ninja pricing
- client log parsing
- map/run statistics
- inventory diffing at map end
- stash tab valuation
- a moveable overlay
- screenshot-based map-mod reading

The main challenge is not feature discovery. It is architectural separation.

Today, the app spreads core behavior across a large Electron main process and mixed JS/TS modules:

- window and shortcut orchestration in `src/main/index.ts`
- log scheduling and event parsing in `src/main/modules/LogProcessor.ts`
- OCR pre-processing in `src/main/modules/ImageParser/ScreenshotWatcher.ts`
- OCR execution in `src/main/modules/ImageParser/OCRWatcher.js`
- pricing logic in `src/main/modules/ItemPricer.ts`
- GGG API and rate-limited requests in `src/main/GGGAPI.ts`
- stash valuation refresh in `src/main/modules/StashGetter.ts`
- overlay rendering in `src/renderer/routes/Overlay.tsx`

That means the next refactor should split the app into stable subsystems instead of letting the window shell own too much behavior.

## Current Build System

The current desktop app build is centered on `electron-vite`, not the old Webpack-era `build/` tree.

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

Implications for the refactor:

- treat [electron.vite.config.ts](D:/Dev/exile-diary/electron.vite.config.ts) as the source of truth for entrypoints, aliases, and output paths
- treat preload as a first-class build product, not as a sibling file inside the main output tree
- keep native DB extensions and OCR/image worker file delivery as an explicit post-build contract through `npm run sync:electron-assets`
- extend the existing build graph for later runtime or OCR process splits instead of reintroducing a second parallel build system

## Shared Requirements For Both Refactors

Both versions should converge on the same product model.

### Core Runtime Model

- One event pipeline for all gameplay signals
- One canonical item normalization pipeline
- One canonical price snapshot model
- One canonical OCR/mod-matching pipeline
- One storage model for runs, items, stash snapshots, OCR matches, and settings

### Precision Rules

Pricing precision should come from:

- storing league-scoped price snapshots with timestamps
- valuing items against an explicit snapshot ID, not "latest mutable prices"
- separating item normalization from price lookup
- preserving original OCR/raw API/raw item payloads for later reprocessing
- attaching confidence and explanation metadata to every valuation path

OCR precision should come from:

- capturing only the Path of Exile window or a tightly bounded region
- deterministic image pre-processing before OCR
- matching against a canonical mod dictionary extracted from game data
- confidence scoring plus fallback retries
- persisting OCR input, normalized text, chosen match, and confidence

### Performance Rules

- no OCR work on the UI thread
- no DB work on the overlay thread
- no blocking network work in the shell process
- prepared statements and batched writes for SQLite
- memory-bounded caches with TTLs and explicit invalidation
- startup should load only shell, settings, and last-known state

### Linux Constraint

Linux support is possible, but the hardest part is the overlay and capture model on Wayland.

Electron documents that on Wayland it is generally not possible to programmatically move, position, focus, or resize windows after creation without user input. That directly affects a moveable game overlay.

Cross-platform screen capture libraries are improving, but `xcap` still marks Wayland support as not fully supported in some scenarios for screen and window capture.

Practical implication:

- Windows: full feature target
- Linux X11/XWayland: full feature target
- Native Wayland: best-effort with degraded overlay/capture support unless the implementation uses portal-driven flows and accepts UX compromises

## Option 1: Rust-First App

## Summary

This is the best long-term path if the top priority is runtime efficiency, low idle memory, strong typing across the core domain, and a better ceiling for OCR/capture performance.

It is also the more complex rewrite.

## Recommended Shape

Use a Rust core for all product logic, storage, capture, OCR orchestration, and scheduling.

For UI, use one of these:

- Preferred: Rust core + Tauri main app UI + native Rust overlay adapter
- Alternate: fully native Rust UI using Slint for both main app and overlay

Why this split:

- Tauri helps reuse web UI skills and allows a friendlier settings/history/statistics UI
- the overlay is the most platform-sensitive part, so it should not depend on the webview layer for critical behavior
- a native overlay adapter gives better control over click-through, top-most behavior, movement mode, and frame timing

## Complexity

Estimated complexity: high

- Architecture/setup: medium
- Domain rewrite: high
- Overlay implementation: high
- OCR/capture pipeline: high
- Cross-platform packaging: medium-high
- Linux polish: high

Rough delivery estimate for one strong full-time engineer to reach reliable feature parity:

- 14 to 20 weeks for a serious first version
- add 3 to 6 more weeks if native Wayland behavior must be pushed beyond basic support

## How It Would Work

### Processes

Use two processes:

- `exilediary-app`: main UI shell
- `exilediary-agent`: background runtime for logs, APIs, OCR, capture, pricing, and DB work

This separation keeps the overlay and runtime alive even if the main UI is closed or restarted.

### Internal Subsystems

The agent would own these subsystems:

- `log_ingest`: tails `Client.txt`, parses lines, emits typed events
- `run_engine`: builds run/session state from events
- `ggg_client`: authenticated GGG API client with adaptive rate limiting
- `ninja_client`: poe.ninja snapshot fetcher
- `pricing_engine`: converts normalized items into values against a specific price snapshot
- `inventory_engine`: detects inventory diffs at map end
- `stash_engine`: refreshes tracked tabs and computes net worth snapshots
- `capture_engine`: locates the PoE window and captures the right-side region
- `ocr_engine`: preprocesses images, runs OCR, normalizes text, matches mods
- `overlay_engine`: publishes lightweight overlay view models
- `db`: SQLite access through a dedicated actor/thread

### Recommended Technical Choices

- Async runtime: `tokio`
- HTTP: `reqwest`
- Storage: SQLite with `rusqlite` on a dedicated DB thread or actor
- Serialization: `serde`
- Background messaging: `tokio::sync` channels
- Capture: `xcap` or a platform adapter behind a `CapturePort`
- OCR: native Tesseract binding behind an `OcrPort`
- Matching: Rust implementation of the existing normalized BK-tree/fuzzy matcher, with room to add a trie or FST-backed exact layer first

## High-Level Rust Code Map

```text
apps/
  exilediary-app/
    src/
      main.rs
      ui/
        app_shell.rs
        routes/
        components/
      ipc/
        commands.rs
        events.rs

  exilediary-overlay/
    src/
      main.rs
      overlay/
        window.rs
        presenter.rs
        input_mode.rs
        layout.rs

crates/
  core-domain/
    src/
      runs/
      items/
      pricing/
      stash/
      ocr/
      logs/
      settings/
      events/

  runtime-agent/
    src/
      main.rs
      bootstrap.rs
      scheduler.rs
      event_bus.rs
      services/
        log_ingest.rs
        run_engine.rs
        ggg_client.rs
        ninja_client.rs
        pricing_engine.rs
        inventory_engine.rs
        stash_engine.rs
        capture_engine.rs
        ocr_engine.rs
        overlay_engine.rs

  infra-sqlite/
    src/
      connection.rs
      migrations.rs
      repositories/
        runs.rs
        items.rs
        rates.rs
        stash.rs
        settings.rs
        ocr.rs

  infra-platform/
    src/
      window_locator.rs
      capture/
        windows.rs
        linux_x11.rs
        linux_wayland.rs
      overlay/
        windows.rs
        linux.rs
      shortcuts/
        windows.rs
        linux.rs

  infra-ocr/
    src/
      preprocess.rs
      tesseract.rs
      mod_matcher.rs
      confidence.rs
```

## Rust Data Flow

```text
Client.txt -> log_ingest -> run_engine -> sqlite
GGG API -> ggg_client -> inventory_engine/stash_engine -> pricing_engine -> sqlite
poe.ninja -> ninja_client -> price_snapshot store -> pricing_engine
PoE window capture -> capture_engine -> ocr_engine -> mod_matcher -> run_engine -> sqlite
sqlite/runtime state -> overlay_engine -> overlay process
```

## Why Rust Wins

- Lowest memory ceiling
- Best control over CPU-heavy work
- Strong typed domain boundaries
- Easiest path to a stable background agent
- Best long-term maintainability for pricing and OCR correctness

## Why Rust Is Hard

- More platform-specific work
- Overlay behavior on Linux will take real systems work
- OCR and capture bindings are less turnkey than in a browser-oriented stack
- Full rewrite cost is higher than the Electron path

## Option 2: Electron Refactor

## Summary

This is the best path if the priority is faster delivery, lower rewrite risk, reuse of the current renderer knowledge, and preserving the current UI development style while still fixing most of the architectural issues.

It can become much faster and leaner than the current app if the shell is kept thin and the heavy work moves out of the main process.

## Complexity

Estimated complexity: medium-high

- Architecture/setup: medium
- Domain rewrite: medium
- Overlay rebuild: medium
- OCR/capture pipeline: medium-high
- Security cleanup: medium
- Linux polish: medium-high

Rough delivery estimate for one strong full-time engineer:

- 10 to 14 weeks for a solid feature-parity rewrite
- add 2 to 4 weeks for aggressive optimization and Linux edge-case cleanup

## How It Would Work

### Process Model

Use four execution zones:

- Electron main process: lifecycle, windows, tray, shortcuts, auto-update
- Renderer process: UI only
- Utility/runtime process: log ingest, APIs, scheduling, pricing orchestration
- OCR/capture worker process: image capture, preprocessing, OCR, mod matching

The current app already hints at this need because the main process is doing too much.

### Shell Rules

The Electron shell should do very little:

- create windows
- expose a safe preload API
- route events between runtime and renderer
- manage overlay mode and movement state

Security and maintainability baseline:

- `nodeIntegration: false`
- `contextIsolation: true`
- preload-only IPC surface
- one typed command/event contract package shared across main, renderer, and runtime

### Runtime Core

The runtime should be a separate TypeScript package with no direct window dependencies.

That package would own:

- log ingestion
- run state
- GGG API
- poe.ninja snapshotting
- pricing engine
- stash refresh
- inventory diffing
- DB repositories

### OCR/Capture

Do not keep OCR in the renderer or Electron main process.

Use one of these:

- a Node worker/utility process for image work
- or a Rust sidecar for capture + OCR, even in the Electron version

If the goal is the best Electron build possible, the most practical choice is:

- Electron shell and UI
- TypeScript runtime core
- Rust sidecar only for capture/OCR if profiling proves JS is still too heavy

Build guardrails for the Electron path:

- keep [electron.vite.config.ts](D:/Dev/exile-diary/electron.vite.config.ts) as the canonical source of runtime entrypoints
- do not assume preload or worker artifacts live beside every compiled module unless the build config or `sync:electron-assets` explicitly guarantees that layout
- do not introduce a second executable boundary until the build config models it directly

## High-Level Electron Code Map

```text
apps/
  desktop/
    src/
      main/
        app.ts
        windows/
          mainWindow.ts
          overlayWindow.ts
        shortcuts/
        tray/
        preload/
          api.ts
        ipc/
          commands.ts
          events.ts

      renderer/
        app/
          routes/
          components/
          stores/
        overlay/
          components/
          presenter/

packages/
  runtime-core/
    src/
      bootstrap.ts
      eventBus.ts
      scheduler.ts
      services/
        logIngest.ts
        runEngine.ts
        gggClient.ts
        ninjaClient.ts
        pricingEngine.ts
        inventoryEngine.ts
        stashEngine.ts
        overlayPublisher.ts

  ocr-worker/
    src/
      index.ts
      capture.ts
      preprocess.ts
      ocr.ts
      modMatcher.ts
      confidence.ts

  db/
    src/
      sqlite.ts
      migrations.ts
      repositories/

  shared-contracts/
    src/
      commands.ts
      events.ts
      dto/
```

## Electron Data Flow

```text
Client.txt -> runtime-core/logIngest -> runEngine -> sqlite
GGG API -> gggClient -> inventoryEngine/stashEngine -> pricingEngine -> sqlite
poe.ninja -> ninjaClient -> price snapshot store -> pricingEngine
Capture trigger -> ocr-worker -> modMatcher -> runtime-core/runEngine -> sqlite
runtime-core -> overlayPublisher -> main process -> overlay renderer
renderer -> preload api -> main/runtime
```

## How To Keep Electron Fast

Electron's own performance guidance points to the same themes this refactor should follow:

- avoid heavy modules unless necessary
- defer expensive startup work
- do not block the main process
- do not block the renderer process

So the Electron rewrite should explicitly avoid:

- eager loading OCR dependencies at app boot
- synchronous file and DB work in the window shell
- large renderer stores with raw item payloads
- overlay components subscribing to broad UI state

## Why Electron Wins

- fastest path to a cleaner product
- easiest migration from the current codebase
- easiest UI iteration
- least risky way to preserve feature parity quickly

## Why Electron Loses

- higher idle memory than Rust
- heavier packaging footprint
- more care needed to keep performance disciplined over time
- weaker long-term guarantees around accidental architectural drift

## Head-To-Head Recommendation

If the goal is:

- fastest route to a better release: choose Electron
- lowest memory and best long-term performance ceiling: choose Rust
- best overall business decision: do a staged path

## Recommended Realistic Strategy

I would not jump straight to a pure from-scratch Rust UI rewrite first.

I would do one of these two practical sequences:

### Sequence A: Lowest Risk

1. Rebuild the architecture in Electron with a strict shell/runtime split
2. Extract pricing, OCR, and DB logic into platform-agnostic packages
3. Replace the OCR/capture worker with Rust only if profiling justifies it
4. Move toward a Rust runtime later without redoing the full UI twice

### Sequence B: Best Long-Term Core

1. Build the Rust background agent first
2. Keep a thin Electron or Tauri UI shell during transition
3. Move overlay/capture into native Rust once the agent is stable
4. Replace the main UI only after the domain/runtime is proven

For this app specifically, Sequence B is the strongest long-term architecture, but Sequence A is the fastest way to reduce current complexity without taking on maximum rewrite risk all at once.

## What I Would Personally Choose

If we want the best chance of shipping a materially better version without stalling for months, I would choose:

- near term: Electron refactor with a strict runtime split
- medium term: Rust sidecar or Rust runtime for OCR, capture, pricing, and scheduling
- long term: decide whether the remaining Electron UI is good enough or should move to Tauri/Slint

That path gets most of the performance wins where they matter, without forcing the overlay, OCR, Linux packaging, and full UI rewrite to all happen at the same time.

## First Implementation Milestones

These milestones work for either option.

1. Define shared domain contracts for events, runs, items, price snapshots, OCR jobs, and overlay state.
2. Replace "current mutable state" flows with event-driven services and explicit repositories.
3. Isolate pricing into a deterministic engine with snapshot IDs and confidence metadata.
4. Isolate OCR into a dedicated pipeline with persisted intermediates and benchmark datasets.
5. Rebuild overlay as a dedicated thin presentation layer.
6. Add profiling gates for startup time, OCR latency, run-completion latency, and memory.

## Decision Table

| Category | Rust-first | Electron refactor |
| --- | --- | --- |
| Delivery speed | Slower | Faster |
| Feature parity risk | Higher | Lower |
| Idle memory | Best | Good if disciplined |
| CPU-heavy work | Best | Good with worker split |
| UI iteration speed | Medium | Best |
| Linux overlay risk | High | High |
| Long-term core quality | Best | Good |
| Best fit for immediate rewrite | No | Yes |
| Best fit for final performance ceiling | Yes | No |

## External Notes

Relevant current references used while shaping these options:

- Electron BrowserWindow docs: transparent/click-through window controls and Linux/Wayland constraints
- Electron performance guide: avoid heavy startup work and blocking main/renderer paths
- Tauri window customization and global-shortcut docs: useful if the Rust path keeps a webview UI shell
- `xcap` crate docs: cross-platform capture is viable, but Wayland still has caveats
- Slint docs: native Rust desktop UI remains a viable alternative if the project eventually wants to leave web UI entirely
