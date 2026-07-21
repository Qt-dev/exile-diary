# SQLite Extension and Runtime Path Issues

## Typical Symptoms
- errors around `regexp.dll`, `regexp.so`, or `regexp.dylib`
- DB initialization works partially but extension loading fails
- behavior differs between dev, build, and packaged app paths

## Likely Cause
The SQLite regex extension path differs between source, build output, and packaged resources.

## First Checks
- confirm whether the failure is extension loading or general DB startup
- check whether the problem happens in dev, built app, or packaged path
- review runtime path helpers before editing DB query logic

## Cheapest Recovery Path
- verify the expected extension path for the current mode
- use focused path and DB tests before launching the app
- only run full startup once the path helpers and DB tests line up

## Good Verification
- `npm test -- test/main/db/sqlite-regex--cjs-fix.spec.ts test/main/db/index.spec.ts`
- `npm run build:app`
- app launch or smoke only if the issue depends on packaged resource placement

## Escalate When
- path helpers are correct but extension load still fails
- the failure is actually caused by ABI mismatch or sidecar startup rather than the extension path

## Helpful Paths
- `src/main/db/sqlite-regex--cjs-fix.ts`
- `src/main/db/index.ts`
- `src/main/db/extensions/`
- `test/main/db/sqlite-regex--cjs-fix.spec.ts`
