# Test Harnesses Context

## What Lives Here
- focused Jest suites
- renderer smoke tests
- app startup benchmarks
- OCR and DB benchmarks
- packaged or build-sensitive smoke flows

## Primary Commands
- `npm test`
- `npm run test:main`
- `npm run test:renderer`
- `npm run test:ui:smoke`
- `npm run benchmark:app:start`
- `npm run benchmark:db`
- `npm run benchmark:ocr:scan-map-mods`
- `npm run build:app`
- `npm run test:app:smoke`

## Common Rules
- prefer targeted suites first
- use benchmarks for subsystem proof before full app launch
- use `test:app:smoke` only when build output or packaged behavior is part of the risk

## Escalation
- if targeted tests and benchmarks are green but the real app still fails, move to full launch
- if full launch is noisy, isolate whether the issue belongs to startup, sidecar, DB, or OCR before widening the checks
