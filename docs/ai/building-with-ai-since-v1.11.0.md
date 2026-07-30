# Building Exile Diary with AI since v1.11.0

## A field guide for onboarding and presenting the work

**Period covered:** July 20–30, 2026  
**Baseline:** `v1.11.0`  
**End point:** `v1.11.8`  
**Audience:** an engineer who is new to AI-assisted software development

---

## The short version

Since v1.11.0, Exile Diary has been built through a sequence of small release
milestones rather than one long AI conversation. Each milestone starts with raw
evidence and an explicit outcome, narrows the affected subsystem, chooses the
cheapest test that can prove the change, and preserves the result in code,
tests, runbooks, or workflow reports.

The AI is being used as an engineering collaborator, not as an autocomplete
box:

1. **Diagnose from evidence.** Logs, failing modes, source entry points, and
   current behavior are supplied before proposing a patch.
2. **Write a contract.** The goal, invariants, constraints, checks, and blocking
   conditions are made explicit.
3. **Separate kinds of work.** Planning, implementation, and review are distinct
   prompt classes.
4. **Bound research.** Parallel investigation is used only when a question has a
   narrow, read-only output that can be integrated by one owner.
5. **Verify economically.** Focused tests come first; builds, app launches, and
   packaged smoke tests are reserved for risks that require them.
6. **Leave memory behind.** Difficult findings become regression tests,
   workflow artifacts, architecture context, or runbooks.

From `v1.11.0` to the `v1.11.8` release line, the repository history contains
roughly 70 commits and changes 220 files, with about 20,090 insertions and 2,805
deletions. Generated game data and lockfiles account for a meaningful part of
the raw line count, so those numbers show pace and scope—not hand-written code
volume.

---

## The release story

| Release | Date | Engineering story | AI-working lesson |
| --- | --- | --- | --- |
| `v1.11.0` | Jul 20 | Starting baseline | Establish a known release boundary before explaining later work. |
| `v1.11.1` | Jul 20 | Linux release build fix | A narrow CI failure deserves a narrow prompt and check. |
| `v1.11.2` | Jul 21 | Packaged runtime startup stabilization | Packaging bugs require packaged-path evidence and smoke checks, not only unit tests. |
| `v1.11.3` | Jul 22 | Database, runtime, API lifecycle hardening | Cross-subsystem work benefits from an explicit contract and bounded audits. |
| `v1.11.4` | Jul 22 | Runtime sidecar Day.js setup | Small follow-up fixes can be isolated after the larger lifecycle work. |
| `v1.11.5` | Jul 23 | Town/map OCR classification fix | Trace the whole failure chain, then patch the earliest safe boundary. |
| `v1.11.6` | Jul 24 | PoE 3.29 compatibility and automated data refresh | External schema changes should be normalized behind adapters and maintained by automation. |
| `v1.11.7` | Jul 28 | Map-end accounting and stash-loading recovery | Preserve user data under races; failed accounting must remain retryable. |
| `v1.11.8` | Jul 30 | Pricing redesign and Cloudflare/R2 delivery path | First stabilize the domain model, then add transport and operations around it. |

The commits tell the same story in compact form:

```text
fix: stabilize packaged runtime startup
Harden runtime database and API lifecycle
Fix runtime sidecar Day.js setup
Fix town map OCR detection
fix: adapt to PoE 3.29 item API
feat: automate PoE data refresh
Fix map-end item accounting
Refactor poe.ninja pricing layer
Add missing poe.ninja pricing rules
Prevent pricing failures from dropping map loot
Add Cloudflare pricing proxy and auth migration
Record Cloudflare cutover validation
Address Codex pricing review
Construct R2 SDK commands correctly
```

This is useful on a slide because it shows that AI-assisted work still looks
like ordinary engineering: observed failures, scoped fixes, refactors,
automation, review findings, and follow-up corrections.

---

## What changed in the way the app is built

### 1. Packaged behavior became a first-class test target

The v1.11.2 work touched Electron startup, credential storage, user-data path
resolution, GPU recovery, window creation, renderer behavior, and release
workflows. It also added dedicated packaged smoke scripts:

```text
scripts/smoke-packaged-renderer.mjs
scripts/smoke-packaged-sidecars.mjs
test/main/runtime/ElectronViteBuildContract.spec.ts
```

The lesson is that “works in dev” is not proof for an Electron application.
When the risk is app paths, bundled resources, native modules, sidecars, or
window startup, the prompt must name the packaged mode and require evidence
from that mode.

**Reusable prompt example**

```md
Class: diagnose, then implement

Goal:
Make the packaged Electron application start reliably without changing the
development behavior.

Mode:
packaged

Evidence:
Paste the exact startup log and stack trace here. Include the first failure,
not only the final renderer symptom.

Affected surfaces:
- Electron main startup
- runtime and OCR sidecar paths
- credential-store construction
- renderer entry HTML

Constraints:
- Preserve existing user-data locations and credentials.
- Do not weaken single-instance behavior.
- Keep unrelated working-tree changes intact.

Cheapest acceptable checks:
1. focused startup/path contract tests
2. application build
3. packaged renderer and sidecar smoke scripts

Done condition:
Both packaged smoke scripts pass and each changed startup branch has regression
coverage.
```

### 2. Runtime and database lifecycle work moved from symptoms to invariants

The v1.11.3 plan did not ask merely to fix an `area_info` error. It translated
the incident into durable rules:

> A profile DB cannot expose repositories before its schema is complete.

> Interrupted migrations cannot advance `user_version` or leave a silently
> accepted partial schema.

> Runtime IPC reports lifecycle state and typed failures instead of timing out
> generically.

That contract led to coordinated changes in database initialization,
`SettingsManager`, `GGGAPI`, runtime-sidecar lifecycle, IPC contracts, renderer
services, and tests.

The read-only investigation packet was deliberately narrower:

```md
Objective:
Trace the exact migration interruption and runtime readiness hazards and
recommend the smallest safe implementation.

Do:
Inspect transaction/version ordering, DB path context, sidecar
readiness/health, profile-change relaunch, and test gaps. Cite files and lines.

Do not:
Do not edit files or duplicate the API audit.

Expected output:
Evidence-backed hazards, required invariants, and focused tests.
```

This is a strong example of delegating a question rather than delegating vague
ownership. One implementation owner remains responsible for validating the
finding and integrating the change.

**Reusable prompt example**

```md
Class: plan

We have a clean-install failure where a repository can be reached before the
profile database schema is complete.

Produce an implementation plan, not code.

Trace:
- where the DB filename and profile context are selected
- transaction and `user_version` ordering
- all callers that can observe readiness
- relaunch/profile-change races
- how IPC represents starting, ready, and failed states

Required output:
1. a source-backed failure chain
2. invariants that the fix must establish
3. the smallest safe change set
4. focused regression tests
5. migration and user-data risks

Do not propose deleting or recreating a non-empty user database.
```

### 3. OCR bugs were treated as classification pipelines, not isolated crashes

The v1.11.5 incident began with a packaged-data import detail:

```text
worldAreas.json namespace shape
        ↓
Utils.getArea misses Karui Shores
        ↓
town is classified as a map
        ↓
entered-map event schedules OCR
        ↓
database update finds no active run
```

The plan encoded both the positive and negative behavior:

```md
- Packaged code classifies Karui Shores as a town.
- Curated hubs such as The Rogue Harbour and Kingsmarch remain non-map areas.
- Town entries do not emit `client-logs:entered-map` or schedule map-entry OCR.
- A zero-row run start is reported as false.
- OCR stat persistence does not throw when no incomplete run exists.
```

The change was then proven at multiple boundaries: focused tests, main
typecheck, production build, and a probe of the built chunk using known towns,
a hideout, and a normal map.

**Reusable prompt example**

```md
Class: implement

Goal:
Prevent town and hub entries from starting map OCR while preserving normal map
and manual OCR behavior.

Known failure chain:
Paste the import shape, classification result, emitted event, and final
no-active-run error here.

Invariants:
- known towns and curated hubs are never maps
- a normal map still emits map-entry behavior
- a missing active run makes OCR persistence a safe no-op
- generated area data is not hand-edited

Implement the smallest fix at the classification and persistence boundaries.

Checks:
- classification tests for Karui Shores, Rogue Harbour, Kingsmarch, a hideout,
  and a normal map
- log scheduling regression test
- no-active-run repository test
- main typecheck
- production build and bundled-data probe

Report skipped checks and remaining risk explicitly.
```

### 4. External API churn was absorbed behind compatibility adapters

PoE 3.29 changed item response shapes. Instead of spreading version checks
through the main process and renderer, the work established a shared
compatibility boundary.

The evaluation contract was short and measurable:

```md
Success criteria:
- Modifiers are consumed as text descriptions while retaining flag-based
  presentation metadata.
- `frameTypeId` is preferred and legacy frames still work.
- Historical stored payloads with string and separate modifier arrays render
  and parse.

Downstream consumers:
Item pricing, parser filters, item tooltips, and persisted raw-data display.
```

The same milestone brought the extractor into the repository, added validation
tests, and automated refresh through GitHub Actions. This changed maintenance
from “remember to update a submodule/data dump” to a repeatable workflow with
checks and documentation.

**Reusable prompt example**

```md
Class: review

Review this API compatibility change for data-loss and replay regressions.

New upstream behavior:
- modifiers now arrive as description text plus flags
- `frameTypeId` is the preferred identifier

Compatibility obligations:
- current responses parse
- legacy frame fields remain accepted
- historical persisted payloads still render
- pricing and parser filters retain the semantic information they use

Inspect every downstream consumer of the raw item shape. Return findings
ordered by severity with file/line evidence and the missing test that would
catch each issue. Do not edit code.
```

### 5. Map accounting was designed to fail retryably, not silently

The v1.11.7 work addressed a race-heavy user-data path. The final report states:

```text
Map completion now captures inventory for manual completion, waits for the
final snapshot, refuses to finalize on unavailable accounting, and does not
let one malformed item erase the rest of the run's profit.

Stash tabs now load on demand, subscribe to backend updates once, coalesce
concurrent requests, and recover after errors.
```

The most important product decision is hidden in the remaining-risk note:

> A snapshot that remains stale beyond all retries leaves the run open for a
> later attempt, intentionally avoiding permanent false-zero data.

That is an excellent AI prompt pattern: state which failure is safer. Without
it, an agent may optimize for “the flow finishes” and accidentally turn a
temporary outage into permanent incorrect history.

**Reusable prompt example**

```md
Class: implement

Bug:
At map end, inventory may still be stale or unavailable. Finalizing anyway
records permanent false-zero profit.

Desired failure policy:
Correct-but-delayed is safer than complete-but-wrong. If accounting cannot be
proven fresh after bounded retries, keep the run retryable and do not finalize
it.

Also ensure:
- manual and automatic completion use the same accounting boundary
- concurrent boundaries are serialized
- each final snapshot is bound to the event it closes
- one malformed item cannot discard other valid items
- stash-load calls coalesce and a failed call does not poison future retries

Add focused tests for stale snapshots, retries, concurrency, malformed items,
manual completion, and recovery after an error.

Do not launch the full app unless focused tests reveal an integration-only
uncertainty.
```

### 6. Pricing was separated into domain, transport, and operations

The v1.11.8 work is the clearest architectural milestone.

First, the old V2 pricing layer was replaced with a typed subsystem:

```text
src/main/pricing/
  PricingService.ts
  matching/
  poe-ninja/
  snapshots/
  transports/
```

The work added explicit category catalogs, response adapters, league
resolution, item identities, matching rules, schema-versioned snapshots, and a
legacy snapshot adapter. Only after that domain boundary was stabilized was an
R2 delivery path added.

The delivery milestone then introduced:

```text
shared pricing contracts and validation
Poe.ninja publisher with retries, ETags, and bounded concurrency
immutable snapshot promotion and rollback
direct, fixture, and R2 desktop transports
ETag and daily SQLite caching
GitHub Actions publication
Cloudflare and migration runbooks
```

Crucially, local implementation did not imply production authorization. The
workflow report records that no R2 upload, credentials, billing, DNS, or
deployment changes were performed. Operational mutation remained behind a
manual release gate.

The independent review also found two blockers—legacy destination-table
assembly and partial index preservation—which were fixed before release. This
is the review loop working as intended, not evidence that the first pass
“failed.”

**Reusable architecture prompt**

```md
Class: plan

Goal:
Replace the current poe.ninja pricing implementation with a typed subsystem
that can later support direct, fixture, and proxy transports.

Plan the domain layer before the proxy.

Required boundaries:
- canonical pricing types and category catalog
- upstream response adapters
- league resolution
- safe item identities and matching rules
- schema-versioned snapshots
- replay of legacy snapshots
- transport interface independent of matching

Inventory every current consumer before moving code.

For each phase provide:
- files owned
- compatibility risks
- focused tests
- migration/rollback behavior
- completion evidence

Do not add infrastructure or deploy anything in this phase.
```

**Reusable delivery prompt**

```md
Class: implement

Goal:
Add an R2-backed pricing delivery path around the stable canonical pricing
contract.

Required behavior:
- publisher uses bounded concurrency, retries, ETags, and immutable snapshots
- promotion is atomic and rollback remains possible
- a partial publication cannot erase index entries for other leagues
- desktop validates payloads before caching
- stale local data remains usable when the network fails
- direct and fixture transports remain available

Authorization boundary:
Implement code, tests, workflows, examples, and runbooks locally. Do not use
credentials, create cloud resources, upload data, alter DNS, incur billing, or
deploy.

Verification:
Run focused publisher/transport tests, main typecheck, workflow validation, and
an independent release-blocker review. Report every external check that remains
manual.
```

---

## The prompt system behind the work

### Start by naming the prompt class

The repo uses three prompt classes:

- **Plan:** choose approach, trade-offs, or order; do not edit.
- **Implement:** make a scoped change and verify it.
- **Review:** find regressions, missing tests, and unsafe assumptions; normally
  do not edit.

Separating them prevents a common failure mode: a conversation begins with
uncertain diagnosis, starts editing too early, and then “reviews” its own
unexamined assumptions.

### Use a request packet

This is the minimum reusable packet:

```md
Goal:
Affected subsystem/files:
Repro or desired behavior:
Constraints:
Cheapest acceptable checks:
Done condition:
```

For bugs, add:

```md
Mode: dev | build | test:app:smoke | packaged
Exact error/log:
Repro steps:
```

### Add a safety preference when outcomes compete

Examples from this release sequence:

- Preserve a non-empty user DB rather than recovering destructively.
- Leave a run retryable rather than recording false-zero profit.
- Keep legacy snapshot replay rather than silently invalidating history.
- Keep stale validated pricing rather than dropping map loot on a transient
  pricing failure.
- Write infrastructure and runbooks locally without assuming permission to
  deploy.

The prompt should say which side wins. “Handle errors safely” is too vague.

### Choose proof by risk, not by habit

```text
1. Targeted tests
2. Subsystem smoke or benchmark
3. Typecheck or build slice
4. Full app launch
5. Packaged smoke
```

Examples:

- A DB repository condition can be proven with focused repository tests.
- A renderer store fix needs focused renderer tests, not necessarily an app
  launch.
- A bundled JSON import or sidecar path needs a production build or packaged
  probe.
- A packaging fix deserves packaged smoke.

The map-accounting report explicitly says full launch and packaged smoke were
skipped because startup, packaging, and native integration were unchanged.
That is disciplined verification, not incomplete verification.

### Escalate after evidence, not frustration

The working rules are:

- After one failed implementation pass, restate the likely root cause.
- After two failed verification loops, stop patching and switch to
  diagnosis/options.
- Upgrade reasoning capacity immediately when a task expands across renderer,
  main, sidecar, startup, or packaging boundaries.

---

## A complete prompt sequence to demonstrate live

Use one bug and show that prompts evolve with knowledge.

### Prompt 1 — diagnosis

```md
Class: diagnose

In packaged mode, entering Karui Shores is treated as entering a map and later
causes an OCR update with no active run.

Here are the exact logs:
[paste logs]

Trace the failure from packaged data import through area lookup, event
emission, OCR scheduling, and run persistence. Do not edit code.

Return:
1. the earliest incorrect state
2. every downstream symptom
3. source references
4. the smallest safe correction boundaries
5. focused tests that prove towns, hubs, hideouts, and maps separately
```

### Prompt 2 — contract

```md
Turn the diagnosis into an implementation contract.

Include:
- goal and non-goals
- positive and negative acceptance criteria
- constraints
- affected surfaces
- required checks
- blocking conditions
- remaining manual verification

Do not propose implementation yet.
```

### Prompt 3 — implementation

```md
Implement the approved contract.

Preserve normal map tracking and manual OCR. Do not modify generated area data
or unrelated working-tree changes.

Run the focused test set first. If it passes, run main typecheck, production
build, and a built-output classification probe.

Stop and diagnose if the first implementation fails; do not stack speculative
patches.
```

### Prompt 4 — independent review

```md
Class: review

Review the resulting diff against the contract. Look specifically for:
- false negatives for real maps
- curated hubs missing from classification
- namespace/default-import differences between test and build
- zero-row DB updates being reported as success
- missing-run OCR writes
- tests that only prove mocks rather than bundled behavior

Return findings by severity with file/line evidence. Do not edit.
```

### Prompt 5 — handoff

```md
Prepare a concise engineering handoff:
- outcome
- failure chain
- changed boundaries
- checks and exact results
- skipped checks and why
- remaining risk
- next useful live verification

Do not claim checks that were not run.
```

This sequence is more educational than demonstrating one giant prompt. It shows
how an engineer stays in control while the AI contributes search, synthesis,
implementation, test design, and review.

---

## Extracts worth showing on slides

### “A profile DB cannot expose repositories before its schema is complete.”

Use this to explain turning a bug into an invariant.

### “Correct-but-delayed is safer than complete-but-wrong.”

This paraphrases the map-accounting policy. Use it to explain that agents need
product-level failure preferences, not only technical instructions.

### “Parent owns implementation and integration; read-only agents independently audit.”

Use this to explain bounded parallel research and single-owner integration.

### “No live upstream requests, R2 uploads, credential use, billing changes, DNS changes, Cloudflare configuration, or deployment.”

Use this to explain authorization boundaries. Generating deployable code is not
the same as authorizing a deployment.

### “The review wave found and the parent resolved two release blockers.”

Use this to frame review as a separate engineering phase with independent
value.

---

## Coaching notes for the new engineer

### Give the AI the evidence you would give a strong teammate

Paste the first meaningful error, the operating mode, and the shortest repro.
Do not summarize a stack trace as “the app crashes.” A source-backed diagnosis
is cheaper than several confident guesses.

### Ask for a result, not activity

Weak:

```text
Look around the database code and improve it.
```

Better:

```text
Prove that no repository can be returned before its schema transaction commits,
and add a regression test for an interrupted migration.
```

### Name non-goals

“Do not edit generated data,” “do not recreate non-empty databases,” and “do
not deploy” prevented plausible but unwanted solutions during this release
sequence.

### Ask for negative tests

The best regressions here often prove what must **not** happen:

- a town must not emit map entry
- a partial migration must not advance the schema version
- a stale snapshot must not finalize a run
- a pricing outage must not erase loot
- a partial publish must not erase other league entries

### Make the agent report uncertainty honestly

A useful handoff names skipped checks and remaining risks. “All tests pass” is
not equivalent to “the feature has been exercised live against production.”

### Preserve discoveries

The repository now contains:

- `docs/ai/context/` for subsystem orientation
- `docs/ai/runbooks/` for recurring failures
- `docs/runbooks/` for operational procedures
- `.workflow/ultracode/` for plans, contracts, packets, results, and audits
- focused tests for behavior that previously required rediscovery

That memory is one of the highest-leverage outputs of the AI workflow.

---

## Suggested 20-minute presentation

### 1. The thesis — 2 minutes

“AI did not replace the engineering loop. It made the loop easier to state,
execute, review, and preserve.”

Show the six working principles from the short version.

### 2. The release timeline — 3 minutes

Show the v1.11.0–v1.11.8 table. Emphasize that the work moved from startup
reliability through lifecycle correctness and data compatibility into domain
architecture and operations.

### 3. One traced bug — 5 minutes

Use the town/OCR chain. It is visual, concrete, and crosses build-time import,
classification, events, OCR, and persistence without being too large.

### 4. One data-integrity decision — 3 minutes

Use map accounting: leave a run open rather than finalize false-zero profit.
Explain why the human must state this preference.

### 5. One architecture milestone — 4 minutes

Use pricing: domain model first, transports second, deployment gated
separately. Mention that independent review found release blockers.

### 6. Live prompt sequence — 3 minutes

Show diagnosis → contract → implementation → review → handoff. If time is
short, present the prompts without running them.

---

## Source trail

Repository evidence used for this guide:

- Git history from `v1.11.0` through the `v1.11.8` release line
- `docs/ai/playbook.md`
- `docs/ai/model-routing.md`
- `.workflow/ultracode/runtime-db-api-hardening/`
- `.workflow/ultracode/town-map-ocr-guard/`
- `.workflow/ultracode/poe-329-api-compatibility/`
- `.workflow/ultracode/2026-07-27-map-overlay-stash-load/`
- `.workflow/ultracode/2026-07-29-poe-ninja-pricing-rework/`
- `.workflow/ultracode/2026-07-29-r2-pricing-proxy/`
- `docs/ai/runbooks/poe-data-extraction.md`
- `docs/runbooks/pricing-proxy.md`
- representative implementation and regression-test diffs

The longer prompts in this guide are **reconstructed reusable examples** based
on those checked-in plans, contracts, reports, commits, and tests. They should
not be presented as verbatim historical chat logs. The quoted invariant and
report extracts are taken directly from repository artifacts.
