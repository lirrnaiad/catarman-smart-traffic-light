---
title: 'Override lifecycle and override log'
type: 'feature'
ticket: '9'
created: '2026-10-23'
baseline_commit: 'cff929afbf18697bd35909f4b3d9a4ec7310009b'
status: 'done'
route: 'dispatch'
risk: 'high'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-1-context.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-8-live-status-signal-state-plan.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/ux-smart-traffic-light/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The controller already answers override commands, but nothing sends them, records them or resolves them. CAP-5 has no lifecycle and CAP-2 has no override history. Entry 10's panel needs an API to call, and entry 11 reads the rows this entry writes.

**Approach:** Build entry 9 per AD-7.
- **Backend:**
  - `services/overrides.ts`;
  - the `override_command` repositories;
  - two resolve handlers, from the ack and from state;
  - the timeout job;
  - `GET` and `POST /api/overrides`.
- **Dashboard:** `lib/api/overrides.ts` for entry 10, and the `/log/overrides/` page.

## Boundaries & Constraints

**Always:**
- **POST `/api/overrides`** (AD-7, rules 1–3):
  - **Body:** parsed as `OverrideRequest`; a ZodError becomes 400.
  - **Controller not ONLINE** (`getLink().controller.status`):
    - Insert a row: `REJECTED`, reason `CONTROLLER_OFFLINE`, `resolvedAt` = now.
    - Emit SSE `override` and answer `409 CONTROLLER_OFFLINE`. Nothing is published.
  - **Controller ONLINE:**
    - Insert a row: `REQUESTED`, with a new `crypto.randomUUID()` `commandId` and `requestedAt` = now.
    - Publish `controller/override/cmd` with `{v:1, commandId, ts, mode, phase?}` through the publisher.
    - Answer `202` with the `OverrideCommand` and emit SSE `override`.
    - If the publish throws (broker not connected), update the row to `REJECTED CONTROLLER_OFFLINE` with `resolvedAt`, emit, and answer 409.
- **Resolution** (rule 5): the first matching ack or state resolves a row that is `REQUESTED` or `TIMEOUT`, using a conditional `UPDATE … WHERE command_id = ? AND status IN ('REQUESTED','TIMEOUT')`.
  - **Ack:** `APPLIED`, or `REJECTED` with the ack's `reason`.
  - **State:** a `controller/state` whose `override.commandId` matches gives `APPLIED`, retained or not.
  - `resolvedAt` is the message's `receivedAt`.
  - A resolve that changes a row emits SSE `override` with the full row. Terminal rows (`APPLIED`, `REJECTED`) never change again.
  - Unknown ids are ignored.
- **Timeout job:**
  - About once a second, a `REQUESTED` row whose `requestedAt` is at least 5 s old becomes `TIMEOUT`, with `resolvedAt` left null, and is emitted.
  - The first run at `start()` does the same for rows left over from before a restart. That is the boot rule.
  - `TIMEOUT` is not terminal.
- **GET `/api/overrides`:**
  - Returns `Page<OverrideCommand>`, newest first by `requested_at`, then `command_id`, both descending.
  - `ListQuery` gives `limit` (1–200, default 50).
  - `cursor` is base64url JSON of the last item's `[requestedAt, commandId]`. A bad cursor is a 400.
- **Ownership:**
  - Services, repositories, handlers, the job and the route each import their own modules. `index.ts` and `app.ts` stay untouched (AD-16).
  - Repositories are `db/repositories/override_command.<concern>.ts`, with parameterized SQL only.
  - Times are stored as UTC `DATETIME(3)` and emitted as ISO strings ending in `Z`.
  - Logs use `[http]`, `[mqtt]` and `[job]`.
- **`dashboard/src/lib/api/overrides.ts`:**
  - `postOverride(req)` returns the `OverrideCommand`, or rejects with `ApiRequestError` (`CONTROLLER_OFFLINE` on 409).
  - `listOverrides(query?)` returns a `Page`.
- **`/log/overrides/` page:**
  - **Data:** loads page 1 on mount and on every stream epoch, and upserts SSE `override` by `commandId`. A new id goes on top; a known id is replaced in place, so a REQUESTED row turns APPLIED where it stands.
  - **Load more:** follows `nextCursor`, 50 at a time.
  - **Columns:** `requestedAt`, mode with phase, a status plate (REJECTED and TIMEOUT add a hazard edge, never red), the reason label from `visuals.ts` (an unknown code shows raw), and `resolvedAt`. Times go through `formatManila`.
  - **Empty:** "No overrides yet."
  - **REST failure:** an inline notice with the code.
  - The page scrolls vertically. It uses `mockups/override-log.html` and DESIGN → Log table.
- **Tests:**
  - Backend: repository and service tests against `stl_test` with `resetDb`, routes through Supertest on `createApp(deps)`, and a fake publisher and hub.
  - Dashboard: under `LiveTestProvider` with `fetch` stubbed.

**Never:**
- No override panel or buttons (entry 10).
- No state-history reads (entry 11), no contract edit, no dependency, no `package.json` or lockfile edit.
- No edits to `backend/src/index.ts`, `app.ts`, or entry 6/7/8 files. The exceptions are one registration line each in `handlers/index.ts` (×2), `jobs/index.ts` and `routes/index.ts`.
- The dashboard never mints ids.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Applied | controller ONLINE; POST `{CORRIDOR, NS}` | 202 REQUESTED; cmd published; SSE REQUESTED; the ack APPLIED → row APPLIED, `resolvedAt` set, SSE APPLIED | — |
| Offline | controller STALE or OFFLINE | 409 `CONTROLLER_OFFLINE`; row REJECTED with reason; SSE; nothing published | — |
| Publish fails | ONLINE but the publisher throws | 409; row REJECTED `CONTROLLER_OFFLINE` | — |
| Bad body | `{mode:"CORRIDOR"}` without phase | 400 `VALIDATION_FAILED`; no row | — |
| Rejected | ack REJECTED `CONFLICT_FAULT` | row REJECTED with that reason | — |
| By state | no ack; state with `override.commandId` = id | row APPLIED | — |
| Timeout | no ack or state for 5 s | row TIMEOUT, `resolvedAt` null, SSE | — |
| Late answer | ack after TIMEOUT | row APPLIED, SSE | — |
| Terminal | a second ack or state for an APPLIED row | no change, no SSE | — |
| Boot | a REQUESTED row 10 s old at job start | TIMEOUT on the first run | — |
| List | 3 rows; `limit=2` | newest 2 + `nextCursor`; the cursor gives the 3rd and `nextCursor: null` | bad cursor or `limit=0` → 400 |
| Log upsert | page open; SSE REQUESTED then APPLIED for one id | one row, on top, its status changing in place | — |
| Log epoch | epoch increments | page 1 refetched | — |
| Log empty | no rows | "No overrides yet." | REST failure → inline notice |

</frozen-after-approval>

## Code Map

- **Backend extension points:**
  - `backend/src/mqtt/handlers/index.ts`: `HandlerCtx` holds `receivedAt`, `retained`, `pool`, `hub`, `publisher`, `link` and `getLink`. Register `controllerOverrideAckResolve` and `controllerStateResolve` alphabetically (`controller-override-ack.resolve` before `controller-state.link`; `controller-state.resolve` after `controller-state.link`).
  - `backend/src/jobs/index.ts`: `JobCtx` and `Job {start, stop}`. Register `overrideTimeouts` after `linkWatchdog`. `link-watchdog.ts` is the timer pattern.
  - `backend/src/http/routes/index.ts`: `(deps: AppDeps) => Router`, with `AppDeps {pool, hub, publisher, getLink}`. Register `overrides` between `health` and `stream`. `vehicle-classes.ts` is the route pattern.
- **Backend helpers:**
  - `backend/src/mqtt/publisher.ts`: `publish("controller/override/cmd", payload)` parses the payload and throws when disconnected.
  - `backend/src/services/errors.ts`: `AppError(code, message)`. The error middleware maps a ZodError to 400.
  - `backend/src/sse/hub.ts`: `emit("override", OverrideCommand)`, which validates in tests.
- **Schema and tests:**
  - `backend/db/migrations/20261023011004_create_m1_tables.sql`: `override_command` has `id`, `command_id` (unique), `mode`, `phase` (null), `status`, `reason` (null), `requested_at` and `resolved_at` (null), indexed on `requested_at`. The backend has no `db/repositories/` yet; this entry creates it.
  - `backend/test/reset-db.ts` and `test/db.test.ts` show the DB test pattern. `src/app.test.ts` shows Supertest with fake deps. `.env.test` points at `stl_test`.
  - `contracts/src/api/overrides.ts` has `OverrideRequest` and `OverrideCommand`. `ControllerOverrideCmd` and `ControllerOverrideAck` are in `contracts/src/mqtt/`.
- **Dashboard:**
  - Reused, unchanged: `lib/api/client.ts` (`apiPost`, `apiList`, `ApiRequestError`), `lib/live/hooks.ts` (`useLiveEvent("override")`, `useStreamEpoch`), and `lib/visuals.ts` (command status, override mode, phase and rejection-reason visuals, `colorVar`).
  - Story 8's `components/live/panel.tsx` is the frame, if the log needs a panel.
  - New: `app/log/overrides/page.tsx` and `components/override-log/`.
- **Live check:**
  - Run the backend with `npm run dev` and the broker. The simulator comes from `feat/m1-5-simulator-vision` (`git archive … simulator` into the scratchpad, with `node_modules` linked as a junction and removed afterwards with `rmdir`).
  - For the never-acks case, a fake controller publishes non-retained `controller/state` every second with `mosquitto_pub` and never acks.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/db/repositories/override_command.{insert,resolve,timeouts,list}.ts` -- parameterized SQL and row → `OverrideCommand` mapping.
- [x] `backend/src/services/overrides.ts` -- request, resolve and timeout logic.
- [x] `backend/src/mqtt/handlers/controller-override-ack.resolve.ts`, `controller-state.resolve.ts`; `backend/src/jobs/override-timeouts.ts`; `backend/src/http/routes/overrides.ts`; the four registration lines.
- [x] Backend tests -- every backend matrix row.
- [x] `dashboard/src/lib/api/overrides.ts`, `dashboard/src/components/override-log/*`, `dashboard/src/app/log/overrides/page.tsx`, with tests for the log rows.

**Acceptance Criteria:**
- Given the broker, `npm run dev` and the simulator with `--roles controller`:
  - `POST` CORRIDOR NS gives 202, and the SSE `override` turns APPLIED.
  - With the simulator stopped (controller not ONLINE), it gives 409 `CONTROLLER_OFFLINE`.
  - During `conflict raise` it ends REJECTED `CONFLICT_FAULT`.
- Given a fake controller that publishes state but never acks:
  - the command turns TIMEOUT at 5 s;
  - a later `mosquitto_pub` ack resolves it APPLIED;
  - restarting the backend with an old REQUESTED row marks it TIMEOUT.
- `/log/overrides/` shows each of these and updates rows in place.
- When `npm run typecheck`, `npm run lint`, `npm test` and `npm run build -w dashboard` run, then all exit 0.
- **Before merge (epic high-risk check, human):** a second Squad C developer runs EXPERIENCE Flow 1's failure paths against the simulator.

## Implementation Notes

- The REQUESTED SSE is emitted after the insert and **before** the publish, so a fast ack's APPLIED can't be overtaken by it. On a publish failure the stream sees REQUESTED, then REJECTED `CONTROLLER_OFFLINE`.
- The row → DTO mapper and the SELECT columns live in `override_command.list.ts`; `timeouts.ts` reuses them. The timeout job selects due REQUESTED rows, then updates each one with `WHERE status = 'REQUESTED'`, so an ack that lands between the two steps wins.
- Every `controller/state` that carries `override.commandId` runs one conditional UPDATE (a no-op once the row is terminal).
- The log page uses its own housing, not story 8's `Panel`: `Panel` needs a live role and would show a StaleBadge on a history table.
- An SSE `override` that arrives while page 1 is loading is replayed over the response, so a stale REST read can't undo a resolve.
- Dates: each time cell also shows the Asia/Manila date in micro type, because the log spans days. The mockup's day-separator rows were not built.
- Mode labels come from `visuals.ts` as they are: NONE reads "None", not the mock's "Release to automatic".

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind, edge | A publish that fails or stalls after the packet left (broker drops before PUBACK) marks the row REJECTED, or hangs the POST until a reconnect resends it late | medium (unverified timing) | `publisher.publish` checks `connected` only before sending; MQTT.js keeps in-flight QoS 1 and resends on reconnect. This is pre-existing in the backend core's publisher (1.3), and the frozen rule makes a publish failure REJECTED; the window on a local broker is milliseconds | defer |
| 2 | verification-gap | Emitting REQUESTED before the publish is untested | medium | Moving the emit after the publish passes every test; the log row could then stick at Pending | patch |
| 3 | verification-gap, edge, blind | The timeout job's interval is untested; `stop()` during the first run leaks the interval; `stop()` doesn't wait for a run in flight, so shutdown can query a closed pool | medium | Deleting `setInterval` passes every test; `timer` is set after the awaited first run | patch |
| 4 | implementer | TIMEOUT lands up to about 6 s after the request | low | The job ticks every 1 s; a 500 ms tick, like the link watchdog's, keeps it near 5 s | patch |
| 5 | verification-gap, edge, blind | An SSE `override` for a row that isn't loaded goes to the top, out of newest-first order | medium | `upsert` prepends any unknown id; a late answer to an old command looks like a new one | patch |
| 6 | edge, blind | A Load more that resolves after an epoch refetch appends an old-chain page and a stale cursor | medium | `loadMore` has no epoch guard, unlike the page-1 effect | patch |
| 7 | verification-gap | The Load more de-duplication is untested | low | Removing the filter passes every test; duplicate rows and keys would follow | patch |
| 8 | blind | A failed Load more shows "Override log unavailable" over a loaded page | low | It reuses page 1's failure notice; a direct correction | patch |
| 9 | blind | 409 carries no `commandId` | false | AD-7 and the REST surface define 409 as `ApiError`; the REJECTED row reaches clients over SSE | reject |
| 10 | blind | `POST /api/overrides` has no auth or rate limit | false | Kernel constraint: no operator login, Express bound to 127.0.0.1, overrides only from the edge laptop (AD-15, EXPERIENCE → Foundation) | reject |
| 11 | blind | No loading text or Retry on the log | low | EXPERIENCE gives REST failure an inline notice; the epoch refetch recovers | reject |
| 12 | blind | 5 s appears in the backend and in the TIMEOUT label | low | The label is copy in `visuals.ts` (entry 6) | reject |
| 13 | blind | A release reads "None" instead of "Release to automatic" | low | `visuals.ts` is the only label source (entry 6), so a fix belongs there | reject |
| 14 | blind | The table doesn't fit narrow screens and there is no `<h1>` | false | TV only, 1920×1080, with no breakpoints (EXPERIENCE → Responsive) | reject |
| 15 | edge | A failed re-read after a resolve skips the SSE; a DB error in the publish-failure path gives 500 | low | Needs a DB failure between two queries; the epoch refetch recovers | reject |
| 16 | blind | Missing tests for `limit=abc`, non-ISO cursor dates, and a REQUESTED frame after a terminal one; the boot test casts its deps | low | `ListQuery` coercion is tested in contracts; the backend emits in order, REQUESTED before any resolve | reject |
| 17 | blind | `in-review` while the browser check is open | low | The browser check runs in this entry's verification | reject |

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build -w dashboard` -- expected: all exit 0.

**Manual checks:**
- The live acceptance runs, recorded here: curl or a script for POST and GET, an SSE listener for `override`, and the REPL and `mosquitto_pub` for the controller side.

**Recorded (2026-10-23):**
- `npm run typecheck`, `npm run lint`, `npm test` (contracts 174, backend 87, dashboard 124) and `npm run build -w dashboard` all exit 0.
- **Live run:** native Mosquitto (`npm run broker`), the backend (`npm run dev -w backend`), and the simulator from `feat/m1-5-simulator-vision` (`git archive` into the scratchpad, with a `node_modules` junction that was removed afterwards) with `--roles controller --force`, driven by a Node script. The script held an SSE listener on `/api/stream`, used `fetch` for POST and GET, wrote to the REPL through stdin, and used `mosquitto_pub.exe` for the fake controller.
  - **Applied:** POST CORRIDOR NS gave 202 REQUESTED, and SSE APPLIED followed about 5 ms later.
  - **Conflict:** after `conflict raise`, a CORRIDOR gave SSE REJECTED `CONFLICT_FAULT`. After `conflict reset`, NONE gave APPLIED.
  - **Offline:** after REPL `quit`, the controller was OFFLINE (through its will). POST gave 409 `CONTROLLER_OFFLINE`, plus SSE REJECTED `CONTROLLER_OFFLINE`.
  - **Timeout:** a fake controller published non-retained `controller/state` every second and never acked. FLASHING_AMBER turned TIMEOUT with `resolvedAt` null. A `mosquitto_pub` ack 2 s later turned it APPLIED, with `resolvedAt` set to the ack's receive time.
  - **List:** `GET ?limit=3` returned the newest 3 and a `nextCursor`.
  - **Boot:** with the backend stopped, a REQUESTED row 10 s old was inserted into `stl`. Restarting the backend made it TIMEOUT on the first job run. The synthetic row was then deleted.
- **Not done:** the `/log/overrides/` page was not opened in a browser against the live backend. Its upsert-in-place, epoch, empty and failure behaviour is covered only by the Vitest tests under `LiveTestProvider`. The epic's human check by a second Squad C developer is still open.
- **Live browser run after review fixes (2026-10-23):** native Mosquitto, `npm run dev`, and the simulator from `feat/m1-5-simulator-vision` with `--roles controller`. `/log/overrides/` was open in headless Edge at 1920×1080.
  - **Applied:** CORRIDOR NS returned 202, and its row showed Applied 41 ms later.
  - **Conflict fault:** after `conflict raise`, CORRIDOR EW was REJECTED "Conflict fault" within 10 ms. A NONE release was Applied.
  - **Offline:** with the simulator quit, FLASHING_AMBER returned 409 `CONTROLLER_OFFLINE`, and a "Controller offline" row appeared.
  - **Timeout:** a fake controller published state but never acked. The row showed Pending, then TIMEOUT ("No reply from controller in 5 s"). A late `mosquitto_pub` ack turned that same row Applied in place, with one row and `resolvedAt` set.
  - **Display:** rejected rows have the hazard edge, never red, and there is no horizontal scroll.
  - **Timing:** the timeout showed about 6.2 s after the POST in this run, because the driver's synchronous `mosquitto_pub` loop blocked its own page polling. The job (500 ms tick) is pinned by the fake-timer test: still REQUESTED before 5 s, TIMEOUT after.
- **Still open, human, before merge:** the epic's high-risk check, where a second Squad C developer runs EXPERIENCE Flow 1's failure paths against the simulator.
