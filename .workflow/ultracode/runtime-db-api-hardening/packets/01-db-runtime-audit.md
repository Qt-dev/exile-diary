# Packet 01-db-runtime-audit: DB and runtime lifecycle audit

## Objective
Trace the exact migration interruption and runtime readiness hazards and recommend the smallest safe implementation.

## Context
Issue #462 reports `area_info` missing after clean install; profile saves currently trigger background DB initialization and relaunch.

## Sources
`src/main/db`, `SettingsManager.ts`, runtime-sidecar sources, and matching tests.

## Ownership
Read-only agent.

## Do
Inspect transaction/version ordering, DB path context, sidecar readiness/health, profile-change relaunch, and test gaps. Cite files and lines.

## Do not
Do not edit files or duplicate the API audit.

## Expected output
Evidence-backed hazards, required invariants, and focused tests.

## Verification
Source references and executable test recommendations.

## Handoff format
Summary, evidence, risks, recommended parent action.
