# Packet 02-api-ipc-audit: GGG, profile, and IPC audit

## Objective
Trace duplicate GGG requests during OAuth/profile selection and characterize timeout/IPC coupling.

## Context
GGGAPI is imported in main and runtime; character save re-resolves the selected character.

## Sources
`GGGAPI.ts`, auth/deep-link flow, renderer services/routes, runtime contracts/client, and tests.

## Ownership
Read-only agent.

## Do
Map calls, caches/limiters, process ownership, timeout behavior, and backwards-compatible consolidation options. Cite files and lines.

## Do not
Do not edit files or audit SQLite internals.

## Expected output
Call budget, contract recommendations, test gaps, and integration risks.

## Verification
Source references and focused test recommendations.

## Handoff format
Summary, evidence, risks, recommended parent action.
