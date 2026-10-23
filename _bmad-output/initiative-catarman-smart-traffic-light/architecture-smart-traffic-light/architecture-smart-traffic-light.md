---
name: 'Catarman SMART Traffic Light'
type: architecture-spine
purpose: build-substrate
altitude: initiative
paradigm: 'Event-driven pub/sub over a local MQTT bus; the backend is a single ports-and-adapters gateway; the dashboard is a static client'
scope: 'Whole system. Deep on M1 (CAP-1 to CAP-6: simulator, backend, dashboard). Contracts only for the M2 vision node and ESP32 firmware.'
status: final
created: '2026-10-22'
updated: '2026-10-23'
binds: [CAP-1, CAP-2, CAP-3, CAP-4, CAP-5, CAP-6, CAP-7, CAP-8, CAP-9, CAP-10, CAP-11, CAP-12, CAP-13, CAP-14, CAP-15, CAP-16, CAP-17, CAP-18, CAP-19, CAP-20]
sources:
  - ../spec-smart-traffic-light/spec-smart-traffic-light.md
  - ../spec-smart-traffic-light/.memlog.md
  - ../spec-smart-traffic-light/stack.md
  - ../spec-smart-traffic-light/milestones.md
  - ../spec-smart-traffic-light/degradation-levels.md
  - ../spec-smart-traffic-light/kpis.md
  - ../spec-smart-traffic-light/privacy-compliance.md
  - ../spec-smart-traffic-light/hardware.md
  - ../spec-smart-traffic-light/risks.md
  - ../spec-smart-traffic-light/users.md
  - ../spec-smart-traffic-light/glossary.md
  - ../spec-smart-traffic-light/roadmap.md
  - ../../../docs/SquadA_02_Initial_List_of_Materials.docx
  - ../../../docs/SquadA_03_Prototype_Design.docx
  - ../../../docs/Catarman Signal Diorama (Copy).html
companions: []
---

# Architecture Spine — Catarman SMART Traffic Light

## Design Paradigm

**Event-driven pub/sub.** The local Mosquitto topic tree `stl/<iid>/…` is the integration contract. Three roles meet on it:

- **controller**: the ESP32 in M2, the simulator in M1.
- **vision**: the vision node in M2, the simulator in M1.
- **gateway**: the Express backend.

Inside the gateway, **ports and adapters**: inbound adapters (MQTT handlers, HTTP routes, jobs) call services, which call outbound adapters (MySQL repositories, MQTT publisher, SSE hub). The dashboard is a **static client** of the gateway.

| Layer | Lives in |
| --- | --- |
| Contract (topics, payloads, DTOs, SSE events, vehicle classes) | `contracts/` |
| Controller + vision roles, simulated | `simulator/` |
| Controller role, live | `firmware/` (Squad A) |
| Vision role, live | `edge_vision/` (Squad B) |
| Gateway: composition root | `backend/src/index.ts`, `backend/src/app.ts` |
| Gateway: inbound adapters | `backend/src/mqtt/handlers/`, `backend/src/http/routes/`, `backend/src/jobs/` |
| Gateway: services | `backend/src/services/` |
| Gateway: outbound adapters | `backend/src/db/`, `backend/src/mqtt/publisher.ts`, `backend/src/sse/` |
| Operator surface | `dashboard/` |

```mermaid
flowchart LR
  subgraph laptop["Edge laptop: Linux or Windows 10/11"]
    SIM["simulator (M1)<br/>controller + vision roles"]
    VIS["edge_vision (M2)<br/>vision role"]
    MQ[("Mosquitto :1883")]
    BE["backend: Express :4000<br/>gateway"]
    DB[("MySQL :3306")]
    UI["dashboard: static Next.js<br/>in Chromium"]
  end
  ESP["firmware: ESP32 (M2)<br/>controller role"]
  SIM -->|"publish, obey commands"| MQ
  VIS -->|"publish"| MQ
  ESP <-->|"Wi-Fi hotspot (M2)"| MQ
  MQ <-->|"subscribe, publish commands"| BE
  BE <--> DB
  UI -->|"REST"| BE
  BE -->|"SSE"| UI
```

**Dependency direction.** A module may import only what the diagram shows. Anything not drawn is forbidden.

```mermaid
flowchart TD
  root["composition root<br/>index.ts, app.ts"] --> routes["http/routes"]
  root --> handlers["mqtt/handlers"]
  root --> jobs["jobs"]
  routes --> services["services"]
  routes -->|"stream route only"| hub["sse/hub"]
  handlers --> services
  jobs --> services
  services -->|"read only: getLink()"| link["services/link.ts"]
  services --> repos["db/repositories"]
  services --> publisher["mqtt/publisher"]
  services --> hub
  repos --> pool["db/pool.ts"]
  dashboard --> contracts
  simulator --> contracts
```

Three imports are allowed but not drawn:

- Every backend module may import `contracts`, `src/config.ts`, `src/services/errors.ts` and `src/services/occurred-at.ts` (AD-6).
- The composition root may import anything in the backend.
- `contracts/` imports only `zod`.

Library imports are fenced too:

- Only `backend/src/db/` imports `mysql2`.
- Only `backend/src/mqtt/` and `simulator/` import `mqtt`.
- The dashboard never imports from `backend/` or `simulator/`, and the simulator never imports from `backend/`.

## Invariants & Rules

### AD-1 — The MQTT bus is the only path between runtime roles

- **Binds:** CAP-1, CAP-8, CAP-10, CAP-12 to CAP-17; `simulator/`, `backend/`, `edge_vision/`, `firmware/`
- **Prevents:** side channels between vision, controller and backend (HTTP calls, shared files, direct serial reads) that the M2 swap would break.
- **Rule:** The controller role, the vision role and the backend exchange telemetry and commands only as JSON on the topics in *MQTT contract v1* (Structural Seed). No role calls another role's HTTP API, reads its files or shares its database. Video is the one carve-out (AD-17).

### AD-2 — The backend is the sole gateway [ADOPTED]

- **Binds:** CAP-2 to CAP-6, CAP-8, CAP-9; `backend/`, `dashboard/`, `simulator/`
- **Prevents:** a second MySQL writer, the dashboard subscribing to MQTT, overrides that skip the log.
- **Rule:**
  - Express is the only process that reads or writes MySQL at runtime, the only one that persists MQTT messages, and the only publisher on `controller/override/cmd`. MQTT-to-MySQL ingest is part of Squad C's Express backend; there is no separate ingest process.
  - The dashboard gets all its data from Express, over HTTP (REST and SSE). The one named exception is the CAP-7 video element, whose source is decided in M2 (AD-17).
  - MySQL Workbench is the design and admin tool (AD-10), never a runtime writer.

### AD-3 — The simulator is a drop-in for both roles

- **Binds:** CAP-1, CAP-5, CAP-8; `simulator/`
- **Prevents:** simulation logic leaking into the backend or dashboard; an M2 swap that needs code changes; link-loss paths left untested in M1.
- **Rule:**
  - `simulator/` runs as its own process with two MQTT links, clientIds `stl-sim-controller` and `stl-sim-vision`. Each link has its own LWT and follows AD-5. `npm run sim -- --roles controller|vision|both` (default `both`) picks which roles start.
  - It publishes exactly the controller and vision topics, with `source: "sim"` in each `status`. It subscribes to `controller/override/cmd` and answers like the ESP32 (AD-7), including rejecting `CORRIDOR` during a conflict fault.
  - The simulated controller follows `degradation-levels.md`:
    - It cycles NS then EW on the timing table there: yellow 3 s, all-red clearance 2 s, a fixed 10 s green in L3, and in L1 and L2 a green between min green (5 s) and max green (20 s). A fixed 10 s green in L1 and L2 stays inside those limits, so it is enough for M1.
    - It drops to L2 when the vision role's heartbeat stops (3 missed).
    - It goes to L3 on a simulated sensor fault.
    - Once the cause has been clear for 5 s, it climbs back to the highest level its healthy inputs support, switching at the next all-red clearance.
    - After flood has been held for 5 s, it goes to L4 with `FLASHING_AMBER` on both phases. It leaves L4 after 30 s dry and resumes at an all-red clearance.
    - A simulated conflict-monitor fault sets `fault: true`, forces `FLASHING_AMBER` on both phases and handles overrides as AD-7 says. It latches until the REPL's reset, which stands in for the controller-box reset button.
    - An override outranks every level. When its broker link drops, it applies the link-drop rule in AD-18.
    - It keeps cycling while the broker or backend is down and republishes its state on reconnect (AD-18).
    - A simulated reboot drops the link without a graceful `online: false`, reconnects with `bootCount` + 1, forgets the override and keeps a latched fault. `bootCount` starts at 0 in each simulator process.
  - **Hooks for M2:** the simulator core builds two hooks in M1 and none of the M2 features. Through `behaviors/index.ts`, a behavior may add fields to the controller's `state` and `status` payloads, and may register REPL commands. The CAP-8 story adds the countdown, power and reboot behaviors, and the CAP-10 story adds the speed-alert behavior. In L1 and L2 the simulator's `remainingS` counts to its own green end.
  - Operator controls exist only in the simulator's terminal REPL and in scripted scenarios, never in the dashboard or backend. The controls are:
    - force a level (L1 to L4);
    - turn flood on or off;
    - raise or clear a sensor fault;
    - raise a conflict fault, or reset it;
    - emit a breach;
    - stop or start the vision role. Stopping it publishes a retained `online: false` first.
    - From M2, added through the hooks: cut or restore power (`power`), reboot the controller role, and emit a speed alert (CAP-10).
  - CAP-1's "operator" means the person at the simulator terminal. Dashboard operators never see simulator controls.
  - `npm run sim -- --scenario demo` walks L1 → L2 → L3 → L4 and emits breaches, so the M1 demo needs no typing.
  - **Start check, per role:** the simulator refuses to start the controller role if a non-retained `controller/state` arrives within 5 s, and the vision role if a non-retained `vision/heartbeat` arrives within 3 s. Retained messages never count. `--force` skips the check and clears only the retained statuses of the roles it starts, each from its own link.
  - **Speed-alert stand-in (CAP-10):** `npm run sim -- --speed-alerts` opens one link, `stl-sim-alerts`, with no status and no LWT, and publishes only `vision/speed-alert` from its REPL. It is the only simulator mode allowed while a live role is online, and it is how the simulator's event stands in at the M2 demo.
  - M2 go-live means stopping the simulator, except for its `--speed-alerts` mode. The backend and dashboard don't change.

### AD-4 — One contract package owns every shared shape

- **Binds:** all packages; Squads A and B through generated JSON Schema
- **Prevents:** two stories declaring the same payload, DTO or event differently; additive changes that break Python or C++ validators.
- **Rule:**
  - `contracts/` (`@stl/contracts`) holds the zod schema and inferred type for every MQTT payload, SSE event and REST DTO. It also holds the topic table and `vehicle-classes.json`. No other package redeclares these shapes; they import them.
  - S0 creates every shape listed in the Structural Seed: all MQTT payloads, all SSE events, and the shared API shapes. Feeding stories own the code that *produces* a shape, never the shape itself. A story adds a new file in `contracts/src/api/` only for a DTO the seed doesn't list.
  - The receiver parses every inbound MQTT message and request body with its contract schema. An invalid message is logged and dropped. It is never persisted and never crashes the process.
  - In dev and test, the backend also parses every outbound SSE payload, and in tests a parse failure throws.
  - Schemas use `z.object`, which ignores unknown keys, never `z.strictObject`. `npm run contracts:schema` emits `contracts/schema/*.json` with `z.toJSONSchema`, without `additionalProperties: false`. It also writes `contracts/schema/topics.json` from the topic table: each topic's pattern, QoS, retain flag, publisher role and payload schema file. Squads A and B take QoS and retain only from that file. Regenerate and commit them with every schema change.
  - **After S0:** a contract edit lands on `main` as a one-commit chore that regenerates `contracts/schema/` and names who signed off, or the user's waiver.
  - Every `ts` field is integer epoch milliseconds: `z.number().int().min(1.6e12).max(4.1e12)`.
  - Every MQTT payload carries `v: 1`. Adding an optional field needs no version bump. Any other change to an existing payload bumps `v` and needs sign-off from Squads A and B.
  - A new topic is additive: its payload starts at `v: 1`, no existing payload's `v` changes, and it needs sign-off only from the squads whose role publishes or subscribes to it.
  - `contracts/` imports only `zod`: no `node:` built-ins, because the dashboard bundles it.

### AD-5 — MQTT delivery semantics

- **Binds:** CAP-1, CAP-2, CAP-5, CAP-8, CAP-15; every MQTT client
- **Prevents:** duplicate rows on redelivery, clientId kick loops, ESP32 buffer overflows, stale commands re-applied on reconnect, liveness that never expires.
- **Rule:**
  - **Protocol and QoS:**
    - Use MQTT 3.1.1 features only; no MQTT 5 properties.
    - The QoS and retain flag of every topic come only from the topic table in `contracts/src/mqtt/topics.ts`. No QoS or retain literal appears anywhere else.
    - The ESP32 uses esp-mqtt, the client in the Arduino-ESP32 core. Its connection handling runs in its own task, but `esp_mqtt_client_publish` sends QoS 0 in the calling task and can block for about 10 s. So the signal-timing code never calls esp-mqtt: it publishes with `esp_mqtt_client_enqueue(…, store = true)` or hands payloads to a separate comms task, and a broker outage never stalls signal timing (AD-18). The firmware sets the 5 s keepalive (esp-mqtt defaults to 120 s) and protocol 3.1.1 explicitly.
    - Everything the ESP32 publishes is QoS 0. Every payload the ESP32 publishes or receives is ≤ 512 bytes. The ESP32 may subscribe at QoS 1.
    - The backend subscribes to every topic at the QoS the table gives it.
    - Only `controller/status`, `vision/status` and `controller/state` are retained. Commands, acks and events never are.
  - **Client identity and liveness:**
    - Each MQTT link has one fixed, unique clientId: `stl-backend`, `stl-controller`, `stl-vision`, `stl-serial-bridge`, `stl-sim-controller`, `stl-sim-vision`, `stl-sim-alerts`. Its MQTT username is the same string (AD-15).
    - Only one controller link is active at a time: `stl-controller`, `stl-serial-bridge` or `stl-sim-controller`. Only one vision link is active at a time: `stl-vision` or `stl-sim-vision`. `stl-sim-alerts` publishes only `vision/speed-alert` and is exempt from the status rule below.
    - Every client uses a 5 s keepalive.
    - The controller republishes `controller/state` at least every 2 s, even when nothing has changed. A change in `remainingS` alone doesn't trigger a publish; it rides the next republish or real change. This governs the controller's publishing only.
    - **Link state:** `services/link.ts` derives `link.<role>` only from fresh, non-retained messages. A role is `ONLINE` while a `controller/state` (vision: `vision/heartbeat`) arrived within the last 5 s (vision: 3 s), and `STALE` after that. It is `OFFLINE` at startup, and after a non-retained `status` with `online: false` until the next fresh message. `status` supplies `source` and `bootCount`; it never holds a role `OFFLINE` while fresh messages arrive.
    - A message delivered with the retain flag set never counts as liveness.
    - Every controller and vision link publishes a retained `status` with `online: true` on connect, and once more 10 s later, past a previous link's will delay. It sets a retained LWT with the same shape and `online: false`, and publishes that retained `online: false` itself before any graceful disconnect.
    - The serial bridge publishes `controller/status` on the ESP32's behalf, carrying the `bootCount` the ESP32 sends it over serial.
  - **Sessions and offline retention:**
    - The backend connects with `clean: false`, so QoS 1 messages queue at the broker while it restarts. The broker configuration in AD-15 holds that queue, and together they carry the offline-retention KPI (`kpis.md`).
    - Controller and vision links connect with `clean: true`, so a controller never receives stale queued commands when it reconnects.
  - **Persisting messages:**
    - Every persisted event (`vision/counts`, `vision/breach`) carries an `id` (UUID) generated by its publisher.
    - The backend inserts it with `INSERT … ON DUPLICATE KEY UPDATE id = id`. When `affectedRows` is 0, the message is a redelivery: it skips child rows and SSE pushes.
    - `controller/state` has no id. The backend persists a state only when one of `level`, `signal_ns`, `signal_ew`, `flood`, `fault`, `override_mode`, `override_phase` or `override_command_id` differs from the latest `signal_state_change` row, which it reads at startup. `remainingS` and `power` are live only and never persisted.

### AD-6 — Backend receive time is the time of record, except for vision events

- **Binds:** CAP-2, CAP-3, CAP-4, CAP-6
- **Prevents:** ordering and bucketing errors from an ESP32 that has no clock offline, and hourly totals that disagree between the chart and the live panel.
- **Rule:**
  - The backend stamps `receivedAt` on every message and stores it as UTC `DATETIME(3)`. It orders all history.
  - Controller payloads carry no `ts`.
  - Vision events (`vision/counts`, `vision/breach`, `vision/speed-alert`) are stamped by the laptop's own clock:
    - Their `occurredAt` is `ts` when present, otherwise `receivedAt`.
    - If `|ts − receivedAt| > 24 h`, `occurredAt` falls back to `receivedAt` and the backend logs a warning.
    - This rule lives only in `src/services/occurred-at.ts`, owned by the backend core.
    - Hourly counts bucket by `occurredAt`.
  - `db/pool.ts` runs `SET time_zone = '+00:00'` on every new connection, and mysql2 uses `timezone: 'Z'`.
  - Hours are Asia/Manila hours, bucketed with `CONVERT_TZ(col, '+00:00', '+08:00')`, a numeric offset with no named zones.
  - The API emits ISO-8601 UTC strings ending in `Z`. Only the dashboard converts to Asia/Manila, for display.

### AD-7 — An override is active only when the controller reports it

- **Binds:** CAP-5, CAP-8; `backend/`, `dashboard/`, `simulator/`, `firmware/`
- **Prevents:** the dashboard showing an override as active that the controller never applied; false failures when an ack is lost; two components inventing pending logic separately.
- **Rule:** Lifecycle (diagram in Structural Seed):
  1. The dashboard asks the operator to confirm, then sends `POST /api/overrides` with an `OverrideRequest`.
  2. The backend reads `getLink()`. If `link.controller` is not `ONLINE`, it inserts an `OverrideCommand` row as `REJECTED` with reason `CONTROLLER_OFFLINE`, pushes SSE `override` and returns `409 CONTROLLER_OFFLINE`. Nothing is published.
  3. Otherwise it inserts the row as `REQUESTED` with a new `commandId` and publishes `controller/override/cmd`. It returns `202` with the full `OverrideCommand` and pushes SSE `override`.
  4. The controller acks within 1 s of receipt. `APPLIED` means the controller accepted the command and it is in effect or transitioning.
  5. The command becomes `APPLIED` or `REJECTED` on whichever arrives first: a matching `controller/override/ack`, or a `controller/state` whose `override.commandId` matches. With neither within 5 s, it becomes `TIMEOUT`.
     - `TIMEOUT` is not terminal: a later matching ack or state still resolves it. Only `APPLIED` and `REJECTED` are terminal.
     - Every transition updates the row and pushes SSE `override`.
     - At startup, the backend marks `REQUESTED` rows older than 5 s as `TIMEOUT`.
  6. From the moment the controller applies a command, `state.override` reports it: `commandId` is its id and `mode` is its mode, through the yellow and all-red that lead into it. A release reports `{mode: "NONE", commandId: <release id>}` at once. `phase` is present if and only if `mode` is `CORRIDOR`, and `commandId` is absent only before the first command since boot.
     - A command that ends without a release, through the link-loss timeout (AD-18) or a conflict fault, reports `mode: "NONE"` with its own `commandId`. So `{NONE, X}` where X is not a `NONE` command always means "X ended on its own".
     - S0 models `override` as a discriminated union on `mode`.
  7. The dashboard's *active* indicator reads only `state.override`, from the SSE `state` slice. A `REQUESTED` command shows as pending; `REJECTED` or `TIMEOUT` shows a failure notice. The dashboard never shows an override as active before the controller reports it.
  - **Modes:** `FLASHING_AMBER`, `CORRIDOR` (requires `phase`: `NS` or `EW`) and `NONE` (release).
  - **One at a time:** a new command replaces the current one.
  - **Override log:** `/log/overrides/` lists commands. A command that ended on its own shows only in the state history, as its `{NONE, X}` row.
  - **Priority:** an override outranks every level. `state.level` keeps reporting the automatic level, so the dashboard displays level and override separately.
  - **Conflict fault:** a conflict-monitor fault outranks overrides.
    - While `fault` is true, the controller rejects `CORRIDOR` with reason `CONFLICT_FAULT`, and accepts `FLASHING_AMBER` and `NONE`.
    - A fault ends a `CORRIDOR` that is in effect (rule 6), and the corridor doesn't resume after the reset. A `FLASHING_AMBER` override that was in effect, or was accepted during the fault, stays in effect through the reset.
    - **Reset:** the fault latches, survives a reboot, and clears only from the reset button on the controller box (`degradation-levels.md`). After the reset, the cycle resumes at an all-red clearance unless an override is in effect. No override mode, REST route or backend topic clears a fault, and the dashboard has no reset control.
  - **Rejection reasons** are UPPER_SNAKE codes matching `^[A-Z][A-Z0-9_]{0,31}$`: `CONTROLLER_OFFLINE` (backend) and `CONFLICT_FAULT` (controller) are known. `visuals.ts` labels known codes and shows unknown ones raw.

### AD-8 — One SSE stream carries all live data, in one wire format

- **Binds:** CAP-3, CAP-5, CAP-6, CAP-8, CAP-10; `backend/src/sse/`, `backend/src/services/`, `dashboard/src/lib/live/`
- **Prevents:** a hub and a client built in parallel that can't talk to each other; two writers of one slice; dropped breaches in bursts; frozen data shown as live.
- **Rule:**
  - **Channel:** `GET /api/stream` (Server-Sent Events) is the only push channel. There are no WebSockets and no polling for live views, and no compression middleware runs on the backend.
  - **Wire format:**
    - Every frame is exactly `event: <name>\ndata: <JSON>\n\n`.
    - `<name>` is a key of `streamSchemas`. `<JSON>` is the bare value: no envelope and no `id:` line.
    - On connect, the hub writes `retry: 2000`, then the four slices in the order `link`, `state`, `counts`, `demand`.
    - A slice with no value yet is sent as `null`.
    - The hub writes only through `sseFrame(name, data)` from `contracts/src/api/stream/`.
  - **Slices and occurrences:**
    - Slices (`link`, `state`, `counts`, `demand`) carry their full current value on every write, and clients replace them, never merge.
    - Occurrences (`breach`, `override`, `speedAlert`) are sent once, when they happen.
  - **One writer per slice:**
    - Each slice has exactly one writer module, listed in the SSE table (Structural Seed).
    - The hub exposes `setSlice(name, value)`, `getSlice(name)` and `emit(name, value)`. Only a slice's writer calls `setSlice` for it.
    - Throttling lives only in the writer and is leading-edge with a trailing flush: send at once, hold further changes for 250 ms, then send the latest held value.
    - A writer never drops a write because the value looks unchanged, unless the SSE table says so.
  - **Timing:**
    - The backend writes a `: ping` comment every 15 s.
    - Budget: a message is written to SSE within 250 ms of `receivedAt`, and one backend-core test asserts it.
  - **Client API:** `LiveProvider`, mounted once in the root layout, opens the tab's only `EventSource`, registers one listener per key of `streamSchemas`, and parses each frame with its schema. It exposes:
    - `useLive(slice)`: the current slice value.
    - `useLiveEvent(name, handler)`: calls `handler` once per occurrence frame and holds no React state.
    - `useStreamEpoch()`: increments on every connect and reconnect. History views refetch REST page 1 when it changes, and upsert occurrences by `id` (breach) or `commandId` (override).
    - `useLiveness(role)`: `LIVE` or `STALE` (Staleness convention).
  - **Tests:** `LiveTestProvider` feeds the same hooks in tests. Nothing else touches `EventSource`.

### AD-9 — The dashboard is a static Next.js client

- **Binds:** CAP-3 to CAP-7, CAP-9 to CAP-11; `dashboard/`
- **Prevents:** Next.js becoming a second backend; an extra Node server running on the thermally constrained laptop; a dev-only page that breaks the demo build.
- **Rule:**
  - **Next.js config:** `next.config.ts` sets `output: 'export'`, `trailingSlash: true` and `allowedDevOrigins: ['127.0.0.1']`.
  - **Not allowed:** route handlers, server actions, `proxy`, rewrites, cookies and dynamic routes. Use query strings instead, for example `/breaches/?id=…`. Every component that calls `useSearchParams` sits inside a `<Suspense>` boundary.
  - **Data sources:**
    - No dashboard file imports `mysql2`, `mqtt`, anything under `backend/`, or `contracts/vehicle-classes.json`. Vehicle classes come from `GET /api/vehicle-classes`, through `useVehicleClasses()`.
    - Data comes only through `src/lib/api/` (REST) and `LiveProvider` (SSE). The CAP-7 video element is the one named exception (AD-17).
  - **API base URL and asset URLs:**
    - `src/lib/config.ts` reads the literal `process.env.NEXT_PUBLIC_API_URL`.
    - The shell commits `.env.development` (`http://127.0.0.1:4000`) and `.env.production` (empty, meaning same-origin). In demo mode, Express serves `dashboard/out/`.
    - URLs inside DTOs, such as `cropUrl`, are API-relative paths that the dashboard resolves with `apiUrl(path)`.
  - **Offline assets:** no remote assets: no CDN scripts and no `next/font/google`. Use `next/font/local` or the system font stack.
  - **IDs:** the dashboard never mints UUIDs.

### AD-10 — The backend owns the schema; dbmate applies it

- **Binds:** CAP-2, CAP-4, CAP-5, CAP-6, CAP-9; `backend/`
- **Prevents:** migration collisions across parallel branches, schema drift between laptops, two DB config variables, SQL scattered through routes.
- **Rule:**
  - **Migrations:**
    - The schema lives only in `backend/db/migrations/`, as dbmate plain-SQL files named `YYYYMMDDHHMMSS_<snake_name>.sql`. Create them with `dbmate new <name>` from `backend/`; each file has `-- migrate:up` and `-- migrate:down` sections.
    - A merged migration is never edited. Schema changes land only as new migrations.
  - **Workbench:** it stays the design and admin tool. Model in it, or reverse-engineer an EER diagram from the migrated schema for the course, but never apply a schema change from it. Squad A's data and QA member keeps the Workbench EER model and reviews migrations.
  - **Connection config:** one variable, `DATABASE_URL` (`mysql://stl:stl@127.0.0.1:3306/stl`), lives in `backend/.env`, and `backend/.env.test` holds the `stl_test` URL. dbmate and `src/config.ts` (mysql2 `uri`) both read it.
  - **Scripts:**
    - `backend/package.json` defines `db:migrate` as `dbmate --env-file .env --migrations-dir db/migrations --wait --no-dump-schema up`, and `db:migrate:test` with `.env.test`.
    - Backend `predev` and `prestart` run `db:migrate`, and the backend Vitest `globalSetup` runs `db:migrate:test`.
    - The root `db:migrate` only delegates with `-w backend`.
  - **Keys and seeds:**
    - The only foreign key is `breach_crop.breach_event_id → breach_event.id ON DELETE CASCADE`. `signal_state_change.override_command_id` is a plain `CHAR(36)`.
    - `test/reset-db.ts` deletes rows; it never truncates.
    - Seed rows use timestamps relative to `UTC_TIMESTAMP(3)`, so seeded history stays recent.
  - **Where SQL lives:** all runtime SQL lives in `backend/src/db/repositories/*.ts`. It is parameterized and goes through the one `mysql2/promise` pool in `backend/src/db/pool.ts`. The only SQL outside repositories is migrations and the demo seed files in `backend/db/seed/*.sql`, which `npm run db:seed` applies.
  - **Engine:** MySQL Community Server only. MariaDB, XAMPP and MySQL 8.0 are unsupported.

### AD-11 — Breach crops travel in the event and live in MySQL

- **Binds:** CAP-6, CAP-9, CAP-13; `backend/`, `simulator/`, `edge_vision/`
- **Prevents:** crop-file paths that differ between Windows and Linux, orphaned crop files, image handling in the backend, a breach lost because of its crop, a crop stored large enough to read a body number.
- **Rule:**
  - **Transport:** the vision role sends the crop inside `vision/breach` as base64 JPEG (`crop.mime: "image/jpeg"`, `crop.data`), already anonymized per `privacy-compliance.md`: the whole crop is scaled to at most 64 px on its long side and then blurred, before JPEG encoding. Nothing detects text first.
  - **Optional crop:** `crop` is optional in v1. The `vision/breach` schema types it as an optional `{mime: string, data: string}` with no further constraint, so a bad crop never fails the envelope (AD-4). The limits below appear in the JSON Schema `description` for Squad B.
  - **Crop checks:** all of them run in `vision-breach.persist.ts`: `mime` is `image/jpeg`; `data` passes `z.base64()` and is at most 204,800 characters; a SOF header is found; its long side is at most 64 px.
  - **Reading the SOF:** walk the marker segments from offset 2. Skip `FF` fill bytes and standalone markers (`D0`–`D7`, `01`), and skip every other segment by its bounds-checked length. Take the first SOFn (`C0`–`C3`, `C5`–`C7`, `C9`–`CB`, `CD`–`CF`). Stop as unreadable at SOS (`DA`), EOI (`D9`), a truncated length, or a zero width or height. Use no image library and never scan for byte pairs, which would read an EXIF thumbnail first. CAP-6's tests include an EXIF-thumbnail fixture.
  - **Crop format:** crops and the simulator's placeholder are baseline JPEGs without EXIF.
  - **Bad crops:** a breach whose crop fails any check is stored without a crop, with `cropUrl: null`, and the backend logs a warning. A crop problem never loses the event.
  - **What the backend checks:** size only. The blur is verified by CAP-13's acceptance test, not by the backend.
  - **Storage:** the backend writes `breach_event`, then `breach_crop` (`MEDIUMBLOB`, 0..1), in one transaction. It serves the bytes at `GET /api/breaches/:id/crop` with `Cache-Control: no-store`.
  - **No image processing:** no OCR, no face work, no re-encoding.
  - **Lists:** breach list items carry `cropUrl`, never crop bytes.
  - **Retention:** crops are deleted after 21 days (AD-19).
  - **M1:** the simulator sends the bundled `simulator/assets/placeholder-crop.jpg`, at most 64 px on its long side, so the full path runs.

### AD-12 — One vehicle-class file; PCU is computed once

- **Binds:** CAP-3, CAP-4, CAP-12, CAP-14
- **Prevents:** the vision node, simulator and dashboard drifting apart on class lists or PCU formulas.
- **Rule:**
  - **The file:** `contracts/vehicle-classes.json` (`[{id, label, pcu}]`) is the only source of class ids, labels and PCU weights. To change them, edit the file and restart; no code changes. `edge_vision/` loads this file by repo path at startup and keeps no other weight table.
  - **Ids** are lower snake_case.
  - **Seed values:** S0 seeds the classes and weights from `kpis.md`:

    | id | label | pcu |
    | --- | --- | --- |
    | `car` | Car | 1.0 |
    | `tricycle` | Tricycle | 0.5 |
    | `motorcycle` | Motorcycle (incl. habal-habal) | 0.25 |
    | `jeepney` | Jeepney | 1.5 |
    | `utility_van` | Utility van | 1.0 |

    There is no pedicab class. The PCU weights are cited, not calibrated, and Squad B's citations replace the placeholders by editing the file.
  - **Model labels:** the vision model's label names equal the class ids, so `edge_vision/` keeps no label mapping. `jeepney` stays in the file even though the demo model doesn't emit it.
  - **Who computes PCU:** only the vision role, meaning the vision node or the simulator's vision role. It publishes PCU in `vision/demand`, and the backend relays it without recomputing.
  - **Serving:** the backend serves the file at `GET /api/vehicle-classes`.
  - **Unknown ids:** ids that match `^[a-z][a-z0-9_]{0,31}$` but aren't in the file are accepted, stored, and shown raw.

### AD-13 — An npm-workspace TypeScript monorepo with one resolver and a lockfile S0 owns

- **Binds:** `contracts/`, `backend/`, `simulator/`, `dashboard/`
- **Prevents:** lockfile conflicts between parallel stories, contracts that type-check under one resolver and fail under another, scripts that only work on one OS.
- **Rule:**
  - **Workspaces:** the root `package.json` declares the workspaces `contracts`, `backend`, `simulator` and `dashboard`.
  - **Lockfile and versions:**
    - There is one root `package-lock.json`.
    - The root declares `engines.node: ">=24.22.1 <25"` and an `.nvmrc`.
    - Dependency versions are pinned exactly.
  - **Dependency ownership:**
    - S0 creates every workspace's `package.json` and installs every Stack-table dependency into its workspace at the pinned version.
    - No later M1 story edits `package-lock.json`. A story that needs a new dependency first lands it on `main` as a one-commit chore.
    - Resolve lockfile conflicts by taking `main`'s lockfile and rerunning `npm install`, never by editing the file.
  - **TypeScript config:**
    - `tsconfig.base.json` sets `strict`, `module: "esnext"`, `moduleResolution: "bundler"`, `allowImportingTsExtensions`, `noEmit`, `resolveJsonModule`, `verbatimModuleSyntax` and `types: ["node"]`.
    - Packages extend it and never override `module` or `moduleResolution`. The dashboard keeps `allowImportingTsExtensions`.
    - Relative imports use the `.ts` or `.tsx` extension.
  - **Code style:** every package uses `"type": "module"`. No TypeScript `enum`; use zod enums or string unions.
  - **Runtime:** the backend and simulator run through `tsx` in both dev and demo. `@stl/contracts` exports its TypeScript source.
  - **Scripts:**
    - Root scripts delegate as `npm run <script> -w <workspace> --`.
    - npm scripts must run unchanged in cmd, PowerShell and bash: no `rm`, `cp`, `export`, `&` or `VAR=x cmd`. Use node scripts or `concurrently`.
  - **Repo hygiene:** each workspace has its own `vitest.config.ts`. `.gitattributes` forces LF line endings. File names are lower-kebab-case.

### AD-14 — Thin foundation, single-owner files, extension by addition

- **Binds:** the M1 ticket breakdown; every Squad C story
- **Prevents:** three sessions each scaffolding the repo, two stories editing the same file, parallel work blocked behind one large foundation story.
- **Rule:**
  - **S0 lands first.** It writes no backend, dashboard or simulator code. It is the only story that creates:
    - the root workspace, every workspace `package.json` and the installed dependencies (AD-13);
    - the tooling config: TypeScript, Biome and the Vitest configs;
    - `contracts/` with every shape in the Structural Seed: MQTT payloads, the topic table, SSE schemas with `streamSchemas` and `sseFrame`, and the shared API shapes. It also seeds `vehicle-classes.json`;
    - the initial migration, with every M1 table in the ERD;
    - `infra/` and `docs/setup.md`;
    - the root `.gitignore`, which covers every workspace's `.env`, `infra/mosquitto/passwd`, `infra/mosquitto/credentials.env` and `infra/mosquitto/data/`.
  - **Three package cores** run in parallel right after S0, each with exactly one owner:
    - **backend core:** the composition root and boot order (below), `config.ts` (including an optional `MQTT_PASSWORD`), `pool.ts`, `services/errors.ts` (`AppError`), `services/occurred-at.ts` and the error middleware. It also owns the MQTT client, publisher and handler registry; the jobs registry; the SSE hub and `/api/stream`; `services/link.ts` with its handlers and job; `/api/health` and `/api/vehicle-classes`; the `db:seed` runner; and `test/reset-db.ts`.
    - **dashboard shell:** the root layout, with a header that shows the `link` slice and liveness, and navigation for the fixed M1 routes. It also owns `LiveProvider` and `LiveTestProvider`, and in `src/lib/`: `config.ts`, `api/client.ts` (`apiGet`, `apiPost`, `apiList`, `apiUrl`), `time.ts`, `use-vehicle-classes.ts` and `visuals.ts`. The shell creates no `page.tsx`.
    - **simulator core:** all of CAP-1 (AD-3), its `config.ts` (including an optional `MQTT_PASSWORD`), and the M2 hooks.
  - **Every later story** is a vertical CAP slice that owns the files assigned to its CAP in the Structural Seed tables. It extends only at the extension points below: it adds files, plus one registration line per file it owns in a shared index, kept alphabetical, one per line.
  - **Handler fan-out:** the handler registry fans out, so several stories can handle one topic, each in its own file. Handlers of one topic never depend on each other's side effects.
  - **Pages and components:** a page belongs to the CAP its route row names. Another CAP that needs space on that page adds its component under `src/components/<area>/` and one line in the page.
  - **Upstream not merged yet:** a story demonstrates its CAP flow against fixtures or seed data, then re-checks the flow against the simulator once the upstream lands.
  - **M2 work stays out of M1:** M1 stories don't render `remainingS`, `power`, `bootCount` or `speedAlert`, even though the slices carry them. In M2:
    - the CAP-8 story adds `components/controller/countdown.tsx`, `power-source.tsx` and `boot-count.tsx`, each mounted on `/` with one line; the header stays as the shell built it;
    - the CAP-8 story adds the hotspot files as new files: `infra/mosquitto/hotspot.conf`, `infra/mosquitto/acl`, `infra/scripts/broker-hotspot.mjs` and the root `broker:hotspot` script;
    - the CAP-8 and CAP-10 stories add simulator behaviors through the core's hooks (AD-3).

| To add a… | Add the file | Register it in |
| --- | --- | --- |
| MQTT ingest handler | `backend/src/mqtt/handlers/<topic-name>.<concern>.ts` | `backend/src/mqtt/handlers/index.ts` |
| Startup task or timer | `backend/src/jobs/<name>.ts`, exporting `{start(ctx), stop()}` | `backend/src/jobs/index.ts` |
| Service | `backend/src/services/<name>.ts` | not registered |
| REST route | `backend/src/http/routes/<resource>.ts` | `backend/src/http/routes/index.ts` |
| Repository | `backend/src/db/repositories/<table>.<concern>.ts`. Several stories may read one table, each from its own file. Only the CAP that ingests a table writes to it, and AD-19's `retention.purge.ts` is the only file that deletes. | not registered |
| Demo seed data | `backend/db/seed/<nn>-<table>.sql` | not registered (applied in lexical order) |
| DTO the seed doesn't list | `contracts/src/api/<resource>.ts` | `contracts/src/index.ts` |
| Dashboard API functions | `dashboard/src/lib/api/<resource>.ts` | not registered |
| Dashboard page | `dashboard/src/app/<route>/page.tsx` | navigation already created by the shell |
| Dashboard components | `dashboard/src/components/<area>/*.tsx` | not registered |
| Simulator behavior | `simulator/src/behaviors/<name>.ts` | `simulator/src/behaviors/index.ts` |
| Schema change | `dbmate new <name>` | not registered |

**Backend boot order** (owned by the backend core in `src/index.ts`):

1. Create the pool.
2. `await` every job's `start(ctx)`.
3. Register every MQTT handler.
4. `mqtt.connect`.
5. `listen`.

`src/app.ts` only builds the Express app. It never starts jobs or connects MQTT.

### AD-15 — Local-only runtime on one laptop

- **Binds:** all packages; CAP-2, CAP-5, CAP-8, CAP-15
- **Prevents:** an unauthenticated override path exposed on the hotspot, a hotspot client publishing override commands, queued telemetry silently dropped by broker defaults, environments that drift between laptops.
- **Rule:**
  - **Ports:** dashboard dev 3000 (open it at `http://localhost:3000`), backend 4000, Mosquitto 1883, MySQL 3306.
  - **Hosts:** service URLs use `127.0.0.1`.
  - **Express binding and CORS:**
    - Express binds `127.0.0.1` in M1 and M2. There is no operator login, so overrides can only come from the laptop itself.
    - The venue TV gets the dashboard over HDMI or by screen mirroring from the laptop, never by loading the dashboard on another device.
    - Binding Express to any other address needs an operator login first, and that is a spine change.
    - In dev, CORS allows `DASHBOARD_ORIGINS` (default `http://localhost:3000,http://127.0.0.1:3000`).
  - **MySQL binding:** MySQL accepts local connections only. `infra/mysql/create-user.sql` creates `'stl'@'localhost'` and `'stl'@'127.0.0.1'`, never `'%'`. `docs/setup.md` sets `bind-address` and `mysqlx-bind-address` to `127.0.0.1` on native installs.
  - **Broker config:**
    - Mosquitto runs only from `infra/mosquitto/mosquitto.conf`, started by `npm run broker`. That runs `infra/scripts/broker.mjs`, which finds `mosquitto` on the PATH or in `C:\Program Files\mosquitto` and spawns it with the repo root as cwd.
    - The config sets `listener 1883 127.0.0.1`, `allow_anonymous true`, `persistence true`, `persistence_location infra/mosquitto/data/` (gitignored), `autosave_interval 10` and `max_queued_messages 0`.
  - **Hotspot mode (M2):** the broker is the only listener that leaves `127.0.0.1`, and only with authentication.
    - `npm run broker:hotspot` runs `infra/scripts/broker-hotspot.mjs`. It regenerates `infra/mosquitto/passwd` from the gitignored `infra/mosquitto/credentials.env` with the local install's `mosquitto_passwd -c -b`, then starts Mosquitto from `infra/mosquitto/hotspot.conf`.
    - `hotspot.conf` is `mosquitto.conf` with four changes: `listener 1883` on all interfaces, with `use_username_as_clientid true`; `allow_anonymous false`; `password_file infra/mosquitto/passwd`; and `acl_file infra/mosquitto/acl`. Every other line is identical. These options work on Mosquitto 2.0 and 2.1.
    - **The password file isn't portable.** 2.1's `mosquitto_passwd` writes argon2id hashes and 64-byte salts, which a 2.0 broker rejects. So `passwd` is generated on the laptop that runs the broker and never copied between laptops; only the passwords are shared.
    - **Credentials:** each link's MQTT username is its clientId (AD-5), and `use_username_as_clientid` enforces that. The backend and simulator always send the username, plus `MQTT_PASSWORD` from their config when it is set. The simulator's users share one password. The ESP32, the vision node and the serial bridge keep theirs in their own config, outside git. The backend sets MQTT.js `reconnectOnConnackError: true` and logs a refused CONNACK as an error.
    - **ACL:** `infra/mosquitto/acl` is committed; its text is in the Structural Seed. Only `stl-backend` writes `controller/override/cmd`, and it writes nothing else. Each controller or vision user writes only its own role's topics and reads only what its role consumes, so the ESP32 never receives breaches. The ESP32 subscribes to exact topics, never wildcards.
  - **Installs:**
    - Native installs of MySQL Community Server and Mosquitto are the primary path on both OSes.
    - The optional `infra/compose.yaml` uses `mysql:9.7.4` and `eclipse-mosquitto:2.1.2-alpine`. It runs the broker with `infra/mosquitto/compose.conf` (`listener 1883`, otherwise identical) and publishes only `127.0.0.1:1883` and `127.0.0.1:3306`. Hotspot mode uses the native broker only.
  - **Config:**
    - The backend and simulator read config only in their own `src/config.ts`, validated with zod, from their package's `.env`. A committed `.env.example` documents each one, and no other file reads `process.env`.
    - `.env` is gitignored in every workspace. `.env.example`, `backend/.env.test` and the dashboard's `.env.development` and `.env.production` are committed.
    - The dashboard follows AD-9 instead.
  - **Network:** runtime network traffic stays on localhost and the LAN.

### AD-16 — One verification toolchain

- **Binds:** every story's definition of done
- **Prevents:** three different test strategies, and stories marked done that break the demo build.
- **Rule:**
  - **Runner:** every workspace uses Vitest, and `npm test` at the root runs them all.
  - **Backend tests:**
    - Route tests use Supertest against `createApp(deps)` from `src/app.ts`, never a listening port.
    - Handlers and jobs take `(payload, ctx)` or `start(ctx)`. `ctx` and `createApp(deps)` carry only core dependencies: `receivedAt` (handlers only), the hub, the publisher, `getLink` and the pool. Each CAP's handlers, routes and jobs import their own CAP's service module and pass it the dependencies it needs, so no CAP story edits `index.ts` or `app.ts` (AD-14). Tests pass fakes for the publisher and hub. Repository tests hit the real `stl_test` database, which `globalSetup` migrates and `test/reset-db.ts` resets. DB test files run serially (`fileParallelism: false`).
    - No test needs a broker.
  - **Simulator tests:** behaviors are tested as functions of state and input.
  - **Dashboard tests:** components and hooks that contain logic are tested with Testing Library and jsdom, under `LiveTestProvider`.
  - **Linting:** Biome lints and formats the whole repo from the root `biome.json`, with `css.parser.tailwindDirectives` on and the `next` and `react` domains set to recommended.
  - **Definition of done:**
    - `npm run typecheck`, `npm run lint` and `npm test` all pass.
    - A story that touches `dashboard/` also passes `npm run build -w dashboard`.
    - The story's CAP flow has been demonstrated against the simulator, and the steps are recorded in the story.
    - M1 has no browser end-to-end tests.

### AD-17 — M2 roles implement the contract; their internals stay with Squads A and B

- **Binds:** CAP-7, CAP-8, CAP-10, CAP-12 to CAP-17; `edge_vision/`, `firmware/`
- **Prevents:** video saturating the broker and backend, a serial fallback that forces backend changes, two owners of the L2 decision, a PCU value whose meaning each squad reads differently.
- **Rule:**
  - **Video:** frames never travel over MQTT or through backend ingest. CAP-7 may add exactly one video source to the dashboard: either an HTTP stream served by the vision node on the laptop and bound to `127.0.0.1` like Express, or an Express pass-through that never decodes frames. The choice is deferred to M2.
  - **Serial fallback:** the USB Serial fallback (CAP-15) is invisible to the backend. A laptop-side bridge, `stl-serial-bridge` (AD-5):
    - republishes the serial traffic on the same topics with the same payloads;
    - forwards `vision/heartbeat`, `vision/demand` and `controller/override/cmd` to the ESP32.
    - **Switching is break-before-make:** the old controller link publishes `online: false` and disconnects before the new one connects, and the ESP32 keeps its esp-mqtt client stopped while it is in serial mode.
  - **Heartbeat:** the vision role publishes `vision/heartbeat` at 1 Hz. The controller decides L2 only from 3 missed heartbeats or `ok: false` (`degradation-levels.md`). `confidence` and `fps` are informational, for the dashboard.
  - **Demand:**
    - `vision/demand.pcu.<approach>` is the sum of the PCU weights of the vehicles currently inside that approach's ROI. It is ≥ 0 and 0 when the approach is empty, and it is not a rate. The simulator models the same quantity.
    - `vision/demand` is on the <200 ms frame-to-LED path (`kpis.md`), so it is throttled on the leading edge: publish a change at once, then hold further changes for 100 ms.
  - **Speed alert (CAP-10):** `vision/speed-alert` is a mockup, not a measurement. The vision node publishes it when a vehicle crosses two virtual lines on one approach in less than a set time, carrying `elapsedMs` and `thresholdMs` and no speed unit. Both are integer milliseconds, rounded by the vision node, with `thresholdMs` ≥ 1 and 0 ≤ `elapsedMs` < `thresholdMs`. Squad B adds it only after CAP-12 and CAP-13 meet their KPIs; until then the simulator's `--speed-alerts` mode stands in (AD-3).
  - **Ownership:** firmware and the vision node implement *MQTT contract v1* and the clientIds in AD-5. Everything else inside them belongs to Squads A and B.

### AD-18 — The controller never depends on the backend

- **Binds:** CAP-1, CAP-5, CAP-8, CAP-14 to CAP-18; `firmware/`, `simulator/`, `backend/`
- **Prevents:** a later story putting the backend or dashboard into the signaling safety path.
- **Rule:**
  - The controller keeps signaling whatever else is down:
    - Losing the vision node or a sensor lowers the level.
    - Losing the broker, backend or dashboard never stops signaling.
  - **Override when the link drops** (`degradation-levels.md`): the controller sees only its own command link, which is its broker connection, or the serial bridge while the CAP-15 fallback is in use.
    - `FLASHING_AMBER` holds until a release arrives.
    - `CORRIDOR` holds for 60 s after the command link is lost, then returns to automatic through yellow and an all-red clearance. A shorter drop changes nothing, and a working serial fallback counts as a link.
    - The backend learns of the release from `state.override` when the link returns (AD-7, rule 6).
  - No controller behavior waits on a backend message, a retained topic or an ack. The controller consumes only `vision/heartbeat`, `vision/demand` and `controller/override/cmd`.
  - The backend publishes only `controller/override/cmd`. Adding any other topic from the backend to the controller is a spine change.
  - The simulated controller follows the same rules. Stopping the backend while the simulator runs is a recorded step in the CAP-1 demo.

### AD-19 — One purge job enforces retention

- **Binds:** CAP-2, CAP-6, CAP-9; `backend/src/jobs/`, `backend/src/services/`, `backend/src/db/repositories/`, `infra/`
- **Prevents:** two places deleting data on different periods, crops kept past 21 days, counts deleted by mistake, a backup that outlives the crop period.
- **Rule:**
  - **Periods** (`privacy-compliance.md`):

    | Data | Deleted when | By column |
    | --- | --- | --- |
    | `breach_crop` | its breach is over 21 days old | `breach_event.occurred_at` |
    | `breach_event` and its crop | over 1 year old | `occurred_at` |
    | `signal_state_change` | over 1 year old | `received_at` |
    | `override_command` | over 1 year old | `requested_at` |
    | `vehicle_count` | never | none |

  - **One job:** `backend/src/jobs/retention-purge.ts` runs at boot and every 24 h after. It calls `services/retention.ts`, which holds the periods as constants, and that calls `db/repositories/retention.purge.ts`. One story owns all three. It is the only runtime code that deletes rows; test resets (AD-16) are separate.
  - **Reads after a purge:** a breach whose crop was purged lists with `cropUrl: null`, and its crop route returns 404. A list cursor encodes the last item's sort-key values, never a row reference, so a purge never breaks paging.
  - **Backups:** `npm run db:backup`, a node script the same story owns, writes two files:
    - `mysqldump --single-transaction --ignore-table=stl.breach_crop --result-file=<data file> stl`;
    - `mysqldump --no-data --result-file=<schema file> stl breach_crop`, because `--ignore-table` drops the table's definition too.

    Restore both. Any dump that includes crops is deleted within 21 days. `infra/mosquitto/data/`, which can queue breaches with crops for the backend, is never copied off the laptop.
  - **When:** before the first real vision-node crop reaches the backend, at the CAP-13 integration. Until then, the vision node runs only against a database that is dropped afterwards. Simulator placeholder crops aren't personal data.

## Consistency Conventions

| Concern | Convention |
| --- | --- |
| Topic names | `stl/<iid>/<role>/<noun>[/<verb>]`, lower case. `iid` comes from `INTERSECTION_ID`, default `int-01`, matching Squad A's INT-01 label. Topic strings, QoS and retain flags come only from `contracts/src/mqtt/topics.ts`. |
| JSON keys | camelCase in MQTT, REST and SSE. |
| DB names | snake_case and singular table names. `id` is the `BIGINT AUTO_INCREMENT` primary key. Publisher UUIDs are `CHAR(36)`. `*_at` columns are UTC `DATETIME(3)`. |
| Public ids | APIs expose publisher UUIDs (`id`, `commandId`), never auto-increment ids. The backend, simulator and vision node mint UUID v4s (`crypto.randomUUID()` in Node, `uuid.uuid4()` in Python); the dashboard never mints them. |
| Enums | UPPER_SNAKE strings. Each family's values: |
| | Level: `L1`, `L2`, `L3`, `L4` |
| | Aspect: `GREEN`, `YELLOW`, `RED`, `FLASHING_AMBER`, `DARK` |
| | Override mode: `NONE`, `FLASHING_AMBER`, `CORRIDOR` |
| | Flood: `DRY`, `WET`, `FLOODED` |
| | Power: `USB`, `BATTERY` |
| | Source: `sim`, `live`, lower case, the one exception in contract v1 |
| | Command status: `REQUESTED`, `APPLIED`, `REJECTED`, `TIMEOUT` |
| | Rejection reason: `CONTROLLER_OFFLINE`, `CONFLICT_FAULT` |
| | Link: `ONLINE`, `STALE`, `OFFLINE` |
| | Broker: `CONNECTED`, `DISCONNECTED` |
| | Liveness: `LIVE`, `STALE` |
| | Approach: `N`, `S`, `E`, `W` |
| | Phase: `NS`, `EW` |
| | Vehicle-class ids follow AD-12. |
| REST shape | JSON under `/api`. A single resource is the object itself. A list is `Page<T>`: newest first. `ListQuery` takes `limit` (1 to 200, default 50) and an opaque `cursor` that encodes the last item's sort-key values, never a row reference. An out-of-range limit or an undecodable cursor returns 400. The CAP-9 CSV export is the one non-JSON, unpaged route (Deferred). |
| Errors | `ApiError` with an UPPER_SNAKE `code`: 400 `VALIDATION_FAILED`, 404 `NOT_FOUND`, 409 `CONTROLLER_OFFLINE`, 500 `INTERNAL`. Services and routes throw `AppError(code, message)`. The one error middleware maps `AppError` to its status, `ZodError` to 400 and everything else to 500. MQTT handlers catch errors per message, so a bad message never stops ingest. |
| Logging | `console.info`, `console.warn` and `console.error`, prefixed `[mqtt]`, `[http]`, `[sse]`, `[db]`, `[job]` or `[sim]`. Logs never contain crop data. |
| Dashboard data | Live data comes from the `LiveProvider` hooks (AD-8). History comes from `src/lib/api/<resource>.ts` functions called inside `useEffect`. No SWR, TanStack Query, Redux or Zustand in M1. |
| Dashboard time | Every displayed time goes through `src/lib/time.ts` (`formatManila`, `manilaHourLabel`), which uses `Intl` with `timeZone: 'Asia/Manila'`. Never use offset arithmetic. |
| Dashboard visuals | `src/lib/visuals.ts` is the only source of colors and labels for every enum family above. It also provides `classColor(id)`, derived from the order in `vehicle-classes.json`, with a neutral color for unknown ids. Colors are Tailwind v4 `@theme` tokens in `globals.css`. Level labels use the `degradation-levels.md` names: L1 Vision adaptive, L2 Stop-bar presence, L3 Fixed timing, L4 Flashing Amber. Never describe L2 as queue measurement. `fault: true` shows as a distinct FAULT state, never as L4. Shared atoms (`LevelBadge`, `AspectLamp`, `StaleBadge`, `ClassLabel`, `ConfirmDialog`) live in `src/components/ui/`, owned by the shell. Charts use Recharts. No UI component kit in M1. |
| Countdown (M2) | The dashboard counts down locally from `state.remainingS`, starting at the state's `receivedAt`, and resyncs on every `state`. It shows `max(0, remainingS − ⌊(now − receivedAt) / 1000⌋)`. A green in L1 or L2 shows "up to N s", because it can end early. Yellow, all-red and an L3 green show "N s". With no `remainingS`, or while `useLiveness('controller')` is `STALE`, no countdown shows: a timer isn't a value, so the Staleness rule's keep-last-value doesn't apply. |
| Speed alert (M2) | A `speedAlert` shows as a transient alert on `/` only, from `components/speed-alert/` with one line in the page, labeled as an uncalibrated mockup. It shows approach, class, time and "faster than threshold". It may show `elapsedMs` and `thresholdMs` as times, never as a speed. |
| Staleness | A role's data is `LIVE` only while three things hold: the SSE stream is open, `link.broker` is `CONNECTED`, and `link.<role>` is `ONLINE`. Views read this only through `useLiveness(role)`. A stale view keeps its last value and marks it stale; it never blanks it. |
| Display target | Every view targets full-screen Chromium at 1920×1080 on the venue TV. The live status view (`/`) fits without page scroll. |
| Privacy | Data about vehicles and road users is limited to the Tier 1 list in `privacy-compliance.md`: timestamp, vehicle class, centroid, anonymized crop and aggregates. Nothing identifying is stored, logged, shown or exported: no OCR text, plate or body number, face, driver identity or cross-frame track id. No component runs OCR or text detection, or joins vehicle data with any external registry or database. Speed alerts are shown transiently and never stored. Operational data (signal state, levels, overrides, link health, PCU, power source) is allowed. Retention follows AD-19. |
| Branching | Each story works on its own short-lived branch and rebases on `main` before merging. `main` is protected by a GitHub ruleset: every change, including the AD-4 and AD-13 one-commit chores, lands through a pull request, and `main` can't be force-pushed or deleted. When two stories add registration lines to the same index, keep both lines in alphabetical order. |

## Stack

These are seed versions, verified against the npm registry and upstream release pages on 2026-10-22. Once the code exists, `package.json` and the lockfile own them, and S0 installs every row (AD-13).

| Name | Version |
| --- | --- |
| Node.js (Maintenance LTS "Krypton", EOL 2028-04-30) | 24.22.1 |
| npm, with workspaces | 11.x, bundled with Node 24 |
| TypeScript | 6.0.3 (memlog: why not 7.x) |
| @types/node | 24.19.2 |
| Next.js | 16.4.2 |
| React, React DOM | 19.3.1 |
| @types/react, @types/react-dom | 19.3.0 |
| react-is (Recharts peer) | 19.3.1 |
| Tailwind CSS, @tailwindcss/postcss | 4.3.3 |
| postcss | 8.5.31 |
| Recharts | 3.10.1 |
| Express | 5.3.0 |
| @types/express | 5.0.6 |
| mysql2 | 3.24.6 |
| dbmate (npm, bundles Windows and Linux x64 binaries) | 2.37.0 |
| mqtt (MQTT.js) | 5.16.1 |
| zod | 4.6.7 |
| tsx | 4.23.15 |
| concurrently | 10.0.6 |
| Vitest | 5.0.5 |
| vite (Vitest peer) | 8.3.4 |
| Supertest, @types/supertest | 7.3.1, 7.2.1 |
| @testing-library/react, @testing-library/dom | 16.3.3, 10.4.2 |
| jsdom | 30.1.3 |
| @biomejs/biome | 2.6.2 |
| MySQL Community Server | 9.7.4 (8.4.x accepted) |
| MySQL Workbench | 26.7 or later |
| Eclipse Mosquitto | 2.1.2 (2.0.x accepted; the repo config uses only options common to both, but a password file isn't portable between them, AD-15) |

## Structural Seed

### MQTT contract v1

**Locked 2026-10-22** as the Week-1 schema (`milestones.md`). Changes follow AD-4: an optional field may be added freely; a new topic is additive and needs sign-off from the squads that publish or subscribe to it; anything else bumps `v` and needs sign-off from Squads A and B. S0 encodes this table in `contracts/src/mqtt/topics.ts` as `{build(iid), qos, retain, publisherRole}` per topic. From then on that file is authoritative.

**Additive changes, 2026-10-22, by user decision:** optional `remainingS` and `power` in `controller/state`, optional `bootCount` in `controller/status`, and the `vision/speed-alert` topic. The user waived Squad B's sign-off on the new topic: Squad B's lead is told, not asked, and a later change from them is an AD-4 contract change. Squad A's firmware is unaffected by the new topic.

| Topic under `stl/<iid>/` | Publisher | Subscribers | QoS | Retained | What the backend does |
| --- | --- | --- | --- | --- | --- |
| `controller/status` | controller (and its LWT) | backend | 0 | yes | updates `link` |
| `controller/state` | controller | backend, simulator | 0 | yes | updates the `state` slice; persists changes; refreshes controller liveness, but not from a retained copy; resolves a matching `OverrideCommand` |
| `controller/override/ack` | controller | backend | 0 | no | resolves an `OverrideCommand` |
| `controller/override/cmd` | backend | controller | 1 | no | inserts the `OverrideCommand` row before publishing |
| `vision/status` | vision (and its LWT) | backend | 1 | yes | updates `link` |
| `vision/heartbeat` | vision | controller, backend | 0 | no | refreshes vision liveness |
| `vision/demand` | vision | controller, backend | 0 | no | updates the `demand` slice |
| `vision/counts` | vision | backend | 1 | no | inserts `vehicle_count` rows, then refreshes the `counts` slice |
| `vision/breach` | vision | backend | 1 | no | inserts `breach_event` and `breach_crop`, then emits `breach` |
| `vision/speed-alert` | vision | backend | 0 | no | emits `speedAlert`; never persisted (CAP-10, M2) |

```jsonc
// controller/status and vision/status: retained; the LWT and the pre-disconnect message use the same shape with "online": false
{ "v": 1, "online": true, "source": "sim" }               // source: "sim" | "live"
// controller/status only, optional (M2): "bootCount": 42, the NVS boot counter, also in the LWT; the serial bridge relays it

// controller/state: retained; published on every change and at least every 2 s; at most 512 bytes
{ "v": 1, "level": "L1",
  "signals": { "NS": "GREEN", "EW": "RED" },
  "flood": "DRY",
  "fault": false,
  "override": { "mode": "NONE", "commandId": "<uuid>" },
  "remainingS": 12,
  "power": "USB" }
// fault: true is a conflict-monitor fault; it forces FLASHING_AMBER on both phases, and level keeps reporting the automatic level
// flood stays FLOODED until 30 s dry, when L4 exits
// override: the last command applied, from the moment it is applied (AD-7 rule 6); absent only before the first command since boot
//   a corridor, including its lead-in yellow and all-red: "override": { "mode": "CORRIDOR", "phase": "NS", "commandId": "<uuid>" }
//   phase is present only with CORRIDOR
//   { "mode": "NONE", "commandId": X } with X not a NONE command: X ended on its own (link-loss timeout or conflict fault)
// remainingS (optional, M2): ceil(ms left / 1000) in the green, yellow or all-red now running; in an L1/L2 green, the time to the
//   latest moment that green can end (max green on the ESP32); present for every yellow and all-red, including those into and
//   out of an override; absent while nothing is timed (FLASHING_AMBER, a CORRIDOR green, a fault); a change in it alone doesn't
//   trigger a publish
// power (optional, M2): "USB" | "BATTERY", from the GPIO 35 sense
// optional in the schema so the M1 simulator can omit them; from M2 the ESP32 always sends power and bootCount, and remainingS
//   whenever an interval is timed

// controller/override/cmd: published only by the backend
{ "v": 1, "commandId": "<uuid>", "ts": 1793000000000, "mode": "CORRIDOR", "phase": "EW" }
// "mode": "NONE" releases the override; "phase" is present only with CORRIDOR

// controller/override/ack: sent within 1 s of receiving the command
{ "v": 1, "commandId": "<uuid>", "result": "APPLIED" }    // or "result": "REJECTED", "reason": "CONFLICT_FAULT"
// reason matches ^[A-Z][A-Z0-9_]{0,31}$ (AD-7)

// vision/heartbeat: 1 Hz; ok is the vision node's own frame-quality verdict
{ "v": 1, "ts": 1793000000000, "seq": 812, "ok": true, "confidence": 0.91, "fps": 17.2 }

// vision/demand: on change, leading-edge throttled to at most 10 Hz; PCU currently in each ROI
{ "v": 1, "ts": 1793000000000, "pcu": { "N": 2.5, "S": 0, "E": 1.0, "W": 0.5 } }

// vision/counts: crossings since the previous message; at most once per second; not sent when there were none
{ "v": 1, "id": "<uuid>", "ts": 1793000000000,
  "crossings": [ { "approach": "N", "vehicleClass": "tricycle", "count": 2 } ] }
// each approach + vehicleClass pair appears at most once; count is an integer >= 1

// vision/breach: centroid in normalized frame coordinates (0 to 1)
{ "v": 1, "id": "<uuid>", "ts": 1793000000000, "approach": "E",
  "vehicleClass": "motorcycle", "centroid": { "x": 0.42, "y": 0.61 },
  "crop": { "mime": "image/jpeg", "data": "<base64>" } }
// crop: optional; an anonymized baseline JPEG without EXIF, at most 64 px on its long side and 204,800 base64 characters;
//   the backend checks it, not the schema (AD-11)

// vision/speed-alert (M2, CAP-10): crossed two virtual lines on one approach in elapsedMs < thresholdMs; an uncalibrated mockup
{ "v": 1, "id": "<uuid>", "ts": 1793000000000, "approach": "W",
  "vehicleClass": "car", "elapsedMs": 640, "thresholdMs": 800 }
// elapsedMs, thresholdMs: integer milliseconds; thresholdMs >= 1; 0 <= elapsedMs < thresholdMs
```

### Broker ACL (M2 hotspot)

`infra/mosquitto/acl`, added by the CAP-8 story (AD-15). Lines after a `user` line apply to that user only.

```text
user stl-backend
topic read stl/#
topic write stl/+/controller/override/cmd

# stl-controller; the same block for stl-serial-bridge
user stl-controller
topic read stl/+/vision/heartbeat
topic read stl/+/vision/demand
topic read stl/+/controller/override/cmd
topic write stl/+/controller/status
topic write stl/+/controller/state
topic write stl/+/controller/override/ack

# the controller block, plus the reads for its start check
user stl-sim-controller
topic read stl/+/vision/heartbeat
topic read stl/+/vision/demand
topic read stl/+/controller/override/cmd
topic read stl/+/controller/state
topic write stl/+/controller/status
topic write stl/+/controller/state
topic write stl/+/controller/override/ack

user stl-vision
topic write stl/+/vision/#

user stl-sim-vision
topic read stl/+/vision/heartbeat
topic write stl/+/vision/#

user stl-sim-alerts
topic write stl/+/vision/speed-alert
```

`docs/setup.md` includes a hotspot smoke test: a publish to `controller/override/cmd` as `stl-vision` must not reach a `stl/#` subscriber running as `stl-backend`. The broker drops a denied publish silently, even at QoS 1.

### Shared API shapes

S0 creates these in `contracts/src/api/`. `iso` means an ISO-8601 UTC string ending in `Z`.

```ts
// common.ts
ApiError        = { error: { code: "VALIDATION_FAILED" | "NOT_FOUND" | "CONTROLLER_OFFLINE" | "INTERNAL", message: string } }
ListQuery       = { limit?: int 1..200 (default 50), cursor?: string }
Page<T>         = { items: T[], nextCursor: string | null }
Health          = { ok: boolean, db: boolean, broker: boolean }
VehicleClass    = { id: string, label: string, pcu: number }

// breaches.ts: SSE `breach` and GET /api/breaches items
BreachItem      = { id: uuid, occurredAt: iso, receivedAt: iso, approach: "N" | "S" | "E" | "W",
                    vehicleClass: string, centroid: { x: number, y: number },
                    cropUrl: string | null }            // "/api/breaches/<id>/crop", API-relative

// overrides.ts: SSE `override`, the 202 response and GET /api/overrides items
OverrideRequest = { mode: "NONE" | "FLASHING_AMBER" | "CORRIDOR", phase?: "NS" | "EW" }   // phase required iff CORRIDOR
OverrideCommand = { commandId: uuid, mode, phase: "NS" | "EW" | null,
                    status: "REQUESTED" | "APPLIED" | "REJECTED" | "TIMEOUT",
                    reason: string | null, requestedAt: iso, resolvedAt: iso | null }

// counts.ts: SSE `counts` and each bucket of GET /api/counts/hourly
HourCounts      = { hourStart: iso,                     // UTC instant of the Asia/Manila hour start
                    total: int,
                    byApproach: { N: ClassCounts, S: ClassCounts, E: ClassCounts, W: ClassCounts } }
ClassCounts     = { [classId: string]: int }            // dense: every configured class id (0 when none) plus any unknown id seen
HourlyCounts    = { date: "YYYY-MM-DD", buckets: HourCounts[] }  // exactly 24 buckets, Asia/Manila date

// speed-alerts.ts: SSE `speedAlert` (M2, CAP-10); no REST, never stored
SpeedAlertItem  = { id: uuid, occurredAt: iso, receivedAt: iso, approach: "N" | "S" | "E" | "W",
                    vehicleClass: string, elapsedMs: int, thresholdMs: int }
```

### SSE stream

```text
retry: 2000

event: link
data: {"broker":"CONNECTED","controller":{"status":"ONLINE","source":"sim","bootCount":null},"vision":{"status":"ONLINE","source":"sim"}}

event: state
data: null

```

| Event | Kind | Data (`contracts/src/api/stream/`) | Sole writer | Owner |
| --- | --- | --- | --- | --- |
| `link` | slice | `{broker, controller: {status, source, bootCount}, vision: {status, source}}`; `source` and `bootCount` are null when unknown | `services/link.ts` | backend core |
| `state` | slice, nullable | the `controller/state` payload without `v`, plus `receivedAt`; carries `remainingS` and `power` when sent. Written on every non-retained state, periodic republishes included, never compared with the last value; a retained copy is written with `remainingS` removed | `services/state.ts` | CAP-3 |
| `counts` | slice, nullable | `HourCounts` for the current Asia/Manila hour | `services/counts.ts`, pushed after each insert and at every hour boundary | CAP-2 |
| `demand` | slice, nullable | `{pcu: {N, S, E, W}, receivedAt}`, leading-edge 250 ms | `services/demand.ts` | CAP-3 |
| `breach` | occurrence | `BreachItem` | `services/breaches.ts` | CAP-6 |
| `override` | occurrence | `OverrideCommand` | `services/overrides.ts` | CAP-5 |
| `speedAlert` | occurrence | `SpeedAlertItem` | `services/speed-alerts.ts` | CAP-10 (M2) |

### Backend file ownership (M1)

| File | Does | Owner |
| --- | --- | --- |
| `mqtt/handlers/controller-status.link.ts`, `vision-status.link.ts`, `controller-state.link.ts`, `vision-heartbeat.link.ts` | feed `services/link.ts` | backend core |
| `jobs/link-watchdog.ts` | STALE timers: 5 s controller, 3 s vision | backend core |
| `mqtt/handlers/controller-state.persist.ts`, `jobs/state-dedup-preload.ts` | dedup and insert `signal_state_change` | CAP-2 |
| `mqtt/handlers/vision-counts.persist.ts`, `jobs/counts-slice.ts`, `services/counts.ts` | insert crossings; seed the slice at boot and push it at each Asia/Manila hour; `services/counts.ts` also serves the hourly buckets for CAP-4, so the slice and the chart bucket alike | CAP-2 |
| `http/routes/state-changes.ts` | `/api/state-changes` | CAP-2 |
| `http/routes/counts.ts` | `/api/counts/hourly`, through `services/counts.ts` | CAP-4 |
| `mqtt/handlers/controller-state.slice.ts`, `mqtt/handlers/vision-demand.slice.ts`, `services/state.ts`, `services/demand.ts` | the `state` and `demand` slices | CAP-3 |
| `mqtt/handlers/controller-override-ack.resolve.ts`, `mqtt/handlers/controller-state.resolve.ts`, `jobs/override-timeouts.ts`, `services/overrides.ts`, `http/routes/overrides.ts` | the override lifecycle (AD-7) | CAP-5 |
| `mqtt/handlers/vision-breach.persist.ts`, `services/breaches.ts`, `http/routes/breaches.ts` | breach ingest, the crop checks (AD-11), crop and list | CAP-6 |

### REST surface and dashboard routes (M1)

| Endpoint | Returns | Owner |
| --- | --- | --- |
| `GET /api/health` | `Health` | backend core |
| `GET /api/stream` | SSE (AD-8) | backend core |
| `GET /api/vehicle-classes` | `VehicleClass[]` | backend core |
| `GET /api/state-changes` | `Page<StateChangeItem>`; the CAP-2 story defines `StateChangeItem` | CAP-2 |
| `GET /api/counts/hourly?date=YYYY-MM-DD` | `HourlyCounts`; `date` defaults to today in Asia/Manila | CAP-4 |
| `GET /api/overrides` | `Page<OverrideCommand>` | CAP-5 |
| `POST /api/overrides` | `202 OverrideCommand`, or `409 ApiError` (AD-7) | CAP-5 |
| `GET /api/breaches` | `Page<BreachItem>` | CAP-6 |
| `GET /api/breaches/:id/crop` | `image/jpeg`, or 404 | CAP-6 |

| Route | Shows | Owner |
| --- | --- | --- |
| `/` | live status; the override panel is added from `components/override/` | CAP-3 (CAP-5 adds the panel) |
| `/traffic/` | hourly peaks chart | CAP-4 |
| `/breaches/` | breach log | CAP-6 |
| `/log/overrides/` | override log | CAP-5 |
| `/log/states/` | signal-state history | CAP-2 |

### Override lifecycle

```mermaid
sequenceDiagram
  participant UI as Dashboard
  participant BE as Backend
  participant DB as MySQL
  participant MQ as Mosquitto
  participant C as Controller (ESP32 or simulator)
  UI->>UI: operator confirms
  UI->>BE: POST /api/overrides {mode, phase}
  alt link.controller not ONLINE
    BE->>DB: insert OverrideCommand (REJECTED, CONTROLLER_OFFLINE)
    BE-->>UI: SSE override (REJECTED)
    BE-->>UI: 409 CONTROLLER_OFFLINE
  else link.controller ONLINE
    BE->>DB: insert OverrideCommand (REQUESTED)
    BE->>MQ: controller/override/cmd (QoS 1)
    BE-->>UI: 202 OverrideCommand (REQUESTED)
    BE-->>UI: SSE override (REQUESTED)
    MQ->>C: cmd
    C->>MQ: ack within 1 s, then controller/state with override.commandId
    MQ->>BE: first of ack or matching state
    BE->>DB: update status (APPLIED or REJECTED)
    BE-->>UI: SSE override (APPLIED) and SSE state (override active)
    Note over BE: neither within 5 s gives TIMEOUT, which a later ack or state still resolves
  end
```

### Data model (M1)

S0's initial migration creates every M1 table. Vehicle data in them stays within the Privacy convention.

```mermaid
erDiagram
  vehicle_count {
    bigint id PK
    char36 msg_id "unique with approach and vehicle_class"
    char1 approach
    varchar32 vehicle_class
    int count
    datetime3 occurred_at
    datetime3 received_at
  }
  signal_state_change {
    bigint id PK
    varchar level
    varchar signal_ns
    varchar signal_ew
    varchar flood
    boolean fault
    varchar override_mode
    varchar override_phase
    char36 override_command_id
    datetime3 received_at
  }
  breach_event {
    bigint id PK
    char36 event_id UK
    char1 approach
    varchar32 vehicle_class
    double centroid_x
    double centroid_y
    datetime3 occurred_at
    datetime3 received_at
  }
  breach_crop {
    bigint breach_event_id PK
    varchar mime
    mediumblob data
  }
  override_command {
    bigint id PK
    char36 command_id UK
    varchar mode
    varchar phase
    varchar status
    varchar reason
    datetime3 requested_at
    datetime3 resolved_at
  }
  breach_event ||--o| breach_crop : "has crop"
```

### Runtime and environments

```mermaid
flowchart TB
  subgraph dev["Dev (each developer's laptop)"]
    d0["npm run broker: Mosquitto with the repo config"]
    d1["npm run dev: backend (tsx watch, :4000) + dashboard (next dev, :3000)"]
    d2["npm run sim: simulator in its own terminal (REPL)"]
    d3["MySQL as an OS service, or infra/compose.yaml"]
  end
  subgraph demo["Demo (M1 instructor, M2 venue)"]
    p1["npm run build: dashboard static export to dashboard/out"]
    p2["npm start: backend serves dashboard/out + /api on :4000"]
    p3["Chromium full screen at http://127.0.0.1:4000/"]
    p4["M1: npm run sim -- --scenario demo. M2: npm run broker:hotspot, edge_vision + ESP32 on the hotspot, simulator only as --speed-alerts"]
  end
  p1 --> p2 --> p3
```

**Local setup (Windows and Linux).** `docs/setup.md` holds the full steps; S0 writes it.

1. **Install:**
   - Node 24.22.1 or later (`.nvmrc`).
   - MySQL Community Server:
     - Windows: the 9.7.4 MSI.
     - Fedora: `mysql9.7-server`, or `mysql-server` for 8.4.
     - Ubuntu 26.04: `mysql-server` (8.4).
     - Ubuntu 24.04: the Oracle MySQL APT repo. Its distro package is 8.0, which is unsupported.
   - Mosquitto:
     - Windows: the mosquitto.org 2.1.2 installer, or WinGet.
     - Fedora 44: `mosquitto` (2.1.2).
     - Ubuntu 24.04: the `ppa:mosquitto-dev/mosquitto-ppa` package (2.1.2), or the distro's 2.0.18.
     - Ubuntu 26.04: the distro's 2.0.22.
   - MySQL Workbench 26.7 or later.
2. From the repo root, run `npm install`.
3. As the MySQL root user, run `infra/mysql/create-user.sql`. It creates the user `stl` with password `stl`, at `localhost` and `127.0.0.1` only, and grants on `stl` and `stl_test`. On a native install, set `bind-address` and `mysqlx-bind-address` to `127.0.0.1` (AD-15).
4. Copy `backend/.env.example` and `simulator/.env.example` to `.env`. The dashboard's `.env.development` and `.env.production` are committed.
5. Stop any Mosquitto OS service, then run `npm run broker`.
6. Run `npm run db:migrate`. Optionally run `npm run db:seed` for 24 h of demo history.
7. In separate terminals, run `npm run dev` and `npm run sim`, then open `http://localhost:3000`.

### Source tree

```text
smart-traffic-light/
  package.json             # workspaces + root scripts: dev, sim, broker, build, start, test, typecheck, lint, db:migrate, db:seed, contracts:schema
  package-lock.json        # S0 owns (AD-13)
  .nvmrc
  tsconfig.base.json
  biome.json
  .gitattributes           # * text=auto eol=lf
  contracts/               # @stl/contracts (AD-4)
    vehicle-classes.json
    schema/                # generated for Squads A and B: one JSON Schema per payload, plus topics.json (AD-4)
    src/mqtt/              # topics.ts (topic table) + one file per payload
    src/api/               # common.ts, breaches.ts, overrides.ts, counts.ts, speed-alerts.ts, stream/ (streamSchemas, sseFrame, one file per event)
  backend/                 # @stl/backend: the Express gateway
    db/migrations/         # dbmate SQL (AD-10)
    db/seed/               # demo seed SQL, applied by npm run db:seed
    src/config.ts
    src/app.ts             # createApp(deps): the Supertest target
    src/index.ts           # composition root and boot order (AD-14)
    src/http/routes/
    src/mqtt/              # client.ts, publisher.ts, handlers/
    src/jobs/
    src/sse/hub.ts
    src/services/          # errors.ts, link.ts, occurred-at.ts, plus one service per slice or resource
    src/db/                # pool.ts, repositories/
    test/                  # reset-db.ts, global-setup.ts
  simulator/               # @stl/simulator (AD-3)
    assets/placeholder-crop.jpg
    src/                   # index.ts, config.ts, repl.ts, controller-role.ts, vision-role.ts, behaviors/, scenarios/
  dashboard/               # @stl/dashboard: static Next.js export (AD-9)
    .env.development
    .env.production
    src/app/               # layout.tsx (shell); page.tsx, traffic/, breaches/, log/overrides/, log/states/ (CAP stories)
    src/components/        # ui/ (shell), <area>/ (CAP stories)
    src/lib/               # config.ts, time.ts, visuals.ts, use-vehicle-classes.ts, live/, api/client.ts, api/<resource>.ts
  edge_vision/             # Squad B, Python (M2): implements contracts/schema, loads contracts/vehicle-classes.json
  firmware/                # Squad A, PlatformIO or Arduino IDE (M2): implements contracts/schema
  infra/
    mosquitto/mosquitto.conf
    mosquitto/compose.conf
    mosquitto/hotspot.conf # M2, CAP-8: all interfaces, password + ACL (AD-15)
    mosquitto/acl          # M2, CAP-8: committed; text in the Structural Seed
    mosquitto/credentials.env # M2: per-user passwords (gitignored)
    mosquitto/passwd       # M2: generated by broker-hotspot.mjs (gitignored)
    mosquitto/data/        # broker persistence (gitignored)
    mysql/create-user.sql
    scripts/broker.mjs
    scripts/broker-hotspot.mjs # M2, CAP-8
    compose.yaml           # optional MySQL 9.7.4 + Mosquitto 2.1.2
  docs/                    # existing sources + setup.md
```

## Capability → Architecture Map

| Capability | Lives in | Governed by |
| --- | --- | --- |
| CAP-1 Simulated telemetry | `simulator/` (roles, behaviors, REPL, scenarios) | AD-3, AD-4, AD-5, AD-12, AD-18 |
| CAP-2 Local telemetry history | the persist handlers and jobs, `services/counts.ts`, `/api/state-changes`, `/log/states/`; the purge job in M2 | AD-5, AD-6, AD-10, AD-19, backend file ownership |
| CAP-3 Live intersection status | `/`, `LiveProvider`, the `state` and `demand` slices | AD-6, AD-8, AD-9, Staleness convention |
| CAP-4 Hourly traffic peaks | `/api/counts/hourly`, `/traffic/` | AD-6, AD-10, AD-12, `HourlyCounts` |
| CAP-5 MDRRMO emergency override | `components/override/` on `/`, `/log/overrides/`, `services/overrides.ts`, the simulator controller role | AD-2, AD-3, AD-7, AD-15 |
| CAP-6 Red-light breach log | `vision-breach.persist.ts`, `/api/breaches`, `/breaches/`, the simulator breach behavior | AD-5, AD-11, AD-19, Privacy convention |
| CAP-7 Live inference video | deferred | AD-17 |
| CAP-8 Live telemetry integration | `edge_vision/` and `firmware/` implement MQTT contract v1; the simulator is stopped; the broker runs in hotspot mode (the hotspot files and the ACL); the countdown, power-source and boot-count components on `/`; the simulator's countdown, power and reboot behaviors | AD-1, AD-3, AD-4, AD-5, AD-14, AD-15, AD-17, AD-18, Countdown convention |
| CAP-9 Violation CSV export | a backend export route (M2) | AD-2, AD-11, AD-19, Privacy convention |
| CAP-10 Speed alert mockup | `vision/speed-alert`; `mqtt/handlers/vision-speed-alert.relay.ts`, `services/speed-alerts.ts`, `components/speed-alert/` on `/`; the simulator's speed-alert behavior and `--speed-alerts` mode | AD-3, AD-4, AD-8, AD-17, Speed alert convention |
| CAP-11 Dashboard polish | `dashboard/` | AD-9, Dashboard visuals and Display target conventions |
| CAP-12, CAP-13 Vision profiling and breach detection | `edge_vision/` (Squad B) | AD-5, AD-11, AD-12, AD-17 |
| CAP-14, CAP-16, CAP-17, CAP-18 Controller behavior | `firmware/` (Squad A), consuming `vision/demand` and `vision/heartbeat` | AD-5, AD-7, AD-17, AD-18 |
| CAP-15 Offline telemetry bridge | Mosquitto plus the serial bridge (M2) | AD-5, AD-17, AD-18 |
| CAP-19 Brownout failover | hardware, plus `power` in `controller/state` and `bootCount` in `controller/status` for the dashboard; the simulator's power and reboot behaviors | AD-4, AD-5, AD-14 |
| CAP-20 Diorama | hardware only; no software contract | none |

**Suggested M1 split for `bmad-ticket`.** File ownership is bound by CAP in the tables above. The grouping into stories is not binding.

1. **S0**, one session: dependencies, tooling, `contracts/`, the initial migration, `infra/` and `docs/setup.md`.
2. **Wave 1, in parallel:** the simulator core (all of CAP-1), the backend core, and the dashboard shell.
3. **Wave 2, in parallel:**
   - CAP-2 + CAP-4: persistence, the state history, the hourly endpoint and chart, and the seed SQL for counts.
   - CAP-3 + CAP-5: the live status view and the override panel, plus the override lifecycle and log.
   - CAP-6: breach ingest, crops and the breach log.

Wave 2 stories need the backend core and the dashboard shell. Each demonstrates against the simulator, or against seed data when a sibling hasn't merged yet.

## Deferred

- **CAP-7 video source** (M2, Squads C and B): choose between a vision-node HTTP stream and an Express pass-through (AD-17) once the vision node emits annotated frames.
- **CAP-9 CSV columns** (M2): Tier 1 fields from `breach_event` only, decided when the story is built. The route is pinned now: `GET /api/exports/breaches.csv`, in `routes/exports.ts`. An exported CSV holds no crops.
- **CAP-11 animation library** (M2): it must stay within AD-9 and the visuals convention.
- **Broker address on the hotspot** (M2, Squads A and C): how the ESP32 finds the laptop's broker when the hotspot hands out addresses, for example a reserved address or mDNS. Settle it in the week-5 integration, before the stress tests.
- **Hotspot setup and venue runbook** (M2, Squad C, in `docs/setup.md` before week 5): credential hand-off to Squads A and B, the inbound firewall rule for port 1883 (Windows `New-NetFirewallRule`, Linux firewalld or ufw), the ACL smoke test, start order, and restart steps if the broker or backend dies mid-pitch.
- **Mirroring fallback check** (M2, team, with the mid-November HDMI check): mirroring is Windows-only in practice; Linux senders are experimental. Test it with the hotspot up and the ESP32 connected, since Miracast shares the laptop's Wi-Fi radio. On a Linux laptop, carry a spare HDMI adapter instead.
- **Full-stack soak test** (M2, before weeks 5–6): 20 minutes with vision at ≥ 15 FPS alongside Mosquitto, Express and MySQL, to test the single-laptop assumption (`risks.md`).
- **Vision node internals** (Squad B): the model, the ROI and virtual-line config, the speed-alert threshold, and how the anonymization in `privacy-compliance.md` is coded.
- **Firmware internals** (Squad A): within AD-5's limits, AD-7's 1 s ack and AD-18's link-drop rule. `degradation-levels.md` settles the timings, the recovery transitions, the latched conflict fault and its reset button, and how an unplugged sensor is detected. Squad A sets the stuck-presence threshold.
- **Python, Ultralytics, Arduino-ESP32 core and esp-mqtt versions** (Squads A and B): pinned in `edge_vision/` and `firmware/`.
- **Serial bridge framing** (CAP-15, Squads A and B): AD-17 fixes only that the bridge is transparent to the backend.
- **Node 26 LTS**: revisit after M1. Node 26 enters Active LTS on 2026-10-28.
- **Mosquitto 3.0**: it removes `password_file` and `acl_file` in favor of plugins. Stay on 2.x through December, or move AD-15's hotspot config to the plugins before upgrading.
- **CI, backups and observability**: none in M1. Quality gates run locally (AD-16), and logs plus `/api/health` cover operations. Revisit before the December demo; at minimum, run `npm run db:backup` (AD-19) before going to the venue.
- **Multiple intersections**: the topic path carries `iid`, but nothing else supports more than one intersection.
