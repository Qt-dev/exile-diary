# Integration

## Accepted

- Default import for `worldAreas.json`.
- Curated hub override plus duplicate-safe flag matching.
- SQLite `changes` as the active-run start signal.
- Missing-run stat persistence as a logged false/no-op.
- Focused source tests plus real production bundle execution.

## Rejected

- Expanding the change into the unused `setCurrentAreaInfo` fallback.
- Refactoring OCR completion messaging or runtime method contracts.

## Conflicts

None.

## Decisions

Parent owned all edits and extracted classification into a TypeScript helper so it can be tested without transforming legacy mixed-module `Utils.js`.

## Final changes

Area classification is stable across source and production bundles; town entries are gated; zero-row starts are false; missing-run stat writes are skipped.

## Verification still needed

None.

## Remaining risks

No live-game session was run. A late/manual OCR with no run still reports OCR output in the UI, but persistence safely no-ops instead of crashing.
