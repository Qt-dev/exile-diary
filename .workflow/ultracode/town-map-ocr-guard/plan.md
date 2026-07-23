# Town classification and OCR run guard

## Goal

Prevent town and hub entries from being treated as maps, and make OCR/run updates safe when no active run exists.

## Success criteria

- Packaged code classifies Karui Shores as a town.
- Curated hubs such as The Rogue Harbour and Kingsmarch remain non-map areas.
- Town entries do not emit `client-logs:entered-map` or schedule map-entry OCR.
- A zero-row run start is reported as false.
- OCR stat persistence does not throw when no incomplete run exists.

## Current context

The v1.11.4 packaged bundle puts the complete `worldAreas.json` object under a namespace default export. `Utils.getArea` scans only namespace values, so Karui Shores is missed. The log processor then emits a map-entry event, and the database layer later destructures a missing active run.

## Constraints

- Preserve normal map tracking and manual OCR behavior.
- Do not modify generated area data.
- Do not commit, push, publish, or release.
- Preserve unrelated user changes.

## Risk level

Medium: the change affects area classification, automatic screenshot gating, and run-state persistence.

## Approval gates

No additional approval is required for scoped source changes and local verification.

## Mode

Delegated workflow mode. Parent owns implementation and integration; side agents provide bounded test discovery and risk review.

## Work packets

- `01-test-discovery`: identify focused test seams and fixtures; read-only agent.
- `02-risk-review`: independently validate the failure chain and edge cases; read-only agent.
- `03-implementation`: parent changes classification and database guards and adds tests.
- `04-integration-verification`: parent integrates findings and runs required checks.

## Eval contract

- Outcome: towns/hubs never start map OCR, and missing-run OCR is a safe no-op.
- Shared surfaces: `helpers/constants`, `modules/Utils`, `modules/LogProcessor`, `db/repositories/run`.
- Required checks: targeted unit tests, main typecheck, production build, bundled classification probe.
- Blocking conditions: normal map entry stops emitting, packaged Karui Shores remains false, or no-run OCR still throws.
- Handoff evidence: changed-file diff plus command output recorded in the final report.

## Integration policy

The parent reviews all agent findings against source, owns every code edit, and rejects suggestions that expand beyond the confirmed failure chain.

## Verification plan

1. Run focused Utils, LogProcessor, and run-repository tests.
2. Run `npm run typecheck:main`.
3. Run `npm run build:app`.
4. Probe the built Utils chunk for Karui Shores, The Rogue Harbour, Kingsmarch, a hideout, and a normal map.
5. Inspect the final diff.

## Completion criteria

All required checks pass, workflow artifacts contain evidence, and no unrelated files are modified.
