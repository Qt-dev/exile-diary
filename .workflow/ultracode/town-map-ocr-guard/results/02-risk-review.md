# Result 02-risk-review: Independent failure-chain review

## Summary

The review independently reproduced the packaged classification failure and validated the planned safeguards.

## Evidence

- The old built artifact classified Karui Shores, The Rogue Harbour, and Kingsmarch as non-towns.
- Numeric JSON IDs such as `2_11_endgame_town` were reachable only through the namespace default object.
- Curated town strings are required for intentionally unflagged hubs including Rogue Harbour and Kingsmarch.
- SQLite `DB.run` returns a result with `changes`, making `changes > 0` the correct run-start signal.
- OCR persistence reaches `setCurrentRunStats`, where a missing active run previously threw.

## Handoff

Handoff:

- Summary: Use default JSON import, curated strings plus duplicate-safe flag matching, truthful SQLite changes, and a no-run guard.
- Changed surfaces: None; read-only packet.
- Contracts satisfied: Root cause and secondary error chain validated.
- Assumptions: Curated hub names are intentionally non-map areas.
- Local checks: Existing bundle probe and source inspection.
- Integration evidence: Parent rebuilt and executed the post-change bundle classifier.
- Risks: A no-run OCR completion can still display its OCR result even though persistence is skipped; it no longer crashes.

## Files changed

None.

## Decisions

Accepted duplicate-safe `.some()` semantics and added an Aspirants' Plaza fixture.

## Risks

Name-level classification affects duplicate area names, but inspected mixed-flag duplicates are staging/hideout cases where suppression is intended.

## Verification run

Read-only source and current-artifact inspection.

## Open questions

None blocking.
