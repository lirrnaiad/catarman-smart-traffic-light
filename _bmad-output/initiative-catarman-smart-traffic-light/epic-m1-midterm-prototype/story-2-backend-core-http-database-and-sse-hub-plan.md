---
title: 'Backend core: HTTP, database and SSE hub'
type: 'feature'
ticket: '2'
created: '2026-10-23'
status: 'done'
baseline_revision: 'fffe215bb4300809065f485deffb82f42800e421'
baseline_commit: 'fffe215bb4300809065f485deffb82f42800e421'
route: 'dispatch'
risk: 'medium'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-1-context.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/architecture-smart-traffic-light/architecture-smart-traffic-light.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `backend/` has configs and a migration but no `src/`. CAP-3 has no push channel, and later backend stories have no composition root, registries or `createApp(deps)` to extend.

**Approach:** Build the HTTP half of the backend core (entry 2): config, pool, `AppError`, `occurred-at`, the error middleware, `createApp(deps)` with dev CORS and `dashboard/out/` serving, the AD-14 boot order (minus MQTT, which is entry 3), empty route and job registries, the SSE hub with `/api/stream`, `/api/health`, `/api/vehicle-classes`, the `db:seed` runner and `test/reset-db.ts`.

## Boundaries & Constraints

**Always:** Follow AD-6, AD-8, AD-9 (Serving), AD-10, AD-13, AD-14, AD-15, AD-16, plus the REST shape, Errors and Logging conventions. Only `src/config.ts` reads `process.env`. Only `src/db/` imports `mysql2`. Express binds `127.0.0.1:4000` only. The hub writes only through `sseFrame`. Use `ctx` and `createApp(deps)` for core dependencies only (`pool`, `hub`; entry 3 adds `publisher`, `getLink`). Relative imports carry `.ts`. No TS `enum`.

**Never:** No MQTT code, `services/link.ts`, publisher or handler registry (entry 3). No CAP route, service, repository or seed file. No new dependency, no `package-lock.json` or `package.json` edit, no contract edit. No compression middleware. No `TRUNCATE`.

**Decisions (user, 2026-10-23):**
- Keep the plan as one story (~2,300 tokens).
- Local MySQL: verify against this laptop's existing MySQL 8.0 service (outside AD-10, accepted for local checks). Non-DB checks run first. The user runs `infra/mysql/create-user.sql` as root, then the DB checks and `npm test` run. The demo laptop still needs 8.4 or 9.7.4.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Stream connect | `GET /api/stream` | `text/event-stream`, `retry: 2000`, then `link`, `state`, `counts`, `demand` frames; `state`/`counts`/`demand` are `null` | — |
| Stream ping | connection open 15 s | `: ping\n\n` | interval cleared on close |
| Slice / emit | `setSlice('state', v)`, `emit('breach', v)` | one frame to every open client; `getSlice` returns last value | invalid payload: throws in tests, logs `[sse]` and drops otherwise |
| Health | DB up / down | `200 {ok, db, broker:false}`, `db` true / false | DB error never 500s |
| Vehicle classes | `GET /api/vehicle-classes` | the five classes from `vehicle-classes.json`, file order | — |
| Unknown API path | `GET /api/nope` | `404 {error:{code:"NOT_FOUND"}}` | — |
| Errors | thrown `AppError` / `ZodError` / malformed JSON body / other | its status / 400 `VALIDATION_FAILED` / 400 / 500 `INTERNAL` | 500 logs `[http]` with stack |
| occurredAt | `ts` absent / within 24 h / >24 h off | `receivedAt` / `ts` / `receivedAt` | >24 h logs `[mqtt]` warn |
| CORS | `Origin` in `DASHBOARD_ORIGINS` / not | `Access-Control-Allow-Origin` echoed, preflight 204 / no CORS headers | — |
| Seed | no `db/seed/` files / files | logs and exits 0 / applies each `.sql` in lexical order | SQL error exits 1 |

</frozen-after-approval>

## Code Map

- `backend/package.json` -- scripts already point at `src/index.ts` and `scripts/db-seed.ts`. Deps: express 5.3, mysql2 3.24, zod 4.6, supertest. There is no `cors` or `dotenv`, so use Node's `process.loadEnvFile` and hand-written CORS. Don't edit this file.
- `backend/.env.example`, `.env.test` -- `DATABASE_URL` only. Append `DASHBOARD_ORIGINS`.
- `backend/vitest.config.ts`, `test/global-setup.ts` -- serial files; `globalSetup` migrates `stl_test`. Reuse as-is.
- `backend/db/migrations/20261023011004_create_m1_tables.sql` -- the five tables. `breach_crop` FKs `breach_event` with cascade.
- `contracts/src/api/stream/index.ts` -- `streamSchemas` (key order = connect order for slices), `StreamName`, `StreamData`, `sseFrame`.
- `contracts/src/api/stream/link.ts` -- `LinkSlice` is never null.
- `contracts/src/api/common.ts` -- `ErrorCode`, `ApiError`, `Health`, `VehicleClass`.
- `contracts/vehicle-classes.json` -- exported as `@stl/contracts/vehicle-classes.json`.
- `node_modules/mysql2/promise.d.ts` -- `Pool`, `PoolOptions`. `pool.pool` is the core pool, for the `'connection'` hook.
- Scope: work only inside this repo. Ignore the `AGENTS.md` one folder above the repo (`Desktop\AGENTS.md`); it belongs to another project.
- Machine: Node 24.15.0 (`engines` wants 24.22.1, warn only). `npm ci` is done. MySQL service `MySQL80`, no `stl` user. No Docker, no Mosquitto.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/config.ts` -- `process.loadEnvFile` (`.env.test` under Vitest, else `.env`, tolerating a missing file). zod parses `DATABASE_URL` (url) and `DASHBOARD_ORIGINS` (comma list, default `http://localhost:3000,http://127.0.0.1:3000`). Export a frozen `config` plus `HOST`/`PORT` constants (`127.0.0.1`, 4000).
- [x] `backend/src/db/pool.ts` -- `createPool(url, opts?)` with `timezone: 'Z'` and `SET time_zone = '+00:00'` on each new connection; `pingDb(pool)` resolves a boolean and never throws.
- [x] `backend/src/services/errors.ts` -- `AppError(code: ErrorCode, message)` and the code→status map.
- [x] `backend/src/services/occurred-at.ts` -- `occurredAt(ts, receivedAt)` per AD-6.
- [x] `backend/src/sse/hub.ts` -- `createHub({validate: 'throw'|'log'})`: `setSlice`, `getSlice`, `emit`, `attach(res)` (connect sequence and a 15 s ping per client, cleaned up on close), and `close()`. The initial `link` is the all-offline value (broker `DISCONNECTED`, roles `OFFLINE`, nulls); the other slices are `null`.
- [x] `backend/src/http/error-middleware.ts`, `routes/index.ts`, `stream.ts`, `health.ts`, `vehicle-classes.ts` -- each route file exports `(deps) => Router`; the index lists them alphabetically. `stream.ts` sets the SSE headers and flushes them.
- [x] `backend/src/app.ts` -- `createApp(deps: {pool, hub})`: `express.json()`, CORS for allow-listed origins, the routes under `/api`, an `/api` 404, static `dashboard/out/` when the folder exists, then the error middleware.
- [x] `backend/src/jobs/index.ts` -- the `Job` type `{start(ctx), stop()}`, `JobCtx {pool, hub}`, `jobs: Job[] = []`.
- [x] `backend/src/index.ts` -- boot order: pool → `await` each job's `start` → listen on `HOST:PORT`. Leave a comment marking where entry 3 slots in its handlers and `mqtt.connect`. On SIGINT/SIGTERM, stop the jobs, close the hub and server, and end the pool.
- [x] `backend/scripts/db-seed.ts`, `backend/test/reset-db.ts` -- the seed runner uses `createPool(url, {multipleStatements: true})`. `resetDb(pool)` deletes `breach_crop` first, then the other four tables.
- [x] `backend/src/**/*.test.ts`, `backend/test/*.test.ts` -- cover every matrix row. Hub tests use fake `res` objects and fake timers. Route tests use Supertest on `createApp` with a fake or `stl_test` pool. Add a `reset-db` test against `stl_test`.

**Acceptance Criteria:**
- Given MySQL with `stl` migrated, when `npm run dev -w backend` runs, then it listens on `127.0.0.1:4000` only, and `curl` shows `/api/health` `db:true`, the five classes, and the stream connect sequence.
- Given an empty seed folder, when `npm run db:seed` runs, then it exits 0.
- When `npm run typecheck`, `npm run lint` and `npm test` run, then all exit 0.

## Implementation Notes

- Route modules default-export `(deps: AppDeps) => Router`; `AppDeps` lives in `app.ts`, `JobCtx` in `jobs/index.ts`. `db/pool.ts` re-exports `type Pool`, so nothing outside `src/db/` imports `mysql2`.
- `scripts/db-seed.ts` exports `seed(pool, dir)` for tests and runs only when it is the entry script.
- DB tests (pool time zone, `pingDb`, `resetDb`, seed order and failure) are in `test/db.test.ts`.
- Created the gitignored `backend/.env` from `.env.example` for the local run.
- **Local MySQL setup:** on this laptop's MySQL 8.0.44, `create-user.sql` failed until the session lowered `validate_password` (policy LOW, length 3), because the `stl` password is too short for the default policy. `docs/setup.md` doesn't mention this. Recorded for entry 17 or 18.
- **Verified by the orchestrator** (Windows, Node 24.15.0, MySQL 8.0.44):
  - `npm run db:migrate` created `stl` with the five tables.
  - `typecheck` and `lint` exit 0. `npm test`: contracts 174/174, backend 26/26, with the 6 `stl_test` DB tests included.
  - `tsx src/index.ts`: `/api/health` returned `{"ok":true,"db":true,"broker":false}`, `/api/vehicle-classes` returned the five classes in file order, and `/api/stream` sent `retry: 2000` and then the four slices (link all offline, the rest null).
  - `netstat` showed only `127.0.0.1:4000` listening.
  - `npm run db:seed` with no seed folder logged and exited 0.
- **Unverified:** SIGINT/SIGTERM shutdown (Windows `taskkill /F` skips it); `dashboard/out/` serving (no export yet). `/api/health` can take up to mysql2's 10 s connect timeout when MySQL is unreachable rather than refusing.

## Spec Change Log

## Review Triage Log

### Pass 1 (blind, edge-case and verification-gap lenses, loop 0)

Verdicts: high 0, medium 1, low 13, false 6, maybe-false 0, plus 3 pre-verified gaps routed to defer. Layers: B = blind, E = edge case, V = verification gap.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | B: tests can wipe the dev DB | medium | patch | `process.loadEnvFile` never overrides a set variable, so an exported `DATABASE_URL` points Vitest at `stl`, and `resetDb` deletes every row there. Patch: `resetDb` refuses unless `SELECT DATABASE()` is `stl_test`. |
| 2 | B, E: attach after `hub.close()` hangs shutdown | low | patch | A request already in flight on a kept-alive socket can reach `stream.ts` after `hub.close()`. It gets a ping timer and is never ended, so `server.close` waits forever. Patch: a `closed` flag; `attach` ends the response once closed. |
| 3 | E: a second Ctrl+C is ignored | low | patch | `index.ts` returns early while `stopping`, so a hung shutdown can't be interrupted. Patch: a second signal calls `process.exit(1)`. |
| 4 | B, E: other body-parser errors return 500 | low | patch | `entity.too.large` and charset errors carry a 4xx `status` but fall through to `INTERNAL` and an "unhandled" log. Patch: map any body-parser error with a 4xx `status` and a `type` to 400 `VALIDATION_FAILED`. |
| 5 | B, E: a failed `SET time_zone` keeps the connection | low | patch | The callback only logs, so the pool hands out a non-UTC session. Patch: `conn.destroy()` on error. |
| 6 | B, E: `existsSync(dashboardOut)` runs once at load | low | patch | A dashboard built after the backend starts is never served. Patch: mount `express.static` unconditionally; it falls through when the folder is missing. The `.html` extension claim is false: `trailingSlash: true` exports `foo/index.html`, which `express.static` serves at `/foo/`. |
| 7 | B: `AppError.status` is never read | low | patch | The middleware reads `errorStatus[code]`. Patch: delete the field. |
| 8 | B: the `.env.test` comment says the tests "rely on this default" but the file sets the value | low | patch | The comment is misleading. Patch: reword it. Default drift across three files: rejected, because the parse default is the source and the env files only document it. |
| 9 | V: mysql2 `timezone: "Z"` has no test | gap | patch | Pre-verified: deleting it keeps `db.test.ts` green, and on a UTC+8 host reads shift by 8 h. Patch: a round-trip `Date` test on `override_command.requested_at`. |
| 10 | V: the preflight `Allow-Headers` isn't asserted | gap | patch | Pre-verified: deleting the header keeps the tests green. Patch: one assertion in `app.test.ts`. The default and trim parse test is deferred (needs `Env` exported). |
| 11 | V: the `db:seed` CLI path (multi-statement pool, exit 1) is untested | gap | defer | Pre-verified. No seed files exist yet; entry 12 owns the first seed. |
| 12 | V: static `dashboard/out/` serving is untested | gap | defer | Pre-verified. The export doesn't exist and the path is module-level; this belongs to the dashboard export or entry 18. |
| 13 | B: listen failure skips cleanup | false | reject | `process.exit(1)` releases the pool and timers, and `jobs` is empty, so no half-done work exists. |
| 14 | B: `pingDb` can take 10 s | low | reject | It only happens when the host drops packets. MySQL is on `127.0.0.1`, where a stopped server refuses at once, and a timeout race adds code. Already listed under Unverified. |
| 15 | B, E: `DASHBOARD_ORIGINS` isn't validated (trailing slash, empty) | low | reject | It's a developer config typo, unlikely in everyday use, and the fix adds validation code. |
| 16 | B, E: seed has no transaction or idempotency | low | reject | Seed files don't exist; AD-10 seeds are relative-timestamp demo inserts owned by entry 12, and the fix adds complexity. |
| 17 | B: the reset table list is hand-kept twice | low | reject | S0's migration already holds every M1 table, and deriving the list from `information_schema` adds code. |
| 18 | B, E: SSE ignores `res.write` backpressure | low | reject | One local Chromium client with small frames; the fix adds disconnect logic. The route-level disconnect is covered by the hub's `close` test. |
| 19 | B: no `Access-Control-Max-Age` | false | reject | Not a defect: a missing max-age only means more preflights, on localhost. |
| 20 | E: the response closed before `attach` registers its listener | false | reject | `stream.ts` calls `attach` synchronously in the handler, so `close` can't have fired yet. |
| 21 | E: `ts` is NaN | false | reject | `ts` comes from contract-parsed payloads typed `int`, which rejects NaN. |
| 22 | E: `job.start` rejects partway | false | reject | `jobs` is empty, and a top-level rejection exits the process, releasing everything. |
| 23 | E: the `server.close` error is swallowed | false | reject | Shutdown only runs after a successful listen; a failed listen exits first. |
| 24 | E: an allow-listed OPTIONS without `Access-Control-Request-Method` returns 204 | false | reject | No route handles OPTIONS, so 204 instead of 404 harms nothing. |
| 25 | E: an empty `.sql` file or a directory named `*.sql` aborts seeding | low | reject | Unlikely, and the fix adds branches. |

**Patches applied** by the implementer: rows 1–10. Their new tests:
- the hub after `close()`;
- an oversized body returning 400;
- the UTC `Date` round trip;
- the `Allow-Headers` assertion.

The implementer's edit script wrote CRLF line endings. Biome and hand fixes restored LF, and the orchestrator confirmed no CRLF remains in `backend/` or this plan.

**Re-verified by the orchestrator:**
- `typecheck` and `lint` exit 0.
- `npm test`: contracts 174/174 and backend 29/29, including the `stl_test` DB tests.
- Live run: `/api/health` returns `db:true`, `/api/stream` sends the connect sequence, `/api/nope` returns 404, and only `127.0.0.1:4000` is listening.

## Design Notes

- **No mode flag:** the scripts can't set `NODE_ENV` (AD-13, and `package.json` belongs to entry 1). So CORS always applies the allow-list, which is harmless because nothing runs on :3000 in demo. `dashboard/out/` is served whenever it exists. The hub validates every outbound payload: it throws in tests and logs and drops otherwise. That is stricter than AD-4's "dev and test" and costs almost nothing.
- **Health:** `ok = db` until entry 3 adds the broker (`ok = db && broker`). `health.ts` imports `pingDb` from `db/pool.ts`, the one route→db import, so no SQL lives outside `db/`.
- **Initial `link`** lives in the hub until entry 3's `services/link.ts` writes it at boot, because `LinkSlice` can't be null.

## Verification

**Commands:**
- `npm run typecheck && npm run lint && npm test` -- expected: exit 0
- `npm run dev -w backend`, then `curl -s 127.0.0.1:4000/api/health`, `curl -s 127.0.0.1:4000/api/vehicle-classes` and `curl -sN 127.0.0.1:4000/api/stream` -- expected: the matrix outputs
- `netstat -ano | findstr :4000` -- expected: only `127.0.0.1:4000` listening
- `npm run db:seed` -- expected: exit 0
