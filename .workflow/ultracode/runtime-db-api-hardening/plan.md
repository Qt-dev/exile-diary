# Runtime DB and API hardening

## Goal
Make clean-install database setup, runtime-sidecar readiness, profile changes, and GGG API access deterministic and recoverable.

## Success criteria
- A profile DB cannot expose repositories before its schema is complete.
- Interrupted migrations cannot advance `user_version` or leave a silently accepted partial schema.
- Saving or switching a profile does not kill an in-progress migration.
- Selecting a character does not make a redundant character-list request.
- Runtime IPC reports lifecycle state and typed failures instead of timing out generically.

## Current context
`main` is v1.11.2. Profile saves start DB initialization in the background and immediately emit a change that schedules an app relaunch. GGG caches and limiters are process-local.

## Constraints
- Preserve existing settings and DB filenames.
- Keep OAuth secrets in the credential store.
- Do not commit, push, publish, or deploy.
- Avoid destructive recovery for non-empty user databases.

## Risk level
High: migrations, auth/profile flow, process lifecycle, IPC, and renderer behavior are coupled.

## Approval gates
The user explicitly approved local implementation. No production migration, publishing, credential access, or destructive user-data operation is authorized.

## Mode
Delegated Ultracode workflow: parent owns implementation/integration; two read-only agents independently audit DB/runtime and API/IPC surfaces.

## Work packets
- 01: DB/runtime lifecycle audit (read-only agent).
- 02: GGG/profile/IPC duplication audit (read-only agent).
- 03: Parent implementation and focused tests.
- 04: Independent post-change review if capacity and time permit.

## Eval contract
Full contract in `eval-contract.md`.

## Integration policy
The parent validates every finding against source, owns shared contracts, and rejects recommendations that require incompatible settings or DB format changes.

## Verification plan
- Targeted DB, SettingsManager, GGGAPI, runtime-sidecar, service, and renderer tests.
- Main and renderer typechecks.
- Full main test suite and build when targeted checks pass.
- Diff and independent audit against the contract.

## Completion criteria
All required contract deliverables exist, required checks pass or are reported honestly, and final audit records remaining risk.
