---
title: 'Backend core: MQTT ingest and link health'
type: 'feature'
ticket: '3'
created: '2026-10-23'
status: 'done'
baseline_revision: 'fecb915ca1975fba9f867cc51bea406c1b43d340'
baseline_commit: 'fecb915ca1975fba9f867cc51bea406c1b43d340'
route: 'dispatch'
risk: 'medium'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-1-context.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/architecture-smart-traffic-light/architecture-smart-traffic-light.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The backend has HTTP and SSE (entry 2) but no MQTT side. The `link` slice never leaves its all-offline start value, `/api/health` always reports `broker:false`, and no later story has a handler registry or publisher to extend.

**Approach:** Build the MQTT half of the backend core (entry 3): the `stl-backend` client, the publisher, the fan-out handler registry, `services/link.ts` with its four handlers and watchdog job, the broker flag in `/api/health`, the boot order's MQTT steps, and the 250 ms SSE budget test.

## Boundaries & Constraints

**Always:** Follow AD-4 (parse inbound, log and drop invalid), AD-5 (client identity, liveness, `clean:false`, QoS and retain only from `topics.ts`), AD-8 (`link` is the sole writer of the `link` slice; 250 ms budget), AD-14 (boot order: pool → jobs → handlers → `mqtt.connect` → listen), AD-15 (username = clientId, optional `MQTT_PASSWORD`, `reconnectOnConnackError`), AD-16, and the Topic names, Logging and Privacy conventions. Only `src/mqtt/` imports `mqtt`. Keep entry 2's conventions: route modules `(deps) => Router`, alphabetical registries, `.ts` imports.

**Never:** No CAP handler (`*.slice`, `*.persist`, `*.resolve`), no CAP service, and no override publishing logic (entry 9). No new dependency, no `package.json`, lockfile or contract edit. No test needs a broker. Never log a payload body (crop data).

**Decisions (user, 2026-10-23):**
- Keep the plan as one story (~2,400 tokens).
- Mosquitto: the user installs Mosquitto 2.1.2 natively and stops its Windows service. The live check runs `npm run broker` plus the `mosquitto_pub` demo, which also settles S0's deferred `npm run broker` check.
- Branch: `feat/m1-3-backend-mqtt-link`, stacked on 1.2's branch until PRs #3 and #4 merge.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Boot | no messages yet | `link` controller and vision `OFFLINE`, source/bootCount null | — |
| Broker up / down | client `connect` / `close` | `link.broker` `CONNECTED` / `DISCONNECTED`; health `broker` follows; `ok = db && broker` | — |
| Fresh state | non-retained `controller/state` | controller `ONLINE` | — |
| Fresh heartbeat | non-retained `vision/heartbeat` | vision `ONLINE` | — |
| Retained copy | retained `controller/state` or `status` | never counts as liveness; a retained status only sets `source` / `bootCount` | — |
| Silence | no fresh message for > 5 s (controller) / > 3 s (vision) | role `STALE` | — |
| Graceful offline | non-retained status `online:false` | role `OFFLINE` until the next fresh message | — |
| Status online | non-retained status `online:true` | sets `source` (and controller `bootCount`, null when absent); status unchanged | — |
| Invalid payload | bad JSON or schema failure on a known topic | dropped; `[mqtt]` warn with topic and issue paths, no payload | never crashes, never reaches handlers |
| Handler throws | one of several handlers for a topic | others still run | `[mqtt]` error per message |
| Budget | fresh state dispatched | `link` frame written to SSE within 250 ms of `receivedAt` | — |

</frozen-after-approval>

## Code Map

- `contracts/src/mqtt/topics.ts` -- `topics[name] = {pattern, build(iid), qos, retain, publisherRole, schema}`, plus `TopicName` and `topicNames`. The only source of topic strings, QoS and retain.
- `contracts/src/mqtt/controller-status.ts` (`bootCount` optional), `vision-status.ts`, `vision-heartbeat.ts`, `controller-state.ts` -- the four link inputs.
- `contracts/src/api/stream/link.ts` -- `LinkSlice` (never null).
- `backend/src/sse/hub.ts` -- `initialLink` (move or keep; `link.ts` becomes the writer), `setSlice`, `getSlice`.
- `backend/src/app.ts` `AppDeps`, `backend/src/jobs/index.ts` `JobCtx` -- both say "entry 3 adds `publisher` and `getLink`". `src/app.test.ts` `deps()` must supply them.
- `backend/src/index.ts` -- the comment marks where handlers and `mqtt.connect` go; shutdown must also end the client.
- `backend/src/http/routes/health.ts` -- comment: `ok = db && broker`.
- `backend/src/config.ts`, `backend/.env.example` -- add MQTT keys.
- `node_modules/mqtt` 5.16.1 -- `mqtt.connect(url, {clientId, username, password, clean, keepalive, protocolVersion: 4, reconnectOnConnackError})`; `message` gives `(topic, payload: Buffer, packet)`, with `packet.retain`.
- `infra/mosquitto/mosquitto.conf` -- `127.0.0.1:1883`, anonymous, persistence, `max_queued_messages 0`.
- Scope: work only inside this repo. Ignore the `AGENTS.md` one folder above the repo (`Desktop\AGENTS.md`).
- Machine: Windows, Node 24.15.0, MySQL 8.0.44 with `stl` working, no Mosquitto yet (the user is installing it). Write files with LF line endings: in story 1.2, an edit script produced CRLF.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/config.ts`, `backend/.env.example` -- add `MQTT_URL` (default `mqtt://127.0.0.1:1883`), `INTERSECTION_ID` (default `int-01`, lower snake/kebab id) and optional `MQTT_PASSWORD`.
- [x] `backend/src/services/link.ts` -- `createLink(hub)` holds `broker`, and per role `status`, `source`, `bootCount` and the last fresh time. It exposes `setBroker`, `onStatus(role, payload, retained)`, `onFresh(role, receivedAt, retained)`, `tick(now)` (ONLINE→STALE at 5 s / 3 s) and `get()`. It writes the `link` slice on every real change, and is the only `setSlice('link')` caller.
- [x] `backend/src/mqtt/handlers/controller-status.link.ts`, `vision-status.link.ts`, `controller-state.link.ts`, `vision-heartbeat.link.ts` -- each exports `{topic, handle(payload, ctx)}` and calls the link service. `handlers/index.ts` lists them alphabetically and exports the `Handler`/`HandlerCtx` types. `HandlerCtx` = `{receivedAt, retained, pool, hub, publisher, link, getLink}`.
- [x] `backend/src/mqtt/client.ts` -- `dispatch(topic, payload, retained, deps)` is a pure, broker-free function. It matches the topic against `build(iid)`, stamps `receivedAt`, parses JSON and the schema (or warns and drops), then runs every handler for that topic in its own try/catch. `connectMqtt(...)` uses AD-5/AD-15's options, subscribes to every topic at its table QoS on each connect, reports `connect`/`close` to `setBroker`, and logs `error` (a refused CONNACK included) as `[mqtt]`.
- [x] `backend/src/mqtt/publisher.ts` -- `createPublisher(client, iid)`. `publish(name, payload)` is limited to `publisherRole: 'gateway'` topics, parses the payload with its schema, and uses the table's QoS and retain.
- [x] `backend/src/jobs/link-watchdog.ts` + `jobs/index.ts` line -- `start(ctx)` runs `tick` every 500 ms; `stop()` clears it.
- [x] `backend/src/app.ts` `AppDeps`, `jobs/index.ts` `JobCtx`, `http/routes/health.ts` -- add `publisher` and `getLink` (and `link` to `JobCtx`); health reports `broker = getLink().broker === 'CONNECTED'` and `ok = db && broker`.
- [x] `backend/src/index.ts` -- create the link, the client (not yet connected) and the publisher; start the jobs; register the handlers; connect; listen. Shutdown also ends the client.
- [x] Tests -- the link service (every matrix row, fake timers), `dispatch` (invalid payloads, handler isolation, retained flag), the publisher (QoS/retain from the table, refuses an invalid payload), health with the broker up and down, and the 250 ms budget (fresh state through `dispatch` to a fake SSE client). No broker anywhere.

**Acceptance Criteria:**
- Given MySQL and Mosquitto up, when the backend runs and `mosquitto_pub` sends non-retained controller state, vision heartbeats and status messages, then `/api/stream`'s `link` moves each role through ONLINE, STALE (5 s / 3 s) and OFFLINE, and `/api/health` shows `broker:true`.
- Given an invalid payload is published, when the backend receives it, then it is logged without its body and dropped, and the process keeps running.
- When `npm run typecheck`, `npm run lint` and `npm test` run, then all exit 0.

## Implementation Notes

- `receivedAt` is epoch ms (`Date.now()`) in `HandlerCtx`; later stories convert it to ISO for SSE/DB.
- `dispatch` parses every known topic even when no handler is registered yet, so an invalid payload is always warned about. It logs only the topic and zod issue paths, never the body or the JSON parse message (which echoes input).
- The client is created with MQTT.js `manualConnect: true`, so the publisher exists before jobs start; `connectMqtt` attaches the listeners (handler registration) and then calls `client.connect()`.
- `initialLink` stays in `sse/hub.ts` (hub tests use it); `services/link.ts` starts from it and is the only `setSlice("link")` caller. It skips a write only when the slice is unchanged (a no-op `tick`/`setBroker`).
- While the broker is down MQTT.js retries every 1 s and each failure logs `[mqtt] error: connect ECONNREFUSED`.
- Verified: `npm run typecheck`, `npm run lint`, `npm test` exit 0 (backend 46 tests). Boot smoke without a broker: listens, `/api/health` = `{ok:false,db:true,broker:false}`, `/api/stream` sends the offline `link`.
- **Live acceptance check, run by the orchestrator** (Windows; Mosquitto 2.1.2 installed with winget, its Windows service stopped and set to Manual):
  - `npm run broker` starts the native broker on `127.0.0.1:1883` from `infra/mosquitto/mosquitto.conf`. This settles S0's deferred `npm run broker` item on Windows; Linux is still unchecked.
  - With the backend up, `/api/health` returned `{"ok":true,"db":true,"broker":true}`. After the broker stopped it returned `{"ok":false,"db":true,"broker":false}`.
  - A timestamped `/api/stream` watcher saw these transitions:
    - controller ONLINE on a fresh state, then STALE 5.0 s later;
    - vision ONLINE on a heartbeat, then STALE 3.4 s later (with the 500 ms tick);
    - controller OFFLINE, then vision OFFLINE, on a non-retained `online:false`.
  - Invalid JSON on `vision/breach` was logged as `[mqtt] dropped …: invalid JSON`, without the body, and the process kept running.
- **Observed:**
  - A `mosquitto_pub -r` sent to an already-subscribed backend arrives with retain=0, as MQTT 3.1.1 specifies, so it rightly counts as fresh. Only copies delivered on subscribe carry the flag.
  - Clearing a retained topic (a zero-length payload) logs `invalid JSON`.
  - Each `mosquitto_pub` call takes about 2 s on this machine.
- **Windows:** stopping a background `npm run broker` / `tsx` task leaves the child `mosquitto.exe` / `node.exe` running. They had to be stopped by PID.

## Spec Change Log

## Review Triage Log

### Pass 1 (blind, edge-case and verification-gap lenses, loop 0)

Verdicts: high 0, medium 1, low 5, false 4, plus 3 pre-verified gaps; 9 rejected as low. Layers: B = blind, E = edge case, V = verification gap.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | B, E: `publish` while the broker is down queues the override | medium | patch | MQTT.js keeps QoS 1 publishes in its offline queue and sends them on reconnect. A broker drop doesn't make the controller STALE for up to 5 s, so entry 9's `ONLINE` check can pass and the command is applied late. Patch: `publish` throws when `!client.connected`. |
| 2 | B, E: the backend subscribes to its own `controller/override/cmd` | low | patch | `subscriptions` covers every topic in `topicNames`, so with MQTT 3.1.1 (no `noLocal`) each command echoes back into `dispatch`, and `clean:false` queues those echoes while the backend is down. The topic table lists only the controller as subscriber. Patch: drop `publisherRole: 'gateway'` topics from the subscription map. |
| 3 | B, E: shutdown can wait on `endAsync()` | low | patch | Without `force`, `end` waits for in-flight QoS 1 messages; with the broker down that can stall `server.close` and `pool.end`. Patch: `endAsync(true)`. |
| 4 | E: a zero-length retained clear logs "invalid JSON" | low | patch | Seen in the live run, from clearing the retained test state. Patch: return silently when `payload.length === 0`. |
| 5 | E: an empty `MQTT_PASSWORD=` fails boot | low | patch | `.env.example` shows `# MQTT_PASSWORD=`; uncommenting it gives `''`, which `min(1)` rejects. Patch: treat an empty string as unset. |
| 6 | B, E: `MQTT_URL` accepts any scheme | low | patch | `z.url()` passes `http://`, and the failure then surfaces inside MQTT.js. Patch: restrict the protocol to `mqtt`, `mqtts`, `ws` or `wss`. |
| 7 | V: three link handlers untested through the registry | gap | patch | Pre-verified: `vision-heartbeat`, `controller-status` and `vision-status` could target the wrong role or ignore `retained` with all tests green. Patch: a table-driven `dispatch` test over the real registry. |
| 8 | V, B: `connectMqtt` wiring is untested | gap | patch | Pre-verified: dropping the `close` listener, passing `false` for `packet.retain`, or using the wrong QoS all pass. Patch: a fake-client test for connect, close, subscriptions (also covering row 2) and the retain flag. |
| 9 | V, B: the link watchdog is untested | gap | patch | Pre-verified: removing it from `jobs` or breaking `start`/`stop` passes. Patch: a fake-timer test. |
| 10 | B, E: a refused subscription (granted 128) goes unnoticed | low | reject | M1's broker is anonymous, and the M2 ACL grants `stl-backend` read on `stl/#`. Unlikely, and the fix adds a branch. |
| 11 | B: `onStatus` casts instead of tying the payload to the role | low | reject | Only the two status handlers call it, each with its own role. An overload refactor costs more than the risk. |
| 12 | B: the topic is looked up per message | low | reject | 10 topics at a few messages a second; a lookup `Map` adds state. |
| 13 | B: the 250 ms test can't fail | false | reject | It measures the real in-process path from `dispatch` to the SSE write, and would fail if a writer deferred or throttled the frame past 250 ms. That is what AD-8 asks one test to assert. |
| 14 | B, E: docs and two `stl-backend` instances kicking each other | low | reject | Two dev backends on one broker is unlikely, tests never connect MQTT, and `docs/setup.md` belongs to entry 1. |
| 15 | E: wall-clock jumps break STALE timing | low | reject | A laptop with a stable clock; switching to a monotonic clock adds code. |
| 16 | E: `link` caches the slice before `setSlice` succeeds | false | reject | `link` builds every value from contract enums and parsed payloads, so `setSlice` can't drop or throw on it. |
| 17 | E: a queued `vision/status online:false` replays after a restart | low | reject | It marks vision OFFLINE for at most 1 s, until the next 1 Hz heartbeat. |
| 18 | E: watchdog `start` twice leaks a timer | false | reject | `index.ts` calls each job's `start` exactly once. |
| 19 | E: `link` is the sole `setSlice('link')` caller | false | reject | The reviewer confirmed the claim; no defect. |

**Patches applied** by the implementer, rows 1–9:
- `publish` throws while disconnected;
- gateway topics are left out of the subscriptions;
- `endAsync(true)`;
- empty payloads are skipped silently;
- an empty `MQTT_PASSWORD` counts as unset, and `MQTT_URL` accepts only `mqtt`, `mqtts`, `ws` or `wss`;
- tests for the registry handlers, `connectMqtt` with a fake client, the watchdog with fake timers, and the disconnected publisher.

**Re-verified by the orchestrator:**
- `typecheck` and `lint` exit 0. `npm test`: contracts 174/174, backend 56/56. No CRLF.
- Live, with Mosquitto 2.1.2 from `infra/mosquitto/mosquitto.conf`:
  - health reported `broker:true`, then `broker:false` after the broker was killed;
  - a `vision/heartbeat` turned vision ONLINE;
  - a zero-length retained clear logged nothing;
  - a published `controller/override/cmd` never reached the backend.
- Both processes were stopped by PID, and ports 4000 and 1883 are free.

## Design Notes

- **`retained` in `HandlerCtx`:** this extends AD-16's ctx list. Liveness (AD-5) and entry 8's state slice (the SSE table) both need the retain flag, and no other channel carries it.
- **Link as a factory, carried in `ctx`:** `createLink(hub)` keeps tests isolated. `index.ts` builds the one instance. `HandlerCtx` and `JobCtx` carry it as `link`, which the four link handlers and the watchdog call, plus `getLink = link.get`. The link service is backend core, so this stays within AD-16's core-dependencies rule. CAP stories read only `getLink`.
- **Broker loss** leaves roles as they are. The watchdog turns them `STALE`, because no fresh messages arrive.
- **Subscribe each connect:** with `clean:false` the session keeps the subscriptions, but resubscribing is harmless and covers a broker that lost its session.
