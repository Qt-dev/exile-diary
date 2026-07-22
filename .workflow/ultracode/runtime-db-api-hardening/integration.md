# Integration

## Accepted

- Shared runtime initialization promise and lifecycle contract.
- Atomic DB migrations, schema validation, and conservative empty-DB recovery.
- Explicit profile identity across settings and DB boundaries.
- Sidecar-owned GGG access with single-flight requests and bounded timeouts.
- Save barrier plus controlled sidecar restart for profile changes.
- Explicit character picker ownership after OAuth.

## Rejected

- Full Electron relaunch for profile changes.
- OAuth callback auto-selection of the current character.
- Automatic reset of any database that contains user data.

## Conflicts

None.

## Decisions

The parent agent owned shared contracts, implementation, and compatibility decisions. Read-only agents supplied independent DB/runtime and API/IPC discovery, followed by a final diff audit.

## Final changes

See `results/03-implementation.md`.

## Verification still needed

No required automated checks remain. Live OAuth/profile switching against GGG is intentionally not run because it requires user credentials and external state.

## Remaining risks

- Live behavior still depends on GGG availability and rate-limit headers.
- A damaged non-empty DB is preserved and reported rather than modified; manual recovery may be required.
- Renderer tests emit pre-existing React deprecation/future-flag warnings.
- Dependency installation reported two high-severity audit findings; dependency remediation was outside this change.
