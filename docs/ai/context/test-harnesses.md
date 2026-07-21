# Test Harnesses Context

## What Lives Here

- focused Jest suites
- renderer smoke tests
- app startup benchmarks
- OCR and DB benchmarks
- packaged or build-sensitive smoke flows

## Primary Commands

- `npm test`
- `npm run test:main`
- `npm run test:renderer`
- `npm run test:ui:smoke`
- `npm run test:ui:capture`
- `npm run dev:ui`
- `npm run benchmark:app:start`
- `npm run benchmark:db`
- `npm run benchmark:ocr:scan-map-mods`
- `npm run build:app`
- `npm run test:app:smoke`

## Common Rules

- prefer targeted suites first
- use benchmarks for subsystem proof before full app launch
- use `test:app:smoke` only when build output or packaged behavior is part of the risk

## Renderer And Browser Layers

- `test:renderer` runs the renderer suite in Vitest/jsdom through Vite's transform pipeline. Use it for component behavior and route contracts, including modules that use `import.meta.glob`.
- `test:ui:smoke` runs the real Vite renderer in Playwright Chromium with a deterministic, in-memory implementation of the preload API. It covers authentication, navigation, run details, search, settings saves, preload events, fixture mutation, compact layout, and backend-error behavior without launching Electron. Uncaught page errors and unexpected console errors fail the suite.
- `test:ui:capture` writes full-page screenshots for the primary routes and every stats/settings tab, plus an HTML report, under `.tmp/ui-test-results` and `.tmp/ui-playwright-report`. These are review artifacts, not committed pixel baselines.
- `test:app:smoke` remains the Electron main/preload/startup boundary. Do not use the browser harness as proof for windowing, native integrations, or packaged resource paths.

## Interactive UI Refinement

1. Run `npm run test:ui:install` once on a new machine.
2. Run `npm run dev:ui` and open `http://127.0.0.1:4173/test/ui/?scenario=populated#/`.
3. Select `populated`, `empty`, `unauthenticated`, or `backend-error` with the `scenario` query parameter; choose the renderer route after `#`.
4. Refine the UI, run `npm run test:ui:smoke`, then run `npm run test:ui:capture` and inspect the generated screenshots.

The harness entry is test-only. Its typed `window.__exileDiaryTest` controller can emit renderer events, inspect or clear recorded calls, and read or patch the active in-memory fixture state. External links, dialogs, and Electron commands are recorded instead of executed. Keep fixtures deterministic and update the mock whenever `ExileDiaryApi` changes so contract drift fails during typechecking.

## Escalation

- if targeted tests and benchmarks are green but the real app still fails, move to full launch
- if full launch is noisy, isolate whether the issue belongs to startup, sidecar, DB, or OCR before widening the checks
