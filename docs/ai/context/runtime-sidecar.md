# Runtime Sidecar Context

## What Lives Here
- main-process bridge to the runtime sidecar
- sidecar spawn, request/response protocol, and health handling
- runtime-facing listeners and settings snapshots

## Primary Entrypoints
- `src/main/runtime/RuntimeSidecarClient.ts`
- `src/main/runtime/RuntimeSidecar.ts`
- `src/main/runtime/createRuntimeSidecarBridge.ts`
- `src/main/runtime/registerRuntimeListeners.ts`
- `src/main/runtime/electronViteRuntimePaths.ts`

## Common Risks
- wrong sidecar entry path in dev vs build
- stale settings snapshots
- startup races between main and sidecar readiness
- runtime bridge assumptions that differ from direct main-process behavior

## Cheapest Checks
- `npm test -- test/main/runtime/RuntimeSidecarClient.spec.ts test/main/runtime/electronViteRuntimePaths.spec.ts`
- `npm run typecheck:main`

## Use Full Launch When
- the bug depends on live sidecar startup, inter-process messaging, or integration with renderer boot
