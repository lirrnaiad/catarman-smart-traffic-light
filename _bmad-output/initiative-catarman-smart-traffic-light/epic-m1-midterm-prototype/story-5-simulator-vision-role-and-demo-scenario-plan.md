---
title: 'Simulator: vision role and demo scenario'
type: 'feature'
ticket: '5'
created: '2026-10-23'
status: 'draft'
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
- [ ] `simulator/assets/placeholder-crop.jpg` -- generate and commit it as described in the Code Map.
- [ ] `simulator/src/vision-role.ts`:
  - `createVision(now, {rand, classes})`: the pure core, with `step(t, signals?)`, `heartbeat(t)`, `demand()`, `takeCounts(t)` and `breach(t, approach?, vehicleClass?)`;
  - `startVisionRole({config, force, controller?})`: the link, start check, timers (step 100 ms, heartbeat 1 s, counts 1 s, demand throttle) and status. It returns `{vision, stop(), start()}`.
- [ ] `simulator/src/scenarios/demo.ts` and its registration line -- the demo steps (see the Demo row).
- [ ] `simulator/src/repl.ts`, `simulator/src/index.ts` -- the Code Map changes.
- [ ] `simulator/src/vision-role.test.ts` and additions to `repl.test.ts`:
  - every matrix row, using fake timers and the mocked `mqtt`;
  - the asset file is a baseline JPEG with no APP1 and a long side of 64 px or less;
  - every demo line runs through `runCommand` without a usage or "unknown" answer.

**Acceptance Criteria:**
- Given the broker is up, when `npm run sim` runs, then a `stl/#` subscriber sees both statuses online and heartbeats at 1 Hz, and the controller reaches L1. It also sees demand, counts and, after `emit-breach`, a breach with a crop.
- Given that run, when `vision stop` is typed, then a retained `vision/status` `online:false` arrives and the controller reports L2 within 3 s.
- When `npm run sim -- --scenario demo` runs, then it reaches L4 with no input, emitting at least two breaches on the way.
- When `npm run typecheck`, `npm run lint` and `npm test` run, then all exit 0.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test` -- expected: all exit 0.

**Manual checks:**
- Against Mosquitto, run the acceptance criteria and record the steps here (epic Done rule 4).
