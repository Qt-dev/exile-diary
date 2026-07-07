# Stale Dev Process or Port Conflicts

## Typical Symptoms
- dev appears broken after a previous run
- a port is already in use
- live verification gives inconsistent results between runs

## Likely Cause
An earlier dev server, Electron process, or watcher is still running and holding state or a port.

## First Checks
- confirm whether the previous run actually exited
- prefer process cleanup over source edits
- do not patch app code to fix a stale-process problem

## Cheapest Recovery Path
- clear the stale dev process
- rerun the same verification on a clean port or clean process set
- only inspect code if the same failure reproduces after cleanup

## Good Verification
- rerun the exact failing command after cleanup
- if the repro was startup-only, use `npm run dev`
- if the repro was smoke-only, use `npm run benchmark:app:start` or `npm run test:app:smoke`

## Escalate When
- the same error reproduces on a clean environment
- the stale process is only masking a deeper startup or sidecar issue

## Helpful Paths
- `scripts/watch-electron-assets.mjs`
- `scripts/run-dev-with-recovery.mjs`
- `test/benchmarks/app/AppLifecycleBenchmark.ts`
