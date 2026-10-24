---
title: 'History: signal-state changes'
type: 'feature'
ticket: '11'
created: '2026-10-24'
baseline_commit: '4be5a751111d53d61482c3fd64543a1a610fea9c'
status: 'done'
route: 'dispatch'
risk: 'medium'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-1-context.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-9-override-lifecycle-and-override-log-plan.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/ux-smart-traffic-light/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every `controller/state` reaches the live view and nothing is kept, so CAP-2 has no signal-state history. Nobody can see after the fact when the level, the aspects, the flood sensor, a fault or an override changed, or that a corridor ended on its own.

**Approach:** Build entry 11 per AD-5 (Persisting messages) and AD-7 rule 6.
- **Backend:** a persist handler and a preload job that store only real changes in `signal_state_change`, plus `GET /api/state-changes` with cursor paging.
- **Contracts:** the `StateChangeItem` DTO.
- **Dashboard:** `/log/states/`, which labels a `{NONE, X}` row "Override ended (link loss or fault)" using entry 9's `override_command` rows.

## Boundaries & Constraints

**Always:**
- **Dedup** (AD-5):
  - A `controller/state`, retained or not, is inserted only when one of these differs from the last persisted row: `level`, `signal_ns`, `signal_ew`, `flood`, `fault`, `override_mode`, `override_phase` or `override_command_id`.
  - An absent `override` stores three NULLs. `remainingS` and `power` are never stored.
  - `received_at` is the message's `receivedAt`.
- **Preload:** the job's `start()` reads the latest row into the dedup memory before handlers are registered (boot order in `index.ts`). An empty table means the first state always inserts.
- **Concurrency:** messages are dispatched concurrently, so the handler compares and updates the memory synchronously, before awaiting the insert. A failed insert restores the previous memory, if nothing newer has replaced it, so the next identical state retries. Errors are logged `[mqtt]` and never thrown.
- **`StateChangeItem`** (`contracts/src/api/state-changes.ts`, one export line in `contracts/src/index.ts`):
  - Fields: `{ receivedAt: iso, level, signals: { NS, EW }, flood, fault: boolean, override: StateOverride | null, overrideEnded: boolean }`.
  - `StateOverride` is reused from `mqtt/controller-state.ts`, never redeclared.
  - No auto-increment id is exposed.
- **`overrideEnded`:** true iff `override.mode` is NONE, `commandId` is present, and no `override_command` row with that id has mode NONE. That covers an id that's missing from the table. It's computed per page with one `IN (…)` query in `override_command.state-history.ts`, which is read-only.
- **`GET /api/state-changes`:**
  - Returns `Page<StateChangeItem>`, newest first by `received_at`.
  - `ListQuery` gives `limit` (1–200, default 50). The opaque `cursor` is base64url JSON of the last item's `[receivedAt]`. A bad cursor or limit gives 400 `VALIDATION_FAILED`.
- **`/log/states/` page** (`mockups/state-history.html`, DESIGN → Log table; EXPERIENCE wins over the mock):
  - **Data:** loads page 1 on mount and on every stream epoch, and doesn't append live. Load more follows `nextCursor`, 50 at a time.
  - **Columns:** Time (Asia/Manila time, with the date in micro type, through `formatManila`), Level (`LevelBadge` and its label), NS aspect and EW aspect (`AspectLamp` and the word), Flood, Fault (`faultVisual`), and Override (the mode, plus phase for CORRIDOR, or "None").
  - **Ended rows:** an `overrideEnded` row shows "Override ended (link loss or fault)" in the Override cell, on a hazard-edged plate.
  - **Row marks:** the first row of page 1 carries a "Latest" flag. A cell that differs from the next older loaded row is marked, and a legend explains the mark. L4 and fault rows get the mock's row edge, and a fault row is never shown as L4.
  - **Empty:** "No state changes recorded."
  - **REST failure:** an inline notice with the code.
  - Every label and token comes from `visuals.ts`.
- **Tests:**
  - Backend: handler and preload against `stl_test` with `resetDb`, and the route through Supertest on `createApp(deps)`.
  - Dashboard: under `LiveTestProvider`, with `fetch` stubbed.

**Never:**
- No SSE for state history, and no live append.
- No edits to entry 8's `controller-state.slice.ts` or `services/state.ts`, to entry 9's files (except reading its table), to `index.ts` or `app.ts`, or to the migration. No dependency, no `package.json` or lockfile edit.
- Edits to shared indexes are limited to one line each: `handlers/index.ts`, `jobs/index.ts`, `routes/index.ts` and `contracts/src/index.ts`.
- None of the mock's filter chips, "Cmd" times, explanatory sub-captions or day separators.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First state | empty table; state arrives | 1 row | — |
| Republish | same state again, retained or not, `remainingS` or `power` differing | no row | — |
| Change | any one of the 8 fields differs | 1 new row with `receivedAt` | — |
| Restart | latest row is X; job starts; state equal to X arrives | no row | — |
| Burst | two different states dispatched concurrently, then the first repeated | 2 rows, then none | — |
| Insert fails | DB throws | logged; the next identical state inserts | — |
| Ended | row `{NONE, a}`, a is CORRIDOR in `override_command` | `overrideEnded: true` | — |
| Release | row `{NONE, r}`, r is a NONE command | `overrideEnded: false` | — |
| Boot NONE | `{NONE}` without commandId, or no override | `false`; override `{mode:"NONE"}` or null | — |
| Paging | 3 rows; `limit=2` | newest 2 + cursor; next gives the 3rd, `nextCursor: null` | bad cursor / `limit=0` → 400 |
| Page | rows, then epoch increments | page 1 shown, refetched on epoch; ended row labeled; changed cells marked | REST failure → inline notice; empty → "No state changes recorded." |

</frozen-after-approval>

## Code Map

- **Backend registries:**
  - `backend/src/mqtt/handlers/index.ts`: `HandlerCtx {receivedAt, retained, pool, hub, publisher, link, getLink}`. Register `controllerStatePersist` alphabetically, after `controllerStateLink` and before `controllerStateResolve`. `controller-state.resolve.ts` is the handler pattern.
  - `backend/src/mqtt/client.ts:dispatch`: runs every handler for a topic with `Promise.all`. MQTT.js doesn't await between messages.
  - `backend/src/jobs/index.ts`: `Job {start, stop}`. Register `stateDedupPreload` after `overrideTimeouts`. `start()` is awaited before handlers register (boot order in `backend/src/index.ts`). `stop()` is a no-op.
  - `backend/src/http/routes/index.ts`: register `stateChanges` alphabetically (after `overrides`, before `stream`). `routes/overrides.ts` is the route pattern.
- **Patterns to copy:**
  - Cursor and `ListQuery` paging: `services/overrides.ts` `encodeCursor`, `decodeCursor` and `listOverrides`, with `AppError("VALIDATION_FAILED")` on a bad cursor. Put the equivalent in `routes/state-changes.ts` or in the repository, since this entry owns no service file.
  - Row-to-DTO mapping: `db/repositories/override_command.list.ts`.
- **Schema:** `backend/db/migrations/20261023011004_create_m1_tables.sql` has `signal_state_change`: nullable `override_mode`, `override_phase` and `override_command_id`; `received_at DATETIME(3)`, indexed. The pool uses UTC (`timezone: 'Z'`).
- **Tests:** `backend/src/services/overrides.test.ts` (`resetDb`, `createPool(config…)`, `dispatch` with `handlers`, `createHub`, `createLink`) and `routes/overrides.test.ts` (Supertest).
- **New backend files:**
  - `mqtt/handlers/controller-state.persist.ts`: also exports `preloadStateDedup(pool)`, which the job calls.
  - `jobs/state-dedup-preload.ts`.
  - `http/routes/state-changes.ts`.
  - `db/repositories/signal_state_change.{latest,insert,list}.ts`.
  - `db/repositories/override_command.state-history.ts`.
- **Contracts:** `contracts/src/mqtt/controller-state.ts` has `StateOverride`. `enums.ts` has `Level`, `Aspect` and `Flood`. `scalars.ts` has `isoUtc`. `contracts/schema/` covers MQTT only, so no regeneration is needed.
- **Dashboard:**
  - New: `lib/api/state-changes.ts` (`listStateChanges(query?)` through `apiList`), `app/log/states/page.tsx`, and `components/state-history/`.
  - `components/override-log/override-log.tsx` is the template for the housing, the table, the epoch refetch, Load more, the empty state and the error notice. Reuse its time cell pattern, but don't import from it.
  - Reused atoms: `components/ui/level-badge.tsx` `LevelBadge({level})`, `components/ui/aspect-lamp.tsx` `AspectLamp`, `styles.ts` (`stencil`, `hazardStripes`), and `lib/visuals.ts` (`levelVisuals`, `aspectVisuals`, `floodVisuals`, `faultVisual`, `overrideModeVisuals`, `phaseVisuals`).
  - The nav tab "State history" already links `/log/states/`.
- **Live check:** same setup as story 9: broker, `npm run dev`, and the simulator from `feat/m1-5-simulator-vision` through `git archive` with a `node_modules` junction. Use the REPL (`level`, `flood on|off`, `conflict raise|reset`) and POST overrides, then count rows in `stl`. For the restart, stop the backend, restart the `MySQL80` service if permitted, and restart the backend.

## Tasks & Acceptance

**Execution:**
- [x] `contracts/src/api/state-changes.ts` + `contracts/src/index.ts` line -- the `StateChangeItem` schema, with a contracts test.
- [x] `backend/src/db/repositories/signal_state_change.{latest,insert,list}.ts`, `override_command.state-history.ts` -- parameterized SQL and the row → DTO mapping.
- [x] `backend/src/mqtt/handlers/controller-state.persist.ts`, `backend/src/jobs/state-dedup-preload.ts`, `backend/src/http/routes/state-changes.ts`, plus three registration lines -- dedup, preload and the paged route.
- [x] Backend tests -- every backend matrix row.
- [x] `dashboard/src/lib/api/state-changes.ts`, `components/state-history/*`, `app/log/states/page.tsx`, with tests -- the page rows of the matrix.

**Acceptance Criteria:**
- Given the broker, `npm run dev` and the simulator: when the REPL changes the level, the flood or the fault, or a corridor is applied and released, then each change adds exactly one row. Then 30 s of 2 s republishes add none.
- Given a corridor applied, then `conflict raise`: `/log/states/` shows the `{NONE, X}` row as "Override ended (link loss or fault)" in Asia/Manila time, newest first.
- Given the backend and MySQL restarted, then the rows are still listed, and a retained state equal to the last row adds none.
- When `npm run typecheck`, `npm run lint`, `npm test` and `npm run build -w dashboard` run, then all exit 0.

## Implementation Notes

- The dedup key is the eight compared fields as a JSON tuple; the memory is `undefined` (not loaded), `null` (empty table) or that key. The handler's own load (boot-order fallback) only fills the memory if it is still `undefined`, so a late load can't overwrite a newer key.
- The preload job catches and logs `[job]`; on failure the memory stays unloaded and the first message loads it.
- Paging and `overrideEnded` live in `routes/state-changes.ts` (this entry owns no service). The same-millisecond paging gap is a `shortcut:` comment in `signal_state_change.list.ts`.
- Burst matrix row read as: concurrent A, B, B give 2 rows, and repeating B (the latest) gives none. Repeating A after B is a real change and inserts, per the dedup rule.
- Page: the Override cell of an ended row shows only the hazard-edged plate. A fault row keeps its `LevelBadge` (the level keeps reporting the automatic level) but takes the checker edge, never the L4 edge. History lenses are steady and unglowing (`AspectLamp stale`). Legend L4 and fault labels come from `levelVisuals.L4` and `faultVisual(true)`; "Latest", "Changed from the row below" and the ended text are copy in the component.
- **Level cell:** shows the label without its level prefix ("Fixed timing" beside the L3 badge), the same as the ladder on `/`. The first live screenshot read "L3 · L3 Fixed timing".

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind, edge, verification-gap | Duplicate React keys when two rows share a `receivedAt` | low | `key={item.receivedAt}`. The backend admits same-millisecond rows (the `shortcut:` comment). Adding the index is a direct correction | patch |
| 2 | verification-gap, blind | The Load more epoch guard and its failure notice are untested | medium | Deleting the guard or `setMoreError` passes every state-history test. The override log has both tests | patch |
| 3 | verification-gap | The handler's own load when the memory is unloaded is never run | medium | `beforeEach` always preloads. Removing the `last === undefined` block passes every test, and a failed preload plus the retained republish would duplicate the latest row | patch |
| 4 | edge | Preload picks the latest row by `received_at`, so a backward clock step seeds the wrong row | low | AD-5 wants the last persisted row. `ORDER BY id DESC` is a direct correction | patch |
| 5 | blind | Changed-cell marks are visual only | low | `data-changed` with no text. EXPERIENCE: color is never the only cue (WCAG 2.2 AA). An sr-only word is a direct addition | patch |
| 6 | edge | Insert A fails after a later message equal to `prev` took over the memory: duplicate `prev` row | low | Needs a DB failure inside one insert's window plus a revert to the exact previous state. The fix serializes inserts | reject |
| 7 | blind | The paging shortcut could carry a per-millisecond offset | low | Already a `shortcut:` limit (Design Notes). The offset adds query and cursor complexity for a near-impossible tie | reject |
| 8 | blind | Same-millisecond ordering is untested | low | Covered by the documented shortcut; no user-visible defect shown | reject |
| 9 | blind | `toState` validates only the override | low | Rows are written only by this handler from `ControllerState`-parsed payloads, so a bad enum can't reach the table through the app | reject |
| 10 | blind | No loading state | low | Same as story 9 (its entry 11): EXPERIENCE gives REST failure an inline notice, and the shell Loader covers connect | reject |
| 11 | blind | No retry after a failed first load | low | Same as story 9 (entry 11). The epoch refetch and Load more recover | reject |
| 12 | blind | The page goes stale and "Latest" misleads | low | EXPERIENCE → State history: "Refetches page 1 on each stream epoch; it does not append live". The frozen rule puts Latest on the first row of page 1 | reject |
| 13 | blind | The table is wider than most screens | false | TV only, 1920×1080, with no breakpoints (EXPERIENCE → Responsive), as in story 9 entry 14 | reject |
| 14 | blind | Route tests miss `limit=200`, the default and an offset datetime | low | `ListQuery` coercion is tested in contracts; `z.iso.datetime()` rejects offsets by default | reject |
| 15 | blind | The story plan isn't in the diff | false | The plan goes to the edge-case layer only, by design | reject |
| 16 | blind | `overrideEnded` depends on releases staying in `override_command` | low | M1 has no purge. AD-19's M2 purge is out of scope and is a note for that story | reject |

## Design Notes

- **Cursor key:** the cursor carries only `receivedAt`, because the Public ids convention bans exposing the auto-increment id, even inside a cursor. The query is `received_at < ?` with `ORDER BY received_at DESC, id DESC`. Two changes received in the same millisecond on either side of a page boundary would lose one row from paging. Note that in the code as a `shortcut:` comment. One controller publishes one state per message, so this is near impossible.
- **Dedup memory:** module state in `controller-state.persist.ts`, as `undefined` (not loaded) or a key string. The job only fills it. If a message arrives before the preload has finished, which the boot order prevents, the handler loads it itself.

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build -w dashboard` -- expected: all exit 0.

**Manual checks:**
- The Acceptance Criteria runs against the simulator, with row counts from `stl` and `/log/states/` in headless Edge at 1920×1080, recorded here.

**Recorded (2026-10-24):**
- `npm run typecheck`, `npm run lint`, `npm test` (contracts 184, backend 112, dashboard 137) and `npm run build -w dashboard` all exit 0.
- **Implementer's pre-check:** with `mosquitto_pub` as the fake controller, each field change added +1 row, ten 2 s republishes added +0, the `{NONE, id}` row after a fault read `overrideEnded: true`, and a release read `false`.
- **Live run:** native Mosquitto, `npm run dev`, and the simulator from `feat/m1-5-simulator-vision` with `--roles controller`. Row counts come from `GET /api/state-changes` against `stl`, and `/log/states/` was open in headless Edge at 1920×1080.
  - **Changes:** with `level L3` the cycling aspects each added a row. CORRIDOR NS was applied (202) and its lead-in and green added +3 rows.
  - **Conflict fault:** `conflict raise` added +1 row, `{NONE, <corridor id>}` with `overrideEnded: true`. A later FLASHING_AMBER and then a release gave a release row with `overrideEnded: false`.
  - **Republishes:** after a fresh start, `conflict raise` gave a steady FLASHING_AMBER, and 30 s of 2 s republishes added +0 (32 rows, then 32). The first run's 30 s window was invalid, because the forced `level L3` kept the aspects cycling.
  - **Page:** 30 rows, newest first, with Asia/Manila times and dates. "Latest" is on the top row, and the changed cells are marked. Fault rows have the checker edge, and the corridor's ended row shows "Override ended (link loss or fault)" on a hazard plate. No horizontal scroll (scrollWidth 1905, with a vertical scrollbar).
  - **Backend restart** in the steady fault state: 30 rows before and 30 after. The retained `controller/state`, equal to the last row, added none.
- **Not done:** restarting the `MySQL80` service needs admin rights, which this session doesn't have. Rows are durable InnoDB rows, and the preload after a backend restart was checked live.
- **Left in the dev `stl` database:** the live-run rows (simulated history), plus the implementer's ~10 fake-controller rows and 2 `override_command` rows.
