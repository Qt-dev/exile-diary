# Orchestration

## Parent critical path
Own shared contracts, DB migration changes, runtime/profile coordination, integration, and final verification.

## Packets
- 01 DB/runtime audit: read-only.
- 02 GGG/profile/IPC audit: read-only.
- 03 implementation: parent.
- 04 final review: optional read-only second wave.

## Delegation
Use two parallel native agents for independent discovery, then at most one review agent after integration.

## Agents
Agents may inspect `main` sources and tests but must not edit files.

## Delegation limits
Maximum three agents and two waves.

## Wait points
Wait for discovery before finalizing public contracts; do not wait before local DB implementation work.

## Fallback
If agents fail, the parent performs the packet using the same evidence requirements.

## Verification order
Focused tests, typechecks, full main tests, build, diff audit.
