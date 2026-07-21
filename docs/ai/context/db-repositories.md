# DB and Repository Context

## What Lives Here
- SQLite initialization
- extension loading
- repository methods for items, rates, runs, settings, stash, and stats

## Primary Entrypoints
- `src/main/db/index.ts`
- `src/main/db/sqlite-regex--cjs-fix.ts`
- `src/main/db/repositories/`

## Common Risks
- ABI mismatch reported as DB failure
- schema or empty-state assumptions
- extension path differences across modes
- repository behavior that is easy to verify without full startup

## Cheapest Checks
- targeted tests in `test/main/db/`
- `npm run benchmark:db`
- `npm run typecheck:main`

## Use Full Launch When
- the failure only appears once DB logic is exercised through app startup, sidecars, or renderer integration
