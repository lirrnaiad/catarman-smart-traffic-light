---
title: 'History: vehicle counts and the counts slice'
type: 'feature'
ticket: '12'
created: '2026-10-24'
baseline_commit: '7a8ad96d77d128f62c2d68a8d0b2f6edbc2ae758'
status: 'done'
route: 'dispatch'
risk: 'medium'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-1-context.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-3-backend-core-mqtt-ingest-and-link-health-plan.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `vision/counts` reaches the backend and is dropped. Nothing stores crossings, the SSE `counts` slice stays `null`, and entries 13 and 14 have no current-hour counts or hourly buckets to show. A fresh database also has no history to demo.

**Approach:** Build entry 12 per AD-5, AD-6, AD-8 and AD-12:
- a persist handler that stores each crossing once per message id;
- `services/counts.ts`, which writes the `counts` slice and builds the hourly buckets that entry 14's route calls;
- a job that seeds the slice at boot and pushes it at each Asia/Manila hour;
- a seed file with 24 h of demo counts.

This entry is backend only.

## Boundaries & Constraints

**Always:**
- **Persist** (`mqtt/handlers/vision-counts.persist.ts`, AD-5):
  - One `vehicle_count` row per crossing: `msg_id` = message `id`, `approach`, `vehicle_class`, `count`.
  - `occurred_at` comes from `occurredAt(ts, receivedAt)` (`services/occurred-at.ts`, AD-6), and `received_at` is the message's `receivedAt`. Retained or not, every message is persisted.
  - One multi-row `INSERT … ON DUPLICATE KEY UPDATE id = id`. If `affectedRows` is 0, the message is a redelivery: it triggers no slice refresh.
  - Unknown class ids that pass the contract's id pattern are stored as they are (AD-12).
  - Errors are logged `[mqtt]` and never thrown.
- **`services/counts.ts`** is the only writer of the `counts` slice (AD-8). It exports:
  - `refreshCounts(ctx, now)`: re-reads the Asia/Manila hour containing `now` and calls `setSlice("counts", HourCounts)`.
    - It runs after each insert that added rows, and from the job.
    - It is single-flight: a call while one is running marks it dirty and runs once more after.
    - It never skips a write because the value looks unchanged.
  - `hourlyCounts(pool, date)`: the `HourlyCounts` for an Asia/Manila `YYYY-MM-DD`, exactly 24 buckets in hour order. Empty hours are dense zeros.
  - Both build their buckets from one repository query, `vehicle_count.by-hour.ts`. It sums `count` grouped by the Asia/Manila hour of `occurred_at`, using `CONVERT_TZ(occurred_at, '+00:00', '+08:00')` (AD-6), and by approach and class. That way the slice and the chart bucket alike.
- **`HourCounts` contents:**
  - `hourStart` is the UTC instant of the Manila hour start, as ISO ending in `Z`.
  - `total` sums every count.
  - Each of `byApproach.N/S/E/W` is dense: every class id from `contracts/vehicle-classes.json`, in file order, at 0 when there are none, plus any unknown id seen in that hour.
- **Job** (`jobs/counts-slice.ts`):
  - `start()` awaits one `refreshCounts`, so the slice is set before MQTT connects.
  - It then schedules a `setTimeout` to the next hour boundary plus 50 ms, refreshes, and reschedules. Asia/Manila is UTC+8 with no DST, so Manila hours start on UTC hours.
  - `stop()` clears the timer and awaits any refresh in flight.
- **Seed** (`backend/db/seed/01-vehicle_count.sql`):
  - About 24 h of rows ending at `UTC_TIMESTAMP(3)`, across all four approaches and the configured classes.
  - The counts are deterministic, with motorcycles and tricycles dominant and peaks around 07:00 and 17:00 Asia/Manila.
  - It uses the fixed UUID-shaped prefix `00000000-5eed-` for `msg_id`. It first deletes rows with that prefix, so re-running `npm run db:seed` replaces the seed instead of doubling it.
  - It is MySQL 8.4+ SQL; a recursive CTE is fine.
- **Repositories:** `db/repositories/vehicle_count.{insert,by-hour}.ts`, parameterized SQL only. Times are UTC `DATETIME(3)`. Logs use `[mqtt]` and `[job]`.
- **Tests:**
  - Against `stl_test` with `resetDb`: the handler through `dispatch`, plus the service.
  - The job with fake timers and a fake hub.
  - The seed file applied through `scripts/db-seed.ts`'s `seed()`.

**Never:**
- No `/api/counts/hourly` route (entry 14), no dashboard work (entries 13 and 14), no `demand` slice (entry 13).
- No contract, migration, `package.json` or lockfile edit, and no dependency.
- No edits to `index.ts`, `app.ts` or core files. The only exceptions are one registration line each in `handlers/index.ts` and `jobs/index.ts`.
- Never compute PCU (AD-12).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Insert | `vision/counts` id A, 2 crossings | 2 rows; slice refreshed with them | — |
| Redelivery | id A again | no new rows; no refresh | — |
| Unknown class | crossing `vehicleClass: "kalesa"` | row stored; slice shows `kalesa` beside the dense configured ids | — |
| Old ts | `ts` 3 h ago | `occurred_at` = ts; the current-hour slice excludes it; `hourlyCounts` puts it in its hour | — |
| Bad ts | `ts` 2 days off | `occurred_at` = receivedAt, warning | — |
| Dense empty | no rows this hour | every approach has every configured id at 0, `total` 0 | — |
| Hour boundary | fake clock passes :00 | job pushes the new hour's slice (zeros) | — |
| Burst | 5 messages at once | ≤ 2 concurrent reads; final slice includes all 5 | — |
| Hourly | rows at Manila 07:xx and 17:xx on date D | 24 buckets; those two hours populated; `hourStart` = D 07:00 +08 as UTC | — |
| Insert fails | DB throws | logged, not thrown; no refresh | — |
| Seed | `seed()` twice | ~24 h of rows, same row count after the second run | — |

</frozen-after-approval>

## Code Map

- **Branch:** `feat/m1-12-vehicle-counts` is `feat/m1-2-backend-core-http-sse` (1.2 + 1.3) with `feat/m1-5-simulator-vision` merged in. It has none of entries 8, 9 or 11. When those land, the shared indexes take their alphabetical registration lines.
- **Registries:**
  - `backend/src/mqtt/handlers/index.ts`: `HandlerCtx {receivedAt, retained, pool, hub, publisher, link, getLink}`. Register `visionCountsPersist` alphabetically (after `controllerStatusLink`, before `visionHeartbeatLink`). `vision-status.link.ts` is the handler shape.
  - `backend/src/jobs/index.ts`: `Job {start(ctx), stop()}`, `JobCtx {pool, hub, publisher, link, getLink}`. Register `countsSlice` (before `linkWatchdog`). `link-watchdog.ts` is the timer pattern.
  - `backend/src/index.ts`: jobs are awaited before handlers register and MQTT connects. Don't edit it.
  - `mqtt/client.ts` `dispatch`: concurrent across messages; `Promise.all` over a topic's handlers.
- **Core helpers:**
  - `services/occurred-at.ts` `occurredAt(ts, receivedAt: Date)`.
  - `sse/hub.ts` `setSlice("counts", …)`, which validates against `streamSchemas` (throws in tests).
  - `db/pool.ts` `Pool`, UTC.
  - `vehicle-classes.json` is imported as in `http/routes/vehicle-classes.ts` (`@stl/contracts/vehicle-classes.json` with `type: "json"`).
- **Contracts:** `contracts/src/api/counts.ts` (`HourCounts`, `ClassCounts`, `HourlyCounts`), `contracts/src/mqtt/vision-counts.ts` (`VisionCounts`, `Crossing`), topic `vision/counts` at QoS 1, not retained.
- **Schema:** `vehicle_count` (`msg_id`, `approach`, `vehicle_class`, `count`, `occurred_at`, `received_at`), `UNIQUE (msg_id, approach, vehicle_class)`, indexed on `occurred_at`.
- **Seed runner:** `backend/scripts/db-seed.ts` `seed(pool, dir)` applies `backend/db/seed/*.sql` in lexical order with `multipleStatements`. The folder doesn't exist yet.
- **Tests:** `backend/test/reset-db.ts` and `test/db.test.ts`; `services/link.test.ts` and `jobs/link-watchdog.test.ts` for the hub and fake timers. `.env.test` points at `stl_test`.
- **Simulator** (merged): `simulator/src/vision-role.ts` publishes `vision/counts` about once a second with crossings. Run it with `npm run sim -- --roles vision` or from `simulator/`.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/db/repositories/vehicle_count.insert.ts`, `vehicle_count.by-hour.ts` -- the idempotent multi-row insert, and the hour, approach and class sums.
- [x] `backend/src/services/counts.ts` -- `refreshCounts` (single-flight slice writer) and `hourlyCounts` (24 dense buckets).
- [x] `backend/src/mqtt/handlers/vision-counts.persist.ts`, `backend/src/jobs/counts-slice.ts`, plus two registration lines.
- [x] `backend/db/seed/01-vehicle_count.sql` -- idempotent 24 h demo counts.
- [x] Tests -- every matrix row.

**Acceptance Criteria:**
- Given the broker, the backend and the simulator with `--roles vision`: each `vision/counts` adds its rows once, and the `counts` frame on `/api/stream` shows the current Asia/Manila hour with every configured class.
- Given the backend stopped while the simulator keeps publishing, when the backend restarts, then those messages' rows are stored, once each.
- Given the clock passes an hour boundary with the backend running, then a new `counts` frame with the new `hourStart` is sent.
- When `npm run db:seed` runs, then about 24 h of history loads, and a second run leaves the row count unchanged.
- When `npm run typecheck`, `npm run lint` and `npm test` run, then all exit 0.

## Implementation Notes

- **Redelivery signal (deviation from the frozen "affectedRows is 0" wording):** mysql2 connects with `CLIENT_FOUND_ROWS`, so a no-op `ON DUPLICATE KEY UPDATE id = id` reports `affectedRows` 1 per duplicate row (probed: a single-row redelivery gives `affectedRows:1`, a two-row one `affectedRows:2, info "Duplicates: 2"`). `insertId` is 0 only when no row was inserted, so `insertVehicleCounts` returns `insertId > 0`, and the handler refreshes only then. Turning the flag off would need a `pool.ts`/`index.ts` edit, which this entry may not make.
- `vehicle_count.by-hour.ts` returns `HOUR(CONVERT_TZ(occurred_at,'+00:00','+08:00'))` per (hour, approach, class) over a `[from, to)` range. Both callers query at most one Manila day, so the hour of day is unique in the result.
- Unknown class ids seen in an hour are added to every approach (at 0 where absent), so all four `byApproach` maps share the same keys: configured ids in file order, then unknown ids.
- `refreshCounts` keeps one module-level flight; calls during it overwrite the pending args and the loop runs once more with the latest. Peak concurrency is 1 read. It never rejects: a failed read logs `[job] counts refresh failed: <message>` and the slice keeps its last value.
- The handler logs an insert failure as `[mqtt] vision/counts <id> not stored: <message>` (message only, not the mysql2 error object, which carries the SQL with values).
- Seed: 288 five-minute slots x 4 approaches x 5 classes = 5,760 rows, spanning 23 h 55 min back from `UTC_TIMESTAMP(3)`. `msg_id` = `00000000-5eed-4000-8000-<slot, 12 digits>`.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind, edge | The seed's DELETE and INSERT aren't atomic | low | A failed INSERT leaves the seed wiped; the fix is a direct `START TRANSACTION … COMMIT` | patch |
| 2 | blind | The seed hard-codes class ids, and the test checks only the count | low | A JSON rename would drift unnoticed; the fix is a direct test assertion | patch |
| 3 | blind | The job test never checks that the boundary refresh reads the new hour | medium | The fake pool returns `[[]]` for every query; a refresh re-reading the old hour under the new `hourStart` passes | patch |
| 4 | verification-gap | `refreshCounts`'s "never rejects" catch is untested | medium | Removing it passes every test; boot would crash on a DB outage (`index.ts:19` awaits `start`) and the hourly chain would stop | patch |
| 5 | blind | A transient DB error loses the QoS 1 message | medium | `client.ts` acks through `void dispatch` and handlers swallow errors per message (AD-5 conventions, 1.3); this predates this story and applies to every persist handler | defer |
| 6 | blind | Redelivery is detected through `insertId`, which MySQL calls "not meaningful" after an update-only upsert | low | The handler's redelivery test runs against real MySQL and would fail if this broke; `INSERT IGNORE` would mask other errors | reject |
| 7 | blind, verification-gap | Shutdown doesn't await refreshes started by the handler, and `stop()` waiting isn't tested | low | The only effect is a logged `Pool is closed` line at shutdown; no data is lost | reject |
| 8 | blind | One long `setTimeout` can drift across sleep or clock changes | low | With vision traffic, each message re-reads the current hour; only an idle feed sees a late push | reject |
| 9 | blind, edge | `start()` twice, or `stop()` then `start()` mid-refresh, leaks a timer chain | low | `index.ts` starts each job once per process; there's no hot restart | reject |
| 10 | blind, edge | `hourlyCounts` doesn't validate `date` | false | Entry 14's route parses `HourlyCountsQuery` (`z.iso.date()`) before calling it | reject |
| 11 | blind | The burst test asserts `peak <= 2`, not 1 | false | The frozen matrix row says "≤ 2 concurrent reads" | reject |
| 12 | blind | `refreshCounts`'s promise resolves when the queue drains, which the doc comment doesn't say | low | Callers run under `void dispatch`; nobody depends on the timing | reject |
| 13 | edge | A stored approach outside N/S/E/W throws in `bucket` | false | Rows are written only from `VisionCounts`-parsed payloads (`Approach` enum) | reject |
| 14 | edge | An empty `rows` array is a SQL syntax error | false | `VisionCounts.crossings` is `.min(1)` | reject |
| 15 | edge | A DB unreachable at boot delays later jobs until the connect timeout | low | `refreshCounts` catches and resolves; the link watchdog starts after about 10 s, the same as any boot with the DB down | reject |
| 16 | verification-gap | The `countsSlice` registration in `jobs` is untested | low | The repo has no registry tests (`linkWatchdog` is unchecked too); the live run confirmed the boot frame | reject |
| 17 | verification-gap | The initial boot refresh isn't stored in `pending` | low | Matters only for a signal arriving during boot | reject |

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test` -- expected: all exit 0.

**Manual checks:**
- The Acceptance Criteria runs against the broker, the backend and the simulator's vision role, recorded here, with row counts from `stl` and the `counts` frames from `/api/stream`. The hour boundary is checked live if the run crosses one; otherwise it rests on the fake-timer test.

**Results (implementer, 2026-10-24, Windows, Mosquitto from `npm run broker`, MySQL `stl`):**
- `npm run typecheck`, `npm run lint`, `npm test` exit 0: contracts 174, backend 68 (12 files), simulator 68. The dashboard typecheck fails only on a stale, gitignored `dashboard/.next/types` cache from another branch's routes; with that folder moved aside it exits 0.
- `npm run db:seed` twice: 5,760 seed rows after each run.
- Backend boot with the seed loaded: the first `counts` frame showed the current Manila hour (`hourStart` 05:00Z, `total` 860) with all five configured classes on every approach.
- Simulator `--roles vision`: each message added its rows, `total` rose frame by frame (860, 862, ...), and no `(msg_id, approach, vehicle_class)` appeared twice.
- Restart: with the backend stopped for about 30 s while the simulator kept publishing, the restart stored the queued messages (occurred 05:59:26 to 06:00:08 UTC, all received 06:00:08), once each; the duplicate query stayed empty.
- Hour boundary: the backend restarted at 06:00:08, just after the boundary, so the boundary was not crossed live; it rests on `jobs/counts-slice.test.ts`. The frames after restart carried `hourStart` 06:00Z.
- All test processes (broker, backend, simulator) were stopped by PID; ports 4000 and 1883 are free. The live run left ~40 simulator rows in `stl` beside the seed.

**After review fixes (2026-10-24):**
- `npm run typecheck`, `npm run lint`, `npm test` exit 0: contracts 174, backend 69, simulator 68. The stale `dashboard/.next` cache was deleted, since it's gitignored and gets rebuilt.
- The transactional seed ran twice against `stl`: 5,760 seed rows after each run, `occurred_at` spanning 24 h, 5 classes.
- The implementer's live run above still stands. The fixes after it changed only the seed's transaction wrapper and tests.
