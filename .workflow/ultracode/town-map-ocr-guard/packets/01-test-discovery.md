# Packet 01-test-discovery: Focused regression test discovery

## Objective

Identify the narrowest existing test seams for area classification, entered-map emission, zero-row run updates, and missing active runs.

## Context

Karui Shores is false in the packaged classifier because of the JSON namespace shape. The implementation will also harden run-state checks.

## Sources

- `src/helpers/constants.ts`
- `src/main/modules/Utils.js`
- `src/main/modules/LogProcessor.ts`
- `src/main/db/repositories/run.ts`
- `test/main`

## Ownership

Read-only agent.

## Do

- Inspect relevant existing test setup and mocks.
- Recommend exact spec files and test cases.
- Cite paths and nearby lines.

## Do not

- Edit files.
- Run destructive commands.
- Duplicate the independent risk review.

## Expected output

Concise test plan with fixtures, mocking requirements, and likely pitfalls.

## Verification

Evidence must come from repository files.

## Handoff format

Summary, evidence, recommended parent action, risks.
