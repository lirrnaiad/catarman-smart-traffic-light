# Epic 1 Context: M1 Midterm prototype

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver CAP-1 to CAP-6 on simulated telemetry by Oct 26, 2026: a simulator stands in for the vision node and ESP32, an Express/MySQL backend ingests and stores telemetry from a local Mosquitto bus, and a static Next.js dashboard shows live status, hourly traffic peaks, the MDRRMO override and the breach log. Success is the instructor running it from the repo on one laptop, offline, with history that survives a backend and MySQL restart.

## Stories

- Story 1.1: S0 — workspace, contracts, schema and local infra (done)
- Story 1.2: Backend core — HTTP, database and SSE hub
- Story 1.3: Backend core — MQTT ingest and link health
- Story 1.4: Simulator — controller role, REPL and behavior hooks
- Story 1.5: Simulator — vision role and demo scenario
- Story 1.6: Dashboard shell — config, tokens and live data layer
- Story 1.7: Dashboard shell — layout, header and UI atoms
- Story 1.8: Live status — signal state on /
- Story 1.9: Override lifecycle and override log
- Story 1.10: MDRRMO override panel on /
- Story 1.11: History — signal-state changes
- Story 1.12: History — vehicle counts and the counts slice
- Story 1.13: Live status — intersection map, PCU and hour counts
- Story 1.14: Traffic peaks
- Story 1.15: Breach ingest and breach log
- Story 1.16: Latest breach on /
- Story 1.17: Refactor sweep
- Story 1.18: M1 demo run and submission

## Requirements & Constraints

- Everything runs locally on one laptop (Windows or Linux), offline. Express binds `127.0.0.1:4000` only; MySQL and Mosquitto are local-only. Dev CORS allows `DASHBOARD_ORIGINS` (default `http://localhost:3000,http://127.0.0.1:3000`).
- Done for every story: `npm run typecheck`, `npm run lint`, `npm test` pass (plus `npm run build -w dashboard` when touching the dashboard), and the CAP flow is demonstrated against the simulator (or fixtures / `mosquitto_pub` / seed data until upstream lands) with steps recorded in the story plan.
- A story owns only its listed files; shared indexes get only one alphabetical registration line per owned file; `/` gets only mount lines.
- No new dependencies and no `package-lock.json` edits inside a story; a needed package lands on `main` first as a one-commit chore. Contract edits after S0 are also one-commit chores that regenerate `contracts/schema/`.
- No M2 fields rendered (`remainingS`, `power`, `bootCount`, `speedAlert`). Privacy: only Tier 1 vehicle data; logs never contain crop data.
- `main` is protected: every change merges through a PR from a short-lived branch rebased on `main`.

## Technical Decisions

- **Monorepo:** npm workspaces `contracts`, `backend`, `simulator`, `dashboard`; Node 24.22.1, TypeScript strict, ESM (`"type": "module"`), bundler resolution, relative imports with `.ts`, no TS `enum`, lower-kebab-case filenames. Backend and simulator run through `tsx`. Scripts must work unchanged in cmd, PowerShell and bash.
- **Contracts:** `@stl/contracts` owns every MQTT payload, SSE event and REST DTO as zod schemas (`z.object`, never strict) plus the topic table and `vehicle-classes.json`. Nobody redeclares shapes. Inbound messages and request bodies are parsed; invalid ones are logged and dropped, never crash. In dev/test the backend also parses outbound SSE payloads (throw in tests).
- **Backend shape:** ports and adapters. Composition root `src/index.ts` (boot order: pool → await every job `start(ctx)` → register MQTT handlers → `mqtt.connect` → `listen`) and `src/app.ts` (`createApp(deps)`, builds Express only). Inbound adapters (routes, handlers, jobs) → services → outbound adapters (repositories, publisher, SSE hub). `ctx`/`deps` carry only core deps: `receivedAt` (handlers), hub, publisher, `getLink`, pool; each CAP imports its own service module, so CAP stories never edit `index.ts`/`app.ts`.
- **Extension points:** handlers `mqtt/handlers/<topic>.<concern>.ts` (fan-out registry), jobs `jobs/<name>.ts` exporting `{start(ctx), stop()}`, routes `http/routes/<resource>.ts`, each registered in its `index.ts`; services and repositories are not registered.
- **Config:** only `src/config.ts` reads `process.env`, validated with zod, from the package `.env`; documented in committed `.env.example`. One DB variable, `DATABASE_URL`; `.env.test` holds the `stl_test` URL.
- **Database:** dbmate plain-SQL migrations; one `mysql2/promise` pool in `db/pool.ts` with `timezone: 'Z'` and `SET time_zone = '+00:00'` per connection. All runtime SQL is parameterized in `db/repositories/*.ts`. Seeds in `backend/db/seed/*.sql` use timestamps relative to `UTC_TIMESTAMP(3)`, applied by `npm run db:seed`. `test/reset-db.ts` deletes rows, never truncates. MySQL 9.7.4 (8.4 accepted).
- **Time:** backend `receivedAt` is the time of record, stored UTC `DATETIME(3)`; vision events use `occurredAt` = `ts` unless missing or >24 h off (logic only in `services/occurred-at.ts`). APIs emit ISO UTC ending in `Z`; Asia/Manila hours via `CONVERT_TZ(col,'+00:00','+08:00')`.
- **Errors:** `AppError(code, message)`; one error middleware maps `AppError` → its status, `ZodError` → 400 `VALIDATION_FAILED`, else 500 `INTERNAL`; body `ApiError {error:{code,message}}`. Codes: 400 `VALIDATION_FAILED`, 404 `NOT_FOUND`, 409 `CONTROLLER_OFFLINE`, 500 `INTERNAL`.
- **REST:** JSON under `/api`; lists are `Page<T>` newest first with `limit` 1–200 (default 50) and an opaque sort-key cursor.
- **SSE:** `GET /api/stream` is the only push channel; no compression. Frames exactly `event: <name>\ndata: <JSON>\n\n` via `sseFrame`. On connect: `retry: 2000`, then slices `link`, `state`, `counts`, `demand` (null if unset). Hub API `setSlice`, `getSlice`, `emit`; one writer per slice; `: ping` every 15 s; ≤250 ms from `receivedAt` to SSE write.
- **MQTT:** QoS/retain only from `topics.ts`; backend clientId `stl-backend`, `clean: false`, 5 s keepalive; link state derives only from fresh non-retained messages.
- **Logging:** `console.info/warn/error` prefixed `[mqtt]`, `[http]`, `[sse]`, `[db]`, `[job]`, `[sim]`.
- **Tests:** Vitest everywhere. Route tests use Supertest against `createApp(deps)`, never a port; fakes for hub and publisher; repository tests hit `stl_test` (migrated by `globalSetup`), serial. No test needs a broker. No browser E2E in M1.
- **Demo mode:** `npm start` serves `dashboard/out/` from Express on `:4000`; the dashboard is a static export using same-origin API in production and `http://127.0.0.1:4000` in dev.

## Cross-Story Dependencies

- 1.1 (S0) underpins everything. 1.2 → 1.3 (backend core in two halves); 1.4 → 1.5 (simulator); 1.6 → 1.7 (dashboard shell). The three cores run in parallel.
- CAP stories need the cores: 1.8 and 1.9 need 1.3, 1.4, 1.7; 1.10 needs 1.8 and 1.9; 1.11 needs 1.9; 1.12 needs 1.3 and 1.5; 1.13 needs 1.5, 1.8, 1.12; 1.14 needs 1.7 and 1.12; 1.15 needs 1.3, 1.5, 1.7; 1.16 needs 1.8 and 1.15. 1.17 follows all; 1.18 is the final human demo run.
- 1.2 creates the route and job registries, the SSE hub and `createApp(deps)` that every later backend story extends; 1.3 adds the MQTT client, publisher, handler registry and `services/link.ts` (the `link` slice writer and `getLink`).
