# Result 01-test-discovery: Focused regression test discovery

## Summary

The narrow seams are a pure area-classification test, `LogProcessor.processOther` plus its emitter, repository tests using the existing DB mock, and the electron-vite build contract.

## Evidence

- Classification data and predicate: `src/helpers/constants.ts`, `src/main/modules/areaClassification.ts`, and `src/main/modules/Utils.js`.
- Entry emission gate: `src/main/modules/LogProcessor.ts`.
- Run update and missing-run seams: `src/main/db/repositories/run.ts` and `src/main/db/index.ts`.
- Focused tests: `UtilsAreaClassification.spec.ts`, `LogProcessorScheduler.spec.ts`, `run.spec.ts`, and `ElectronViteBuildContract.spec.ts`.

## Handoff

Handoff:

- Summary: Keep all four focused test groups and execute a real production bundle probe.
- Changed surfaces: None; read-only packet.
- Contracts satisfied: Test seams cover classification, emission, SQLite changes, and no-run persistence.
- Assumptions: The production probe is required because source transforms do not reproduce the old Rollup namespace shape.
- Local checks: Source inspection only.
- Integration evidence: Parent implemented and ran the recommended checks.
- Risks: A static import contract alone is syntax-sensitive, so it is paired with bundle execution.

## Files changed

None.

## Decisions

Accepted the recommended focused test seams.

## Risks

`setCurrentAreaInfo` has an unused synthetic run-id fallback, but it is outside this confirmed call chain.

## Verification run

Read-only source inspection.

## Open questions

None blocking.
