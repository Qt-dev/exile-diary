# Model Routing

Use the cheapest model that can plausibly finish the task without burning multiple failed loops.

## Current Codex Mapping
- `gpt-5.4-mini`: cheapest bounded work
- `gpt-5.4`: standard default for most repo work
- `gpt-5.5`: frontier choice for ambiguity, risk, and cross-subsystem reasoning

Portable mental model:
- `mini` = cheapest bounded work
- `standard` = default implementation and review
- `frontier` = high-ambiguity or high-risk work

## Quick Routing Table
| Task shape | Default model | Why |
| --- | --- | --- |
| Single-file cleanup or doc update | `gpt-5.4-mini` | Low ambiguity, low verification cost |
| Simple test addition | `gpt-5.4-mini` | Tight scope and cheap feedback |
| Straightforward search/explain request | `gpt-5.4-mini` | Mostly retrieval and summarization |
| Known bug with likely files and focused checks | `gpt-5.4` | Normal implementation path |
| Targeted refactor inside one subsystem | `gpt-5.4` | Moderate reasoning, bounded blast radius |
| Subsystem review with concrete scope | `gpt-5.4` | Better tradeoff than frontier |
| Architecture or migration planning | `gpt-5.5` | Broad reasoning and tradeoffs |
| Electron startup/runtime failure with unclear cause | `gpt-5.5` | Ambiguous, cross-cutting, expensive to loop |
| OCR, sidecar, or pathing issue spanning build and runtime | `gpt-5.5` | Multiple moving parts |
| Broad review across many files | `gpt-5.5` | Higher reasoning depth and risk detection |

## Default Rules
Start with `gpt-5.4-mini` when all of these are true:
- the task is single-file or tightly bounded
- the target behavior is explicit
- the checks are cheap and local
- failure cost is low

Start with `gpt-5.4` when any of these are true:
- the task touches one subsystem in a meaningful way
- the fix requires tests plus code changes
- the task is not trivial, but the files and checks are still fairly clear

Start with `gpt-5.5` when any of these are true:
- the failure mode is unclear
- multiple subsystems are involved
- startup, preload, windowing, sidecars, or packaging may be involved
- the first mistake would be expensive in time or regressions
- the output is architecture, migration, or broad risk review

## Upgrade and Downgrade Triggers
Upgrade:
- after one failed implementation pass
- after two failed verification loops
- immediately if the task grows from one subsystem into several
- immediately if you realize the repro is weak or the root cause is ambiguous

Downgrade:
- once the hard reasoning is done and the remaining work is mechanical
- when the task narrows to a simple patch, doc edit, or focused follow-up test
- when a frontier exploration has already produced a concrete fix plan

## Request Classifier
Use these labels before you start:

### `mini`
- update a markdown doc
- add one small focused test
- explain a benchmark command
- review a tiny diff for obvious issues
- tweak one renderer component with known acceptance criteria

### `default`
- fix a DB repository bug with targeted tests
- adjust one runtime subsystem with known entrypoints
- refactor a small section of main-process code
- add regression coverage around a known failure
- review a bounded subsystem diff

### `frontier`
- diagnose why `npm run dev` fails during startup with unclear logs
- plan or review a migration touching build, runtime, and sidecars
- debug OCR app-path or packaged-resource issues
- trace runtime-sidecar behavior across main process, bridge, and tests
- do a broad architectural review over many files

## Repo-Specific Examples
- Renderer-only UI tweak: start with `gpt-5.4-mini`; move to `gpt-5.4` only if store, preload, or route interactions become non-trivial
- DB repository bug with existing tests: use `gpt-5.4`
- Electron startup/runtime failure with unclear cause: use `gpt-5.5`
- OCR/runtime-sidecar/pathing issue: use `gpt-5.5`
- Broad refactor or migration plan: use `gpt-5.5`
- Routine doc or template update: use `gpt-5.4-mini`

## Cost Discipline Notes
- Do not pay frontier prices for tasks with explicit files, explicit checks, and low failure cost.
- Do not stay on a cheaper model after repeated failed loops; that usually costs more overall.
- When a frontier task becomes mechanical, move the follow-up work back down.
