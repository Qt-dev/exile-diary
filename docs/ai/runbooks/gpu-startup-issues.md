# GPU Startup Issues

## Typical Symptoms
- `GPU process isn't usable. Goodbye.`
- Electron exits during startup before the renderer is usable
- dev restarts or recovery logic triggers

## Likely Cause
Machine-specific GPU initialization is failing during Electron startup.

## First Checks
- Confirm whether the failure is in dev only or also in smoke and packaged flows
- Check whether the recovery flow already switched the app into GPU-safe mode
- Avoid changing renderer code until startup mode is confirmed

## Cheapest Recovery Path
- Use the repo's recovery-aware dev flow first
- Verify whether the app can boot in the existing GPU-safe mode
- Only change recovery behavior after confirming the current fallback is insufficient

## Good Verification
- `npm test -- test/main/GpuRecovery.spec.ts`
- `npm run typecheck:main`
- `npm run dev`

## Escalate When
- the recovery flow does not relaunch cleanly
- the startup failure moves past GPU init and into DB, logging, or sidecar startup

## Helpful Paths
- `src/main/GpuRecovery.ts`
- `scripts/run-dev-with-recovery.mjs`
- `src/main/index.ts`
- `test/main/GpuRecovery.spec.ts`
