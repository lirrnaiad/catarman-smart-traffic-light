---
title: 'Simulator: vision role and demo scenario'
type: 'feature'
ticket: '5'
created: '2026-10-23'
baseline_commit: 'f9e27a4541f96415279d0a6a8e2b6f8ec2dd3b82'
status: 'done'
route: 'dispatch'
risk: 'low'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-1-context.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-4-simulator-controller-role-repl-and-behavior-hooks-plan.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Only the controller role exists, so nothing publishes `vision/*`. The controller sits at L2, and CAP-1's counts, demand and breaches have no source. The M1 demo also needs `npm run sim -- --scenario demo` to walk L1 → L4 without anyone typing.

**Approach:** Build entry 5:
- the `stl-sim-vision` link with status, LWT and its own 3 s start check;
- a vision core with no broker in it: a 1 Hz heartbeat, simulated traffic per approach that drives `vision/demand` PCU and `vision/counts`, and `vision/breach` with the bundled placeholder crop;
- the REPL commands `emit-breach` and `vision stop|start`;
- `--roles vision|both`;
- the `demo` scenario.

## Boundaries & Constraints

**Always:**
- Story 4's link rules apply to the vision link too:
  - shapes, QoS and retain come only from `@stl/contracts`;
  - `clean: true`, keepalive 5, `protocolVersion: 4`, `reconnectOnConnackError: true`, clientId and username both `stl-sim-vision`, optional `MQTT_PASSWORD`;
  - logs use `[sim]` and never include a payload body;
  - only `config.ts` reads `process.env`.
- Vision status: retained LWT `{v:1, online:false, source:"sim"}`; retained `online:true` on connect and again 10 s later; retained `online:false` before any graceful disconnect, including `vision stop`.
- Start check (AD-3): a non-retained `vision/heartbeat` within 3 s, or the link closing in that window, exits 1 before anything is published. `--force` skips the check and publishes a zero-length retained `vision/status` before its own `online:true`. `vision start` after a `vision stop` skips the check.
- The vision link subscribes only to `vision/heartbeat`, and only during the check (the AD-15 ACL for `stl-sim-vision` reads nothing else).
- Each heartbeat: `seq` +1, `ok: true`, `confidence` 0.9, `fps` 15, `ts` = now.
- PCU weights come only from `contracts/vehicle-classes.json` (AD-12). Every `vision/counts` and `vision/breach` carries a new `crypto.randomUUID()`.
- `vision/counts`: at most once per second, crossings since the last message summed per approach and class pair, nothing sent when there were none.
- `vision/demand`: per approach, the sum of the PCU of the vehicles waiting in that approach's ROI. Published on change, throttled on the leading edge: publish at once, then hold further changes for 100 ms (AD-17).
- The breach crop is `simulator/assets/placeholder-crop.jpg`, sent as `{mime:"image/jpeg", data:<base64>}`: a baseline JPEG with no EXIF, at most 64 px on its long side.
- Tests are Vitest with no broker. Inject the randomness so traffic is deterministic in tests.

**Never:**
- No speed alerts, `--speed-alerts`, `remainingS`, `power` or `bootCount`.
- No new dependency and no `package.json`, lockfile or contract edits.
- No edits to `controller-role.ts`, `behaviors/index.ts` or `config.ts`. Import from them freely.

**Decisions (user, 2026-10-23):**
- Traffic follows the signals. Each approach's vehicles queue in its ROI while its aspect is RED or YELLOW and leave one every 1.5 s on GREEN, or one every 3 s on FLASHING_AMBER. The vision role reads the in-process controller's `state().signals` for this, because the ACL lets `stl-sim-vision` read only `vision/heartbeat`. With no controller in the process, every approach drains at one every 3 s.
- `--scenario demo` runs once and holds at L4. The REPL stays open throughout, with or without a scenario.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Heartbeat | vision online | `vision/heartbeat` every 1 s, `seq` 0, 1, 2… | — |
| Demand | a vehicle enters or leaves an ROI | `vision/demand` at once with the new sums; a second change within 100 ms goes out 100 ms after the first; no change means no publish | — |
| Counts | 3 cars and 1 motorcycle left N in the last second | one `vision/counts` with `{N,car,3}` and `{N,motorcycle,1}` | none crossed → nothing sent |
| emit-breach | `emit-breach`, `emit-breach E`, `emit-breach E tricycle` | a schema-valid `vision/breach`: new id, `ts`, centroid in [0,1], the placeholder crop; approach and class random unless given | bad approach or unknown class → usage text, nothing sent |
| Vision stop | `vision stop` | retained `online:false`, heartbeats stop, link ends; the controller reports L2 within 3 s | already stopped → message only |
| Vision start | `vision start` after a stop | reconnects, `online:true`, heartbeats resume; back to L1 at an all-red after 5 s | already running → message only |
| Start check | live non-retained heartbeat within 3 s, or the link closes in that window | `[sim]` error, exit 1, nothing published | `--force` skips it |
| One role | `--roles controller` or `--roles vision` | the absent role's REPL commands answer "<role> role not running"; vision-only traffic drains at 1 every 3 s | — |
| Demo | `--scenario demo` | unattended: L1 with at least two breaches, then L2 (`vision stop`), L3 (`sensor fault`), L4 (`flood on`); it then holds at L4 | — |
| Traffic | NS GREEN, EW RED | N and S queues drain one every 1.5 s, while E and W queues only grow | — |

</frozen-after-approval>

## Code Map

- `simulator/src/controller-role.ts` (story 4, read only):
  - `parsePayload` for the heartbeat during the check;
  - `startControllerRole`, the pattern to copy: link options, LWT, `goOnline` with the 10 s repeat, the start check that also fails on close, `stop()`;
  - `Controller.state().signals` (`NS`/`EW`) maps to approaches N,S and E,W.
- `simulator/src/repl.ts`:
  - `ReplCtx` gains optional `controller` and `vision`;
  - `runCommand` adds `emit-breach`, `vision stop|start` and the "role not running" answers;
  - HELP lists them;
  - `runScenario` runs alongside `startRepl` (the REPL stays open).
- `simulator/src/index.ts`:
  - drop the "vision not available yet" shortcut;
  - start the roles that `--roles` picks;
  - quit stops both roles (each publishes `online:false`), then exits.
- `simulator/src/scenarios/index.ts`: add one alphabetical line, `demo`.
- `simulator/src/controller-role.test.ts`: copy its `vi.mock("mqtt")` fake-client pattern for the vision wiring tests.
- `contracts/src/mqtt/vision-{heartbeat,demand,counts,breach,status}.ts`, `topics.ts`: `vision/status` and `vision/counts` are QoS 1, the others QoS 0. `@stl/contracts/vehicle-classes.json` is exported.
- Scenario timing: steps run from process start. The controller's check takes 5 s and the vision check 3 s, so the first step comes at `atS` ≥ 8. L1 needs 5 s of healthy heartbeats and then an all-red, which takes up to about 20 s.
- Making the asset: no image library is installed. Generate it once with Windows PowerShell 5.1's `System.Drawing`:
  - draw a soft grey shape on 64×48, blur it by downscaling and then upscaling, and save as JPEG;
  - check the markers (SOI, then APP0 JFIF, no APP1, SOF0 at 64×48 or smaller);
  - commit the `.jpg`. `.gitattributes` is `* text=auto`, which treats a file with NUL bytes as binary.

## Tasks & Acceptance

**Execution:**
- [x] `simulator/assets/placeholder-crop.jpg` -- generate and commit it as described in the Code Map.
- [x] `simulator/src/vision-role.ts`:
  - `createVision(now, {rand, classes})`: the pure core, with `step(t, signals?)`, `heartbeat(t)`, `demand()`, `takeCounts(t)` and `breach(t, approach?, vehicleClass?)`;
  - `startVisionRole({config, force, controller?})`: the link, start check, timers (step 100 ms, heartbeat 1 s, counts 1 s, demand throttle) and status. It returns `{vision, stop(), start()}`.
- [x] `simulator/src/scenarios/demo.ts` and its registration line -- the demo steps (see the Demo row).
- [x] `simulator/src/repl.ts`, `simulator/src/index.ts` -- the Code Map changes.
- [x] `simulator/src/vision-role.test.ts` and additions to `repl.test.ts`:
  - every matrix row, using fake timers and the mocked `mqtt`;
  - the asset file is a baseline JPEG with no APP1 and a long side of 64 px or less;
  - every demo line runs through `runCommand` without a usage or "unknown" answer.

**Acceptance Criteria:**
- Given the broker is up, when `npm run sim` runs, then a `stl/#` subscriber sees both statuses online and heartbeats at 1 Hz, and the controller reaches L1. It also sees demand, counts and, after `emit-breach`, a breach with a crop.
- Given that run, when `vision stop` is typed, then a retained `vision/status` `online:false` arrives and the controller reports L2 within 3 s.
- When `npm run sim -- --scenario demo` runs, then it reaches L4 with no input, emitting at least two breaches on the way.
- When `npm run typecheck`, `npm run lint` and `npm test` run, then all exit 0.

## Implementation Notes

- **Role API:** `startVisionRole` returns `{vision, running(), emitBreach(approach?, class?), stop(), start()}`. `running()` and `emitBreach()` are additions: the REPL needs to know the state for "already stopped/running", and a breach must be published on the role's link.
- **Traffic model:** each approach gets an arrival with chance `dt / 6 s` per step (class uniform over `vehicle-classes.json`), capped at 12 queued. The first vehicle leaves one interval (1.5 s or 3 s) after its approach can move with a queue present. One `rand()` draw per approach per step picks both arrival and class, so tests script traffic exactly.
- **Demand throttle:** the 100 ms step tick flushes demand right after stepping. A change inside the 100 ms hold is deferred to the end of the hold by a timer. The first demand goes out on going online (zeros or the current queues).
- **Counts while stopped:** traffic keeps moving after `vision stop`, but the crossings seen while stopped are dropped when it comes back online. A stopped node detects nothing.
- **Start check, same clientId:** as in story 4, a second vision instance is kicked by the live one's reconnect, so it fails on "link closed during the vision start check". Each takeover fires an LWT, so `vision/status` flickers `online:false` before the live node republishes `online:true`.
- **Asset:** `simulator/assets/placeholder-crop.jpg` is 898 bytes, 64x48, made with `System.Drawing` (grey ellipse, scaled down to 8x6 and back up, quality 75). Its markers are SOI, APP0 JFIF, DQT x2, SOF0 64x48, DHT x4, SOS, with no APP1.
- **Demo timing:** `state` @22, `emit-breach` @24, `emit-breach E tricycle` @28, `vision stop` @32, `state` @37, `sensor fault` @42, `flood on` @52, `state` @60.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | verification-gap, blind | Broker reconnect (the `!firstConnect` branch) is untested | medium | Deleting `goOnline()` there passes every test; the code is right today | patch |
| 2 | verification-gap, blind | Dropping crossings seen while stopped is untested | low | Removing `vision.takeCounts` from `goOnline` passes every test | patch |
| 3 | verification-gap, blind, edge | `--scenario` with closed or non-TTY stdin quits at once | medium | `startRepl` always runs and its `close` calls `quit`; before this story, scenario mode never read stdin | patch |
| 4 | blind, edge | Counts are taken and discarded while the link is down | medium | The 1 s interval calls `takeCounts` without checking `online`, and `publish` drops the result; QoS 1 counts are lost in every broker blip | patch |
| 5 | blind, edge | `emit-breach` class is case-sensitive; `vision stop extra` is accepted | low | Approach is upper-cased but the class isn't; `vision` ignores extra args while `emit-breach` rejects them; both fixes are direct | patch |
| 6 | verification-gap | `index.ts` role wiring is untested | low | Covered by the manual Mosquitto run; testing needs import-time code pulled out | reject |
| 7 | blind | Heartbeat `seq` advances while offline | false | A gap in `seq` correctly reflects beats that weren't delivered; the controller doesn't read `seq` | reject |
| 8 | blind | `stop()` can hang waiting for the PUBACK | low | Needs the broker to die between the publish and its ack; a second Ctrl+C exits; fix adds a timeout | reject |
| 9 | blind | `vision stop` during the 3 s check, then `start`, skips the check | low | Needs a stop typed within 3 s of launch beside a live node; fix adds state | reject |
| 10 | blind, edge | The 100 ms traffic tick is never cleared | low | Every exit path ends the process; no in-process host exists | reject |
| 11 | blind | Spec drift (`running()`, `emitBreach()`) isn't in the Spec Change Log | low | Recorded in Implementation Notes; fix edits this spec | reject |
| 12 | blind | Demo timing test is loose and the demo never runs `vision start` | low | Frozen decision: the demo holds at L4; the first-breach-after-20 s check exists | reject |
| 13 | blind | Crop path is resolved from `src/` | false | The simulator runs from source through `tsx` (AD-13); nothing bundles it | reject |
| 14 | edge | DARK aspect treated as red | false | No M1 controller state reports DARK; YELLOW holding is the frozen decision | reject |
| 15 | edge | A failed heartbeat subscribe lets the check pass | low | The local broker is anonymous and the ACL grants that read; same handling as story 4's controller | reject |

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test` -- expected: all exit 0.

**Manual checks:**
- Against Mosquitto, run the acceptance criteria and record the steps here (epic Done rule 4).
- **Run (2026-10-23, Mosquitto native via `npm run broker`):** a scripted driver subscribed to `stl/#` with MQTT.js and fed the sim's stdin. Results:
  - **`npm run sim`:**
    - vision check passed at 3 s (`vision/status` online, heartbeat seq 0, first demand); controller check passed at 5 s;
    - L1 at the first all-red (~13 s after start); `vision/status` repeated 10 s later;
    - counts every ~1 s while vehicles crossed, demand on change;
    - `emit-breach` and `emit-breach E tricycle` each sent a `vision/breach` with an `image/jpeg` crop of 1200 base64 characters; `emit-breach X` printed the usage line;
    - `vision stop` sent a retained `online:false` and the controller reported L2 2.4 s later; a second `vision stop` answered "vision already stopped";
    - `vision start` sent `online:true` with no check, heartbeats resumed, and the controller was back at L1 at the next all-red (~6 s); a second `vision start` answered "vision already running";
    - `quit` sent both statuses `online:false` and exited 0; 48 heartbeats over 48 online seconds.
  - **`npm run sim -- --scenario demo`, no input:** L1 at ~13 s; breaches N tricycle (@24) and E tricycle (@28); `vision stop` @32 → L2 at +2.4 s; `sensor fault` @42 → L3; `flood on` @52 → WET, then L4 FLASHING_AMBER FLOODED at ~57 s, held until `quit`.
  - **Second `npm run sim -- --roles vision` while one ran:** "link closed during the vision start check", exit 1. The first instance's status flickered `online:false` twice and then recovered to `online:true`.
- **Re-run after review fixes (2026-10-23, Mosquitto 2.1.2 native, MQTT.js subscriber on `stl/#`):**
  - **`npm run sim`, REPL:** vision online at 3 s, controller at 5 s, L1 at 16 s; `vision/status` repeated 10 s later. `emit-breach E Tricycle` → `breach E tricycle`, a `vision/breach` with a 1,200-character `image/jpeg` crop. `vision stop extra` → usage. Broker killed 5 s and restarted → both links reconnected in 0.5 s, `vision/status` `online:true`, heartbeats resumed with `seq` 23 → 29; the controller dropped to L2 and climbed back to L1 at the next all-red (46.4 s). `vision stop` → `online:false`; L2 2.9 s later. `vision start` → `online:true`, back to L1 9.3 s later. `quit` → both statuses `online:false`, exit 0. 58 heartbeats, 21 counts, 65 demand messages.
  - **`npm run sim -- --scenario demo < NUL` (stdin closed):** ran unattended. L1 at 16 s; breaches W tricycle (@24) and E tricycle (@28); `vision stop` (@32) → L2 2.3 s later; `sensor fault` (@42) → L3; `flood on` (@52) → L4 FLASHING_AMBER at about 57 s, held until the driver killed the process.
