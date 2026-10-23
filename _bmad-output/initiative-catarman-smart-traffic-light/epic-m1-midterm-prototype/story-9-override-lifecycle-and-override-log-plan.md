---
title: 'Override lifecycle and override log'
type: 'feature'
ticket: '9'
created: '2026-10-23'
status: 'draft'
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
- [ ] `backend/src/db/repositories/override_command.{insert,resolve,timeouts,list}.ts` -- parameterized SQL and row → `OverrideCommand` mapping.
- [ ] `backend/src/services/overrides.ts` -- request, resolve and timeout logic.
- [ ] `backend/src/mqtt/handlers/controller-override-ack.resolve.ts`, `controller-state.resolve.ts`; `backend/src/jobs/override-timeouts.ts`; `backend/src/http/routes/overrides.ts`; the four registration lines.
- [ ] Backend tests -- every backend matrix row.
- [ ] `dashboard/src/lib/api/overrides.ts`, `dashboard/src/components/override-log/*`, `dashboard/src/app/log/overrides/page.tsx`, with tests for the log rows.

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

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build -w dashboard` -- expected: all exit 0.

**Manual checks:**
- The live acceptance runs, recorded here: curl or a script for POST and GET, an SSE listener for `override`, and the REPL and `mosquitto_pub` for the controller side.
