# DB/runtime audit result

The clean-install failure was traced to a readiness race in the runtime sidecar: an immediate readiness subscription could begin initialization, while a second caller observed only an `in progress` boolean and returned early. Background run tracking could then query `area_info` while migrations were incomplete. A thrown DB task also failed to release the serialized task queue, turning the original schema error into later IPC timeouts.

The audit also found non-atomic schema changes, version pragmas interleaved with DDL, profile DB paths depending on mutable global settings, and a full Electron relaunch racing the settings write.

Accepted recommendations:

- Use one shared initialization promise and explicit lifecycle states.
- Perform pending migrations in one transaction with the final schema version written last.
- Always release the DB queue on task failure.
- Validate the final schema before starting background services.
- Pass character and league explicitly to DB initialization.
- Replace full-app relaunch with a save barrier and controlled sidecar restart.
- Preserve non-empty databases on failure; back up and rebuild only empty partial databases.

