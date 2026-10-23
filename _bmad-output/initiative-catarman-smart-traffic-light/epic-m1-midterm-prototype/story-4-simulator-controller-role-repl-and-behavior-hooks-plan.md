---
title: 'Simulator: controller role, REPL and behavior hooks'
type: 'feature'
ticket: '4'
created: '2026-10-23'
status: 'done'
baseline_revision: 'fffe215bb4300809065f485deffb82f42800e421'
baseline_commit: 'd6bd2319a527b59af7f4568ed6c9bbc982fb2a3c'
route: 'dispatch'
risk: 'medium'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-1-context.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/spec-smart-traffic-light/degradation-levels.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `simulator/` has only its `package.json`. Without an ESP32, nothing publishes `controller/status` or `controller/state` or answers override commands, so CAP-1 (live signal state) and CAP-5 (override) have no source.

**Approach:** Build entry 4: the `stl-sim-controller` MQTT link, a broker-free controller state machine (NS/EW cycle, L1–L4, latched conflict fault, AD-7 overrides, AD-18 link-drop rule), the start check with `--force` and `--roles`, a terminal REPL, `config.ts` and `.env.example`, and the empty `behaviors/` and `scenarios/` registries.

## Boundaries & Constraints

**Always:**
- Shapes, topic strings, QoS and retain come only from `@stl/contracts` (AD-4, AD-5).
- Parse inbound messages with their schemas; log and drop invalid ones, never crash.
- Link: clientId = username = `stl-sim-controller`, optional `MQTT_PASSWORD`, `clean: true`, keepalive 5, `protocolVersion: 4`.
- LWT is a retained `{v:1, online:false, source:"sim"}`. Retained `online:true` goes out on connect and again 10 s later. Before any graceful exit, publish a retained `online:false`.
- `controller/state` is published on every change and at least every 2 s, and again on reconnect. Signaling never waits on the broker, the backend, a retained topic or an ack (AD-18).
- Consume only `vision/heartbeat` and `controller/override/cmd`; `controller/state` is read only during the start check.
- Only `src/config.ts` reads `process.env`. Logs use the `[sim]` prefix and never contain a payload body. Use `.ts` imports, lower-kebab-case filenames and LF line endings.
- Tests are Vitest functions of state and input, with no broker.

**Never:**
- No vision role, demo scenario or `emit-breach` (entry 5).
- No M2 fields or behaviors: `remainingS`, `power`, `bootCount`, reboot, speed alerts, `--speed-alerts`.
- No new dependency, no `package.json` or lockfile edit, no contract edit. No edits outside entry 4's files (epic File ownership).

**Decisions (agent, from the spine):**
- Green is a fixed 10 s in L1, L2 and L3; AD-3 allows that for M1. Yellow is 3 s and all-red 2 s. Levels change only what is reported.
- The automatic level is L4 when `flood` is `FLOODED`, else L3 when the sensor fault is up, else L2 when vision is unhealthy, else L1. Vision is unhealthy when no `ok:true` heartbeat has arrived in the last 3 s, so a lone controller runs at L2. Dropping a level is immediate. Climbing needs the cause clear for 5 s and takes effect at the next all-red.
- REPL `level <L1–L4>` forces the reported level, and `level auto` returns to automatic. A forced L4 flashes like a real one.
- `--roles` accepts `controller|vision|both` (default `both`). Until entry 5 lands, `vision` exits with an error and `both` starts only the controller, with a `[sim]` warning.
- The start check runs on the role's own link after the first connect. If a non-retained `controller/state` arrives within 5 s, the simulator exits with code 1. `--force` skips the check, and on the first connect publishes a zero-length retained `controller/status` (clearing it) before its own `online:true`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cycle | normal | NS G 10 → Y 3 → all-red 2 → EW G 10 → Y 3 → all-red 2; the opposing phase is RED throughout | — |
| Vision loss | no `ok:true` heartbeat for 3 s | L2 at once; back to L1 at the first all-red after 5 s healthy | retained heartbeats ignored |
| Sensor fault | `sensor fault` | L3 at once; `sensor ok` climbs back after 5 s, at all-red | — |
| Flood | `flood on` | `flood` WET, then FLOODED and L4 (both FLASHING_AMBER) after 5 s; `flood off` stays FLOODED until 30 s dry, then DRY and resumes at all-red | wet < 5 s → back to DRY, no L4 |
| Conflict fault | `conflict raise` | `fault:true`, both FLASHING_AMBER, level unchanged; latched until `conflict reset`, then resumes at all-red | — |
| CORRIDOR | cmd `CORRIDOR` `EW`, no fault | ack APPLIED within 1 s; `override` `{CORRIDOR, EW, id}` at once; any NS green runs yellow and all-red first, then EW holds green | — |
| CORRIDOR in fault | cmd `CORRIDOR` while `fault` | ack REJECTED `CONFLICT_FAULT`; state unchanged | — |
| FLASHING_AMBER | cmd `FLASHING_AMBER` (fault or not) | APPLIED; both FLASHING_AMBER; outranks L1–L4; survives a fault reset | — |
| Release | cmd `NONE` | APPLIED; `override` `{NONE, id}` at once; a corridor goes through yellow and all-red, flashing goes through all-red, then automatic | — |
| Fault ends corridor | `conflict raise` while CORRIDOR | `override` `{NONE, corridor id}`; the corridor doesn't resume after reset | — |
| Link drop | broker lost while CORRIDOR | after 60 s lost, `override` `{NONE, corridor id}`, then yellow, all-red and automatic; a reconnect before 60 s changes nothing; FLASHING_AMBER holds | cycling never stops |
| Invalid cmd | bad JSON or schema | dropped, `[sim]` warn with topic and issue paths | no ack, no crash |
| Start check | live `controller/state` within 5 s | `[sim]` error, exit 1, nothing published | `--force` skips |

</frozen-after-approval>

## Code Map

- `contracts/src/mqtt/topics.ts` -- `topics[name].{build(iid), qos, retain, schema}`. Use it for every publish and subscribe.
- `contracts/src/mqtt/controller-state.ts` (`ControllerState`, `StateOverride`), `controller-status.ts`, `controller-override-cmd.ts`, `controller-override-ack.ts`, `vision-heartbeat.ts`; `enums.ts` (`Level`, `Aspect`, `Flood`, `Phase`).
- `backend/src/config.ts` and `backend/.env.example` on branch `feat/m1-3-backend-mqtt-link` -- copy the pattern: `process.loadEnvFile` ignoring ENOENT and skipped under `VITEST`, zod `Env`, `MQTT_URL` limited to `mqtt|mqtts|ws|wss`, `INTERSECTION_ID` regex with default `int-01`, empty `MQTT_PASSWORD` treated as unset.
- `backend/src/mqtt/client.ts` on that branch -- the parse-and-drop pattern: skip a zero-length payload, then JSON, then `safeParse`, then a warn with issue paths only.
- `simulator/package.json` -- `sim: tsx src/index.ts`; deps `mqtt` 5.16.1, `zod`, `@stl/contracts`. `vitest.config.ts` includes `src/**/*.test.ts` and `test/**`.
- `node:util` `parseArgs` for the CLI, `node:readline` for the REPL, `crypto.randomUUID` (not needed in M1, since commands carry their own ids).
- MQTT.js: pass `queueQoSZero: false` and publish only while `client.connected`, so stale states don't pile up while offline. `will: {topic, payload, qos, retain}` comes from the topic table.
- Story 1.3's lesson: a retained publish to an already-subscribed client arrives with `retain=0`, so the start check sees another live controller as non-retained.
- Machine: Windows, Mosquitto 2.1.2 native through `npm run broker`. Stopping background tasks leaves `mosquitto.exe` and `node.exe` running; kill them by PID.

## Tasks & Acceptance

**Execution:**
- [x] `simulator/src/config.ts`, `simulator/.env.example` -- `MQTT_URL`, `INTERSECTION_ID`, and optional `MQTT_PASSWORD` (shared by the sim users, AD-15).
- [x] `simulator/src/controller-role.ts` -- `createController(now)`: a pure core holding the interval (`GREEN|YELLOW|ALL_RED|FLASH`, phase, `endsAt`), inputs (heartbeat time, sensor fault, flood edges, conflict fault, forced level, link-lost time) and the override. It exposes `step(now)`, `onHeartbeat(hb, retained, now)`, `onCommand(cmd, now) → ack`, REPL setters, `setLinkUp(up, now)` and `state()` (a `ControllerState` with behavior fields merged in). Also `startControllerRole({config, force, behaviors})`, which runs the MQTT wiring, a 100 ms `step` timer, change-or-2 s publishing, status publishing and the LWT, and returns `{controller, stop()}`.
- [x] `simulator/src/behaviors/index.ts` -- `Behavior = {name, state?(s), status?(s), commands?}` and `behaviors: Behavior[] = []`, with alphabetical registration lines (AD-14). Controller payloads merge `state`/`status` extras; the REPL registers `commands`.
- [x] `simulator/src/scenarios/index.ts` -- `Scenario = {name, steps: {atS, line}[]}` and `scenarios: Record<string, Scenario> = {}`. Each step's `line` runs through the REPL command parser (entry 5 adds `demo`).
- [x] `simulator/src/repl.ts` -- `runCommand(line, ctx)` (pure, testable) for `level L1-L4|auto`, `flood on|off`, `sensor fault|ok`, `conflict raise|reset`, `state`, `help` and `quit`, plus behavior commands. Also `startRepl(ctx)` over `readline` and `runScenario(s, ctx)`.
- [x] `simulator/src/index.ts` -- `parseArgs` for `--roles`, `--force` and `--scenario`; the start check; start the role and the REPL (or a scenario). On `quit`, SIGINT or SIGTERM: retained `online:false`, then `end`.
- [x] Tests (`controller-role.test.ts`, `repl.test.ts`) -- every matrix row against the pure core with explicit `now` values, plus `runCommand` dispatch and unknown commands. No broker.

**Acceptance Criteria:**
- Given only the broker is up, when `npm run sim -- --roles controller` runs, then `mosquitto_sub -v -t 'stl/int-01/controller/#'` shows `status` online and `state` at least every 2 s cycling NS/EW.
- Given that run, when `sensor fault` then `flood on` are typed, then `state` shows L3, then L4 with FLASHING_AMBER about 5 s later. `conflict raise` latches FAULT until `conflict reset`.
- Given that run, when `mosquitto_pub` sends a valid `CORRIDOR` cmd, then the ack is APPLIED. During a fault, it is REJECTED `CONFLICT_FAULT`.
- Given that run, when the broker restarts, then cycling continues (seen in `state`) and `status` and `state` republish on reconnect.
- Given a second `npm run sim -- --roles controller` while the first runs, then it exits 1 without `--force`.
- When `npm run typecheck`, `npm run lint` and `npm test` run, then all exit 0.

## Implementation Notes

- **Start check, same clientId:** both instances use `stl-sim-controller`, so the newcomer's connect takes over the live one's session and the live one's reconnect kicks the newcomer back; the newcomer never sees a non-retained `state` while connected. The check therefore also fails when the link closes during the 5 s window. Side effect (broker-side, unavoidable with a shared clientId): each takeover fires the kicked client's LWT, so `status` flickers `online:false` once before the live controller republishes `online:true` on its reconnect.
- **Corridor vs L4:** a CORRIDOR outranks L4 (AD-7, degradation-levels.md "L4 included"); the first Design Notes draft had it backwards and was corrected.
- **Start check test:** `controller-role.test.ts` drives `startControllerRole` through a mocked `mqtt` client (no broker): a live non-retained state exits 1 with nothing published; 5 s quiet goes online; `--force` clears the retained status first.
- **Link:** `reconnectOnConnackError: true`, as AD-15's gate fixes require for every simulator link.
- **Commands during the start check** are ignored (no ack), so a second instance never double-acks.
- **Demo run (2026-10-23, Mosquitto 2.1.2 native):** `npm run broker`; `mosquitto_sub -v -t 'stl/int-01/controller/#'`; `npm run sim -- --roles controller` → status online, state every ~2 s cycling NS/EW at L2. Typed `sensor fault` → L3, `flood on` → WET then L4 FLASHING_AMBER ~5 s later; `conflict raise` → `fault:true` until `conflict reset`. `mosquitto_pub` CORRIDOR EW during the fault → ack REJECTED `CONFLICT_FAULT`; after reset → APPLIED. `{bad` → `[sim] dropped ...: invalid JSON`. Second `npm run sim -- --roles controller` → exit 1. Broker killed and restarted → cycling continued, status and state republished on reconnect. `--force` → online and state at once. `--roles vision`, `--roles x`, unknown flags → exit 1.
- **Demo re-run after review fixes (2026-10-23, Mosquitto 2.1.2 native):** one scripted 106 s session — `mosquitto.exe -c infra/mosquitto/mosquitto.conf`, an MQTT.js subscriber on `stl/int-01/controller/#`, `npm run sim -- --roles controller` driven through its REPL, and `mosquitto_pub -q 1` for commands. Seen at the broker: start check passed after 5 s (a leftover retained `state` didn't count); `status` online on connect and 10 s later; NS G10 → Y3 → all-red 2 → EW G at L2. `sensor fault` → L3; `flood on` → WET, L4 FLASHING_AMBER 5 s later. CORRIDOR EW during L4 → ack APPLIED, flash → all-red → EW green held. NONE → ack APPLIED, EW yellow → all-red → FLASHING_AMBER. `{bad` → dropped with a `[sim]` warning, no ack. `conflict raise` → FAULT; CORRIDOR NS → REJECTED `CONFLICT_FAULT`; `conflict reset` → still L4 (flooded). Second instance → "link closed during the start check", exit 1 (status flickered `online:false` twice, then `online:true`). Broker killed 5 s and restarted → reconnected in 0.5 s, status and state republished. `flood off` + `sensor ok` → DRY after 30 s, all-red, cycle resumed at L2. `quit` → retained `online:false`, exit 0. State gaps ≤ 2 s except the outage and three ~3 s gaps that line up with the test driver blocking on `mosquitto_pub`. Signals were flashing (flooded) during the outage, so this run shows recovery after reconnect, not cycling through it; the first run above covers that.

## Spec Change Log

- Design Notes precedence: CORRIDOR now outranks L4, matching AD-7 and degradation-levels.md (found at implementation verification).

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | verification-gap, blind, edge | MQTT wiring untested: cmd→ack (and no ack during the check), heartbeat `packet.retain`, `close`→`setLinkUp(false)`, `stop()` online:false, LWT payload, reconnect republish, the 2 s republish; fake `publish` never calls back; spies restored in-body, not `afterEach` | medium | Only the start check drives `startControllerRole`; deleting any of those lines passes the suite | patch |
| 2 | blind | Releasing a corridor under L4 jumps GREEN→FLASH, skipping yellow and all-red | medium | Matrix row Release: "a corridor goes through yellow and all-red"; `flashing()` turns true the moment the corridor ends; the corridor-vs-L4 test locks it in | patch |
| 3 | edge | Climbing never happens during FLASH or a held corridor green (no ALL_RED), so `level` stays degraded for the whole override or fault | low | `step` climbs only when `interval.kind === "ALL_RED"`; levels change only what is reported, so no green is cut by climbing then | patch |
| 4 | blind, edge | Any link close during the check prints "another controller is live"; the message also claims "--force takes over" | low | `close` → `failStartCheck()` with one message; with a shared clientId, `--force` beside a live instance flaps rather than takes over | patch |
| 5 | verification-gap | `index.ts` CLI validation untested | low | Verified by hand; testing needs the arg parsing pulled out of import-time code | reject |
| 6 | blind | Shared clientId is avoidable with a random suffix | false | AD-5 fixes one clientId per link (`stl-sim-controller`) and allows one controller link at a time | reject |
| 7 | blind | Retained `override/cmd` would be re-applied | low | Contract says commands are never retained (AD-5); only a stray `mosquitto_pub -r` triggers it; fix adds a guard | reject |
| 8 | blind, edge | `Date.now()` instead of a monotonic clock | low | The simulator runs on the demo laptop; a clock step only shifts one interval; fix touches every timer | reject |
| 9 | blind | Scenarios start before the start check passes | low | No scenario exists yet; state set early is still published once online; entry 5 owns `demo` timing | reject |
| 10 | blind, edge | Behavior extras can overwrite core fields; command name clashes are silent; a throwing behavior command crashes | low | The registry is empty; behaviors are in-repo code; fix adds guards | reject |
| 11 | blind, edge | `stop()` can hang if the publish callback never fires | low | `controller/status` is QoS 0 and publish runs only while connected; a second Ctrl+C exits | reject |
| 12 | blind | Leaving L4 skips the 5 s recovery hold | false | L4 has its own 30 s dry hold and exits at an all-red (degradation-levels.md "L4 exits after 30 s dry, at an all-red clearance") | reject |
| 13 | blind, edge | Bad `.env` prints a raw ZodError | low | Same as the backend's `config.ts` pattern the Code Map says to copy | reject |
| 14 | edge | A forced L1–L3 during FLOODED cycles normally | false | Frozen decision: `level` forces the reported level, and a forced L4 flashes like a real one, so the forced level governs | reject |
| 15 | edge | Duplicate QoS 1 command re-applied | false | Re-applying the same command sets the same override; no state changes | reject |
| 16 | edge | `online:true` repeats only once at 10 s | false | Every reconnect re-runs `goOnline`, which republishes and re-arms the 10 s repeat | reject |
| 17 | edge | Non-TTY stdin closes the REPL and quits | false | EOF is Ctrl+D, which the spec says quits; no script runs the simulator without a terminal | reject |
| 18 | edge | Quitting while disconnected leaves a retained `online:true` | false | Nothing can be published without a broker; the backend's link state reads only fresh messages (AD-5) | reject |
| 19 | blind | Stray `</content>` `</invoke>` at the end of this plan | low | Fix edits this spec, so not a review patch; removed as housekeeping | reject |

## Design Notes

- **Corridor transition:** the target phase decides the next green. On GREEN(other), set `endsAt = now` (so yellow follows). YELLOW and ALL_RED lead into the corridor phase. On GREEN(target), set `endsAt = Infinity`. Ending a corridor sets `endsAt = now` on that green, so it leaves through yellow and all-red.
- **Leaving FLASH** (fault reset with no flashing override, release, L4 exit) always enters ALL_RED for 2 s, then the next green.
- **Precedence of aspects:** `fault` or a FLASHING_AMBER override → FLASH; else a CORRIDOR target; else L4 → FLASH; else the normal cycle. An override outranks every level, L4 included (AD-7).
