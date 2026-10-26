---
title: 'Live status: intersection map, PCU and hour counts'
type: 'feature'
ticket: '13'
created: '2026-10-24'
baseline_commit: '5ec239578d10497ea9389c7a470b5601851b6112'
status: 'done'
route: 'dispatch'
risk: 'low'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-1-context.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-8-live-status-signal-state-plan.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/` has an empty center column and no counts. `vision/demand` reaches the backend and is dropped, so the `demand` slice stays `null`. The `counts` slice from entry 12 is sent but nothing shows it.

**Approach:** Complete CAP-3 on `/` per AD-8, AD-9, AD-12, AD-14 and the Staleness convention:
- the backend `demand` slice writer;
- the center intersection map, with four heads that mirror `state.signals` and a PCU tag per approach shown as received;
- the right column's counts table and hour total from the `counts` slice.

## Boundaries & Constraints

**Always:**
- **Demand writer** (`services/demand.ts`, the only `setSlice("demand")` caller; `mqtt/handlers/vision-demand.slice.ts` calls it):
  - The slice value is `{pcu, receivedAt}` (`DemandSlice`), with `pcu` relayed exactly as received (AD-12: never recomputed) and `receivedAt` the message's ISO time.
  - Throttle per AD-8: leading edge, 250 ms hold, trailing flush of the latest held value. It never drops a write because the value looks unchanged.
  - The trailing timer is `unref`'d, so it never holds the process open at shutdown.
- **Intersection map** (`components/live/intersection-map.tsx`, a `Panel` in the center column):
  - Inline SVG from the `map-*` tokens, after the mockup's map (`mockups/live-status.html` lines 1189–1292): blocks, sidewalks, zebra crossings, stop bars, dashed center lines, dashed demand zones, approach chevrons and "INT-01" at the center.
  - Four `SignalHead`s at the block corners: N and S show `state.signals.NS`, E and W show `state.signals.EW`, each labeled like "North head: green".
  - An approach label per approach: the letter, "North approach", "Phase NS" and the aspect label. No countdown (M2).
  - L4 adds the `flood-water` hatch over the map.
  - A PCU tag (72×60) in each demand zone: `demand.pcu.<approach>` formatted to one decimal, over "PCU · N". Zero dims to `text-3`. Before any demand, or when it is `null`, the tags show "–".
  - Staleness: the `Panel` is fed by `controller`, so its StaleBadge covers the heads, which keep their last aspect without glow (as in entry 8). A second `StaleBadge of="vision"` sits over the PCU layer, and the tags keep their last values.
  - With `state` null or not received: the map still draws, the heads are dark and the approach labels read "No data yet".
- **Counts** (`components/live/counts-panel.tsx`, a `Panel` fed by `vision`, titled "Vehicle counts this hour" with the Manila hour from `manilaHourLabel(counts.hourStart)` in its tag):
  - Rows N/S/E/W; columns are `useVehicleClasses()` in file order, then any extra ids present in `counts.byApproach` (shown raw through `ClassLabel`). Headers use `ClassLabel`. Zero cells dim.
  - The hour total is `counts.total`, in `display-total`, labeled "Hour total / All approaches, all classes".
  - `counts` null or not received: `NoData`. While vision is STALE, the last values stay under the StaleBadge.
- **`/`:** one mount line for each component in `app/page.tsx`, replacing the entry 13 comments. `app/page.test.tsx` is updated only where the new panels change its counts (lit lenses, "No data yet", StaleBadges).
- **Tests:** the demand writer with fake timers and a fake hub, plus the handler through `dispatch`; the two components with `LiveTestProvider`.

**Never:**
- No PCU computed or summed on the backend or the dashboard; no countdown, `remainingS`, `power` or `bootCount`.
- No contract, migration, `package.json` or lockfile edit, and no dependency.
- No edits to `index.ts`, `app.ts`, the shell, `panel.tsx`, `signal-head.tsx` or entry 8's panels, except one alphabetical registration line in `handlers/index.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First demand | `vision/demand` pcu {N 2.5, …} | `demand` slice written at once with that pcu and `receivedAt` | — |
| Burst | 5 messages within 250 ms | first written at once, the latest written once at the hold's end; nothing in between | — |
| Same value | identical pcu after the hold | written again | — |
| Heads | state NS GREEN, EW RED | N and S heads green, E and W red | — |
| L4 | state level L4 | flood hatch on the map | — |
| PCU zero | pcu W 0 | W tag "0.0" dimmed | — |
| No demand | demand null | four tags "–" | — |
| Vision stale | vision STALE with demand and counts set | PCU tags and counts keep values; vision StaleBadges show | — |
| Controller stale | controller STALE | heads keep the last aspect without glow; map StaleBadge shows | — |
| Counts | counts with car, tricycle | columns in file order; total = `counts.total`; zero cells dimmed | — |
| Unknown class | counts include `kalesa` | an extra column labeled `kalesa` after the file's classes | — |
| No counts | counts null | "No data yet" in the counts panel | — |
| New hour | counts slice with a new `hourStart` | table replaced; tag shows the new hour | — |

</frozen-after-approval>

## Code Map

- **Branch:** `feat/m1-13-map-pcu-counts` is story 12's branch (1.2, 1.3, 1.5, 1.12) with `feat/m1-8-live-signal-state` (1.6, 1.7, 1.8) merged in. It has none of entries 9, 10, 11, 15 or 16, so the right column holds only the counts panel here.
- **Contracts (read only):** `contracts/src/api/stream/demand.ts` `DemandSlice` (nullable `{pcu: {N,S,E,W}, receivedAt}`), `contracts/src/mqtt/vision-demand.ts` `VisionDemand` (`{v, ts, pcu}`, each ≥ 0), topic `vision/demand` QoS 0, not retained. `contracts/src/api/counts.ts` `HourCounts` (`hourStart`, `total`, `byApproach.<A>: ClassCounts`).
- **Backend:**
  - `services/state.ts` `writeState` and `mqtt/handlers/controller-state.slice.ts` are the writer and handler shapes to copy. There is no throttle helper; write it in `services/demand.ts`.
  - `mqtt/handlers/index.ts`: register `visionDemandSlice` between `visionCountsPersist` and `visionHeartbeatLink`.
  - `sse/hub.ts` `setSlice("demand", …)` validates (throws in tests). `index.ts` shutdown has no hook for services, hence `unref`.
  - Tests: `services/state.test.ts` (hub spy), `jobs/link-watchdog.test.ts` (fake timers, `vi.getTimerCount()`).
- **Simulator (read only):** `simulator/src/vision-role.ts` publishes `vision/demand` on change from random arrivals and departures, 100 ms leading-edge; `vision stop`/`quit` publishes no final demand, so the slice keeps its last value and staleness comes from `link.vision`.
- **Dashboard:**
  - `app/page.tsx`: the 432·960·432 grid; replace `{/* entry 13: intersection map */}` (center) and `{/* entry 13: vehicle counts this hour */}` (right).
  - `components/live/panel.tsx` (`Panel {title, tag, of, since, className}`, `NoData`, `well`), `signal-head.tsx` (`SignalHead {aspect, size, label, stale}`; 64 px on the map), `signal-state-panel.tsx` (how state and liveness drive heads).
  - `lib/live/hooks.ts` (`useLive`, `useLiveness`), `lib/visuals.ts` (`colorVar`, `aspectVisuals`, `approachVisuals`, `phaseVisuals`, `classColor`; map tokens are registered), `components/ui/class-label.tsx`, `ui/stale-badge.tsx`, `lib/use-vehicle-classes.ts`, `lib/time.ts` `manilaHourLabel`.
  - Tokens in `app/globals.css`: `numeral-pcu`, `numeral-count`, `display-total`, `display-approach`, `headline-map-state`, `map-*`, `flood-water`, `spacing-column-center` 960, `spacing-grid-height` 948.
  - `app/page.test.tsx` hard-codes 3 "No data yet", 3 StaleBadges and 2 lit lenses; `components/shell/fixtures.ts` has `simLink` and `state` only (keep fixtures local to the new tests). `lib/live/live-provider.test.tsx:50-56` has sample `counts` and `demand` objects.
- **Mockup:** `_bmad-output/initiative-catarman-smart-traffic-light/ux-smart-traffic-light/mockups/live-status.html`: map at lines 1189–1292, counts panel 1298–1313, flood-mode map 1383–1450.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/services/demand.ts`, `backend/src/mqtt/handlers/vision-demand.slice.ts` -- the throttled writer and its handler, plus the registration line.
- [x] `dashboard/src/components/live/intersection-map.tsx` -- map, heads, approach labels, PCU tags, flood hatch.
- [x] `dashboard/src/components/live/counts-panel.tsx` -- counts table and hour total.
- [x] `dashboard/src/app/page.tsx`, `app/page.test.tsx` -- two mount lines and the count updates.
- [x] Tests -- every matrix row.

**Acceptance Criteria:**
- Given the broker, `npm run dev` and the simulator with both roles (`--roles both`, the default), then on `/` the N and S heads follow NS and E and W follow EW, each PCU tag follows `vision/demand` within 1 s, and the counts table follows the `counts` slice.
- Given `flood on` in the simulator, then the map shows the flood hatch.
- Given the vision role stops, then the PCU tags and the counts panel are marked STALE and keep their values.
- `/` fits 1920×1080 with no page scroll.
- When `npm run typecheck`, `npm run lint`, `npm test` and `npm run build -w dashboard` run, then all exit 0.

## Implementation Notes

- **Map size.** The column leaves 920×826 px for the map inside the panel, so the mockup's 936×840 map (SVG and overlays at mockup coordinates) is drawn as is and scaled by 920/936.
- **Throttle state** lives in a `WeakMap` keyed by hub, so each test hub gets its own hold. After a trailing flush a new hold starts, so writes stay at most one per 250 ms.
- **`receivedAt`** in the `demand` slice is the backend receive time (`ctx.receivedAt`, AD-6), the same as the `state` slice.
- **Flood hatch** uses `data-flood-hatch`, because the flood panel already uses `data-flood`.
- **Counts table** is `table-fixed` with a 36 px approach column and auto-hyphenated headers, so five classes fit in 392 px. The tag reads "Since HH:00" ("This hour" before any counts). While `/api/vehicle-classes` is loading or failing, the columns are the ids in `byApproach`, shown raw.
- `page.test.tsx` now renders `CountsPanel`, whose `useVehicleClasses` fetch logs an `act(...)` warning. The test still passes; it isn't mocked there, to keep that file's edits to the counts.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | verification-gap, edge, blind | Counts arriving before (or without) the class list are untested; a failed class load falls back silently to raw ids | medium | Pre-verified: every counts test mocks loaded classes. Raw ids are the Unknown id pattern, so the fallback is right; the gap is the test | patch |
| 2 | blind | The demand hold's re-arm after a trailing flush is untested | medium | Removing `hold(hub, t)` in the timer callback passes every test | patch |
| 3 | blind | PCU tags have no accessible name | medium | The SVG is `aria-hidden`; a reader hears "2.5 PCU · N" or a bare "–" (Accessibility floor) | patch |
| 4 | blind | The controller-STALE page test's name still says three panels | low | It now counts four; a direct rename | patch |
| 5 | edge | A PCU in (0, 0.05) shows "0.0" undimmed | false | PCU is a sum of class weights (≥ 0.25 each, AD-12), so no value lies in that range | reject |
| 6 | edge | Many unknown class ids squeeze the counts table | low | Needs several unknown classes in one hour; the vision model emits the file's ids (AD-12) | reject |
| 7 | blind | The counts StaleBadge shows no time | low | `HourCounts` carries no receive time; inventing one would edit the contract | reject |
| 8 | blind | SVG pattern ids are global | low | `/` mounts one map; no second map exists | reject |
| 9 | blind | "INT-01" is hard-coded | low | M1 runs one intersection; the shell header hard-codes it the same way | reject |
| 10 | blind | The map has a fixed 920 px scale | low | The display target is fixed at 1920×1080 (Display target convention) | reject |
| 11 | blind | The vision StaleBadge's position isn't checked | low | Checked in the live screenshots | reject |
| 12 | blind | The demand handler's invalid-payload path is untested | false | Payload validation is `dispatch`'s job (1.3), tested there; the handler never sees an invalid payload | reject |
| 13 | blind | `page.test.tsx` uses page-wide totals | low | They are the counts the spec asked to update; scoping them is a refactor of entry 8's test | reject |
| 14 | blind | The no-countdown test only checks "14 s" | low | Nothing on the map reads `remainingS`; the live run shows no countdown | reject |
| 15 | blind | The throttle is per hub, not per intersection | low | One intersection per backend in M1 | reject |
| 16 | verification-gap | `page.test.tsx` makes a real class-list request | low | Logs an `act` warning only; the tests pass | reject |

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build -w dashboard` -- expected: all exit 0.

**Manual checks:**
- The Acceptance Criteria in headless Edge at 1920×1080 against the broker, `npm run dev` and the simulator, with screenshots of `/` live, in L4 and with vision stopped.

**Recorded (2026-10-24):**
- `npm run typecheck`, `npm run lint`, `npm test` (backend 81, dashboard 130, contracts 174, simulator 68) and `npm run build -w dashboard` all exit 0. The stale `dashboard/.next/dev/types` left by another branch's dev server had to be deleted first; it is gitignored build output.
- Live run with `npm run broker`, `npm run dev` and `npm run sim` (both roles) on this branch, in headless Edge at 1920×1080 over CDP:
  - N and S heads followed NS and E and W followed EW.
  - The PCU tags changed between two samples 1 s apart.
  - The counts table and hour total followed the `counts` slice.
  - `flood on`: L4, with the hatch over the map.
  - `vision stop`: the PCU StaleBadge and the counts StaleBadge showed, with values kept.
  - `quit`: the map's controller StaleBadge showed, and the heads kept flashing amber without glow.
  - Document scroll stayed 1920×1080 in every state; the map panel's bottom is at 1056 px.

**After review fixes (2026-10-24):**
- `npm run typecheck`, `npm run lint`, `npm test` (contracts 174, backend 82, simulator 68, dashboard 131) and `npm run build -w dashboard` exit 0.
- Headless Edge at 1920×1080 against the broker, `npm run dev` and the simulator with both roles:
  - Across 12 samples a second apart through a full cycle, N and S always matched NS and E and W matched EW (green, yellow, red each seen).
  - The PCU tags changed between samples 4 s apart, with names like "North demand: 2.0 PCU". The counts table showed the five classes in file order, "Since 18:00" and the hour total.
  - `flood on`: L4 and the flood hatch 5.1 s later (the simulator's flood debounce). The first run forced `level L1` and so showed FLOODED without L4, as expected.
  - `vision stop`: both vision StaleBadges (PCU layer "STALE · <time>", counts panel) within 40 ms, values kept.
  - No page scroll (`scrollHeight` 1080, `scrollWidth` 1920).
- Note: PCU values are multiples of 0.25, so one decimal rounds 2.25 to "2.3" (and 1.25 to "1.3"), as the spec's one-decimal rule says.
