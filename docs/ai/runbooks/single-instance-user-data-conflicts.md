# Single-Instance and User-Data Conflicts

## Typical Symptoms
- app says another instance is already running
- dev launch closes immediately
- benchmark or smoke run fails because another app instance took the lock

## Likely Cause
Dev, benchmark, or installed app instances are sharing the same user-data location or single-instance lock.

## First Checks
- Confirm whether the installed app is already running
- Check whether the current flow uses `EXILE_DIARY_USER_DATA_PATH`
- Inspect benchmark or dev scripts before changing application code

## Cheapest Recovery Path
- Use the isolated dev path that already exists in repo scripts
- Prefer the benchmark and dev scripts that set `EXILE_DIARY_USER_DATA_PATH`
- Only diagnose app code if the isolated path still conflicts

## Good Verification
- `npm run dev`
- `npm run benchmark:app:start`
- `npm run test:app:smoke` only if packaged or smoke behavior matters

## Escalate When
- isolated user-data paths still collide
- the failure appears only after startup progresses into windowing or sidecar init

## Helpful Paths
- `src/main/PortableConfig.ts`
- `src/main/runtime/getUserDataPath.ts`
- `test/benchmarks/app/AppLifecycleBenchmark.ts`
- `package.json`
