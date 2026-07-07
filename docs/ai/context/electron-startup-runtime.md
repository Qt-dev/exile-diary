# Electron Startup and Runtime Context

## What Lives Here
- main process startup and lifecycle
- preload wiring
- window creation
- startup recovery and early runtime bootstrap

## Primary Entrypoints
- `src/main/index.ts`
- `src/main/windows/createAppWindows.ts`
- `src/main/preload.ts`
- `src/main/PortableConfig.ts`
- `src/main/GpuRecovery.ts`

## Common Risks
- preload path mismatches
- single-instance lock conflicts
- user-data path overrides not applied consistently
- startup benchmark markers not firing
- GPU failures before renderer load

## Cheapest Checks
- `npm run typecheck:main`
- targeted tests in `test/main/windows` and `test/main/preload`
- `npm run benchmark:app:start`

## Use Full Launch When
- window behavior, ready-state timing, or startup recovery must be observed live
- benchmark coverage is not enough to prove the fix
