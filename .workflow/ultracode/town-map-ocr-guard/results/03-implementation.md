# Result 03-implementation: Classification and run guards

## Summary

Implemented stable world-area imports, a testable non-map hub predicate, truthful active-run detection, and safe OCR persistence without an active run.

## Evidence

- `worldAreas.json` is a default import with an explicit container type.
- `isTownArea` combines curated town strings with duplicate-safe area flags.
- `Utils.isTown` delegates to the tested predicate.
- `updateCurrentRunFirstEvent` returns true only when SQLite changed a row.
- `setCurrentRunStats` returns false instead of destructuring a missing run.

## Handoff

Handoff:

- Summary: Confirmed failure chain is corrected and hardened.
- Changed surfaces: Constants, area classification, Utils, run repository, focused tests.
- Contracts satisfied: Town suppression, normal map preservation, zero-row false, missing-run no-op.
- Assumptions: Existing curated `townstrings` remain authoritative overrides.
- Local checks: Focused tests, typecheck, build, bundle probe, full main suite.
- Integration evidence: All required checks passed.
- Risks: OCR UI messaging does not distinguish skipped persistence.

## Files changed

- `src/helpers/constants.ts`
- `src/main/modules/areaClassification.ts`
- `src/main/modules/Utils.js`
- `src/main/db/repositories/run.ts`
- `test/main/modules/UtilsAreaClassification.spec.ts`
- `test/main/modules/LogProcessorScheduler.spec.ts`
- `test/main/db/run.spec.ts`
- `test/main/runtime/ElectronViteBuildContract.spec.ts`

## Decisions

Extracted the predicate into TypeScript because Jest does not transform the legacy mixed-module `Utils.js` directly.

## Risks

No known blocking risk.

## Verification run

All checks recorded in the final report.

## Open questions

None.
