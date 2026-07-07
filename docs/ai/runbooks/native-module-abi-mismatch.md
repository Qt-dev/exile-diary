# Native Module ABI Mismatch

## Typical Symptoms
- `better-sqlite3` fails to load
- errors mention mismatched `NODE_MODULE_VERSION`
- `npm run dev` fails before the app really starts

## Likely Cause
The native module was rebuilt for normal Node instead of Electron's runtime ABI.

## First Checks
- Confirm the failure mentions `better-sqlite3`
- Run `npm run native:check`
- Check whether someone ran `npm rebuild better-sqlite3` under plain Node

## Cheapest Recovery Path
- Run `npm run native:check`
- If it fails, rebuild Electron-native dependencies with the project's normal install path
- Re-run `npm run native:check`
- Only then retry `npm run dev`

## Good Verification
- `npm run native:check`
- `npm run typecheck:main` if code around startup changed
- `npm run dev` only after the preflight is green

## Escalate When
- the mismatch survives a correct Electron rebuild
- the failure moves into sidecar loading or DB initialization after the ABI issue is resolved

## Helpful Paths
- `scripts/check-electron-native-deps.mjs`
- `src/main/db/index.ts`
- `src/main/runtime/RuntimeSidecarClient.ts`
