# Implementation result

Implemented the accepted DB, lifecycle, API, and profile-switch changes on `codex/runtime-db-api-hardening`.

Key behavior changes:

- DB tasks reject correctly and always advance the queue.
- Pending SQLite migrations are atomic and schema validation gates runtime startup.
- Known `area_info` partial-schema installs are repaired.
- Empty interrupted databases are retained as timestamped backups and rebuilt; databases with user data are never reset automatically.
- Runtime initialization is single-flight and exposes lifecycle state through health/events.
- Profile changes await explicit-profile DB preparation and durable settings persistence before a controlled sidecar restart.
- Renderer character queries route through the sidecar; OAuth no longer performs hidden profile discovery.
- GGG requests use single-flight coalescing, short caches, account-scoped character snapshots, rate limiting, and a 15-second HTTP timeout.
- Authentication refresh is performed in place; logout still restarts the isolated runtime.

Verification completed:

- Focused final regression suite: 42 passed.
- Full main suite: 375 passed.
- Full renderer suite: 19 passed.
- Renderer and main TypeScript checks passed.
- Production build passed.
- `git diff --check` passed.

The repository-wide Prettier check remains red on 332 pre-existing files, including most of `src` and `test`; no bulk formatting rewrite was applied.

