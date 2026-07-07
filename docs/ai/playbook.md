# AI Playbook

## Prompt Classes
- `plan`: choose approach, tradeoffs, or implementation order
- `implement`: make the change and verify it
- `review`: find bugs, regressions, missing tests, and risky assumptions

Do not blur them unless the task truly needs both outputs in one session.

## Request Packet Template
Use this packet for most implementation work:

```md
Goal:
Affected subsystem/files:
Repro or desired behavior:
Constraints:
Cheapest acceptable checks:
Done condition:
```

For bug reports, add:

```md
Mode: dev | build | test:app:smoke | packaged
Exact error/log:
Repro steps:
```

## Milestone Template
Use one main thread per milestone when possible.

```md
Milestone:
Why it matters:
In scope:
Out of scope:
Checks to pass:
Commit boundary:
```

## Verification Ladder
Prefer the first level that can prove the change.

### 1. Targeted tests
- `npm test -- test/main/db/rates.spec.ts test/main/db/stats.spec.ts`
- `npm test -- test/main/runtime/RuntimeSidecarClient.spec.ts`

### 2. Subsystem smoke or benchmark
- `npm run test:ui:smoke`
- `npm run benchmark:db`
- `npm run benchmark:ocr:scan-map-mods`
- `npm run benchmark:app:start`

### 3. Typecheck or build slice
- `npm run typecheck:main`
- `npm run typecheck:renderer`
- `npm run build:app`

### 4. Full app launch
- `npm run dev`
- Reserve for startup, preload, sidecar, windowing, and integration risk

### 5. Packaged checks
- `npm run test:app:smoke`
- `npm run package:dir`
- Reserve for app-path, packaged resources, and distribution behavior

## Threading Rules
- Keep one primary implementation thread per milestone.
- Open side threads only for bounded research questions.
- If a side thread finds something reusable, distill it back into docs or runbooks.
- Avoid reopening the same discovery problem in multiple threads.

## Escalation Rules
- After one failed implementation attempt, pause and restate the likely root cause.
- After two failed verification loops, switch from patching to diagnosis/options mode.
- If the task crosses renderer, main, sidecar, and packaged behavior, upgrade the model before burning more loops.

## Prompt Hygiene
- Prefer milestone packets over chatty back-and-forth.
- Ask for exact outputs: implementation, review, or diagnosis.
- Include raw evidence early instead of paraphrasing stack traces.
- State the cheapest acceptable proof, not every possible check.
