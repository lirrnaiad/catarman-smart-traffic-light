---
title: 'Live status: signal state on /'
type: 'feature'
ticket: '8'
created: '2026-10-23'
baseline_commit: '8f04a719351a98d1f08862ce0728b49d5e3a0b5b'
status: 'done'
route: 'dispatch'
risk: 'medium'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-1-context.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-7-dashboard-shell-layout-header-and-ui-atoms-plan.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/ux-smart-traffic-light/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/ux-smart-traffic-light/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing writes the SSE `state` slice and there is no `/` page, so CAP-3's live signal state never reaches the screen. This is the first path through every layer: simulator → broker → backend → SSE → dashboard.

**Approach:** Build entry 8.
- **Backend:** the `state` slice writer, `services/state.ts`, plus its handler `controller-state.slice.ts` with one registration line.
- **Dashboard:** the `/` page, a 432/960/432 grid whose left column holds:
  - **Signal state:** NS and EW phase cards;
  - **Degradation level:** the L1–L4 ladder;
  - **Flood sensor and conflict fault:** the flood selector and the fault row.

  The center and right columns get named, empty slots for entries 10, 13 and 16.

## Boundaries & Constraints

**Always:**
- **State slice (spine, SSE table):**
  - The value is the `controller/state` payload without `v`, plus `receivedAt`, the backend receive time as ISO UTC (AD-6).
  - It is written on every non-retained state, including periodic republishes, and never compared with the last value.
  - A retained copy is written with `remainingS` removed.
  - The writer is the slice's only `setSlice("state", …)` caller.
  - The handler only calls the service; the service takes the hub as an argument, so `index.ts` and `app.ts` stay untouched (AD-16).
- **Page structure:**
  - `/` follows DESIGN → Layout & Spacing: columns of 432, 960 and 432 px, a 24px gutter and side padding, 20px top padding, panels 20px apart, and the last left panel filling the rest of the column.
  - `page.tsx` holds only the grid, the three mount lines for this story's panels, and one commented slot per future mount: the center map (entry 13); then, in the right column, counts (13), latest breach (16) and the override panel (10).
- **Panels:** each panel uses DESIGN's panel recipe (rivets, title strip with a micro tag), and values sit in wells.
  - **Phase card:** a 20px signal head, "PHASE NS" or "PHASE EW", the aspect label in its signal color, and "N + S HEADS" or "E + W HEADS".
  - **Lamps:** exactly the reported lens is lit. FLASHING_AMBER flashes the yellow lens, and DARK lights none.
  - **Ladder:** four rungs in L1→L4 order, each with a `LevelBadge`, a 30px stroke icon (camera, stop-bar sensor, clock, water waves), the exact level name, and a CURRENT flag on `state.level`. Neither a fault nor an override moves the flag.
  - **Flood selector:** DRY, WET and FLOODED cells with the one from `state.flood` on. FLOODED carries a hazard edge. WET adds the note "immersion seen, debounce running".
  - **Fault row:** a square pilot, "CONFLICT FAULT", and "None" or "FAULT · Conflict monitor", plus "Reset at the controller box" while faulted. It has no control.
- **No data and stale:**
  - While `state` is `null` or not yet received, every panel shows "No data yet" in its well.
  - While `useLiveness("controller")` is STALE, every panel keeps its last values and shows `<StaleBadge of="controller" since={state.receivedAt} />`, and lit lenses lose glow and breathing (`AspectLamp stale`).
- **Reuse:** the shell's atoms, `visuals.ts`, `formatManila` and the live hooks only. No countdown and no `remainingS` or `power` rendered (M2).
- **Tests:** backend Vitest against a real hub with no broker; dashboard Vitest and Testing Library under `LiveTestProvider`.

**Never:**
- No edits to `backend/src/index.ts`, `app.ts`, `services/link.ts` or any shell or entry 6/7 file. The one exception is a registration line in `backend/src/mqtt/handlers/index.ts`.
- No center or right-column content, override controls, countdown, M2 fields, new dependency, `package.json`, lockfile or contract edit.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh state | non-retained `controller/state` with `remainingS: 7` at receivedAt T | `setSlice("state", {…payload without v, remainingS: 7, receivedAt: iso(T)})` | — |
| Repeat state | the same non-retained payload twice | written twice | — |
| Retained state | retained payload with `remainingS` | written without `remainingS` | — |
| Cycle | NS GREEN / EW RED, then NS YELLOW | the NS card lights only green, then only yellow, with "Green" then "Yellow"; EW shows red | — |
| Flashing | both FLASHING_AMBER | yellow lens flashing, "Flashing amber" on both cards | — |
| Dark | `signals.NS` DARK | no lens lit; "Dark" | — |
| Level | `level` L1…L4 | the CURRENT flag on that rung only, with the exact name | — |
| Fault vs level | `fault: true`, `level` L2 | ladder stays on L2; fault row "FAULT · Conflict monitor" | never shown as L4 |
| Flood | DRY, WET, FLOODED | that cell on; WET adds its note; FLOODED has the hazard edge | — |
| No data | `state` null | "No data yet" in each panel | — |
| Stale | controller STALE with a last state | last values kept; StaleBadge "STALE · HH:mm:ss" on all three panels; no glow | — |

</frozen-after-approval>

## Code Map

- **Backend:**
  - `backend/src/mqtt/handlers/index.ts`: add `controllerStateSlice` between `controllerStateLink` and `controllerStatusLink`, keeping the list alphabetical. `HandlerCtx` gives `receivedAt` (epoch ms), `retained` and `hub`.
  - `backend/src/mqtt/handlers/controller-state.link.ts`: the handler shape to copy, `{topic, handle} satisfies HandlerFor<"controller/state">`.
  - `backend/src/sse/hub.ts`: `setSlice(name, value)` validates against `streamSchemas`, and the hub created with `validate: "throw"` throws in tests. `contracts/src/api/stream/state.ts` `StateSlice` is `ControllerState.omit({v}).extend({receivedAt: isoUtc}).nullable()`.
  - `backend/src/services/link.test.ts`: the test pattern (`createHub({validate:"throw"})`, `vi.spyOn(hub, "setSlice")`).
- **Dashboard:**
  - Entry 6/7 pieces to use, unchanged:
    - `src/lib/live/hooks.ts`: `useLive("state")` and `useLiveness`.
    - `src/lib/visuals.ts`: aspect, level, flood and fault visuals and `colorVar`.
    - `src/components/ui/`: `AspectLamp` (`color`, `lit`, `flashing`, `size`, `stale`), `LevelBadge`, `StaleBadge` (`of`, `since`) and `styles.ts` (`stencil`, `focusRing`, `hazardStripes`).
    - `src/components/shell/frame.tsx`: `<main>` is 948px and clips on `/`. The page fills it.
  - New in `src/components/live/` (owned here):
    - `panel.tsx`: the DESIGN panel frame, with title, tag slot and rivets. Entries 10, 13 and 16 reuse it.
    - `signal-head.tsx`: three `AspectLamp`s on a backplate for a given aspect. Entry 13's map reuses it.
    - `signal-state-panel.tsx`, `ladder-panel.tsx` and `flood-fault-panel.tsx`.
  - `dashboard/src/app/page.tsx` (new): the grid and the slots. The live check uses `mockups/live-status.html`'s left column for composition and copy (titles and tags such as "LIVE · INT-01" and "DEGRADES DOWNWARD").
- **Live demo:** the simulator lives on `feat/m1-5-simulator-vision`. Run it from a `git worktree` in the scratchpad, with its `node_modules` linked (a directory junction) to this repo's root `node_modules`. Run the backend with `backend/.env` (it exists locally) and the local broker, using `npm run dev` here.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/services/state.ts`, `backend/src/mqtt/handlers/controller-state.slice.ts`, and the registration line -- the slice writer.
- [x] `backend/src/services/state.test.ts` -- the three backend matrix rows.
- [x] `dashboard/src/components/live/{panel,signal-head,signal-state-panel,ladder-panel,flood-fault-panel}.tsx` -- the panels.
- [x] `dashboard/src/app/page.tsx` -- the grid, mounts and slots.
- [x] Tests next to each dashboard component -- the remaining matrix rows.

**Acceptance Criteria:**
- Given `npm run broker`, `npm run dev` and the simulator with `--roles controller`, when `/` is open at 1920×1080, then:
  - each NS and EW aspect change shows within 1 s without a reload;
  - REPL `level L1`…`L4`, `flood on` (WET, then FLOODED) and `conflict raise` each read distinctly, and the shell's banners follow;
  - no countdown shows and the page doesn't scroll;
  - stopping the simulator marks the three panels STALE with their last values.
- When `npm run typecheck`, `npm run lint`, `npm test` and `npm run build -w dashboard` run, then all exit 0.

## Implementation Notes

- **Height budget on `/`'s left column.** DESIGN's 42px aspect label cannot fit "Flashing amber" in two side-by-side 190px cards, so the phase cards stack. To fit three panels in 904px with the worst case (WET note plus a fault), a few mock spacings were tightened: title strip margin 14→10 (in `Panel`, so entries 10/13/16 inherit it), phase cards py 4 with an 8px gap, rung gap 5, selector cells 46px, and the fault row's reset note shares the "CONFLICT FAULT" line. Measured worst case (WET + fault): 26px to spare in the flood panel.
- `Panel` takes `of` (role) and `since`; it keeps `StaleBadge` always mounted so transitions are announced, and shows the micro tag only while LIVE. With three controller panels, one STALE transition is announced three times through the shared live region ("Controller stale. Controller stale. Controller stale").
- `SignalHead` has the backplate but no mounting bracket (it matches the shell's `UnlitHead`); entry 13 may add one for the map.
- The ladder's rung text is the level name without its code ("Vision adaptive"); with the `LevelBadge` it reads the exact name, and the badge's accessible name is the full `levelVisuals` label.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | implementer, blind | One STALE change is announced three times | medium | Each of the three panels' `StaleBadge` calls `announce()`; entry 7's live region joins identical messages queued in one tick | defer → fixed on entry 7's branch (live region drops duplicate messages within a tick), merged here |
| 2 | edge, blind | A stale FLASHING_AMBER lens keeps its 1 Hz flash | medium | `AspectLamp` applies `lamp-flash` whenever `flashing`, ignoring `stale`; at L4 a dead controller looks live; `SignalHead` (this story) can pass `flashing && !stale` | patch |
| 3 | verification-gap, blind | No test shows `controllerStateSlice` is registered, or that `remainingS: 0` and a no-`remainingS` fresh state are kept as sent | medium | Deleting the registration line passes every test; only `writeState` is tested directly | patch |
| 4 | blind | Each ladder rung reads its name twice | low | The `LevelBadge` img is named "L2 Stop-bar presence" and the visible text "Stop-bar presence" follows; a direct `aria-hidden` fix | patch |
| 5 | blind | The panel `<h2>` holds the tag and StaleBadge too | low | The heading's accessible name becomes "Signal state Live · INT-01"; a direct fix in `Panel` | patch |
| 6 | blind | The page STALE test checks only one panel tag | low | It asserts "Live · INT-01" is gone but not "Degrades downward" or "Immersion probe" | patch |
| 7 | blind | A retained state gets a fresh `receivedAt` | false | AD-6 and the SSE table make `receivedAt` the backend receive time | reject |
| 8 | blind | The ladder name comes from `label.replace` | low | The rung test pins the result; a `name` field needs an entry-6 edit | reject |
| 9 | blind | The tag says "Live" even with a simulated source | low | The Sim tag and the simulated note in the link bar carry the source (EXPERIENCE) | reject |
| 10 | blind | Spacing departures from DESIGN aren't in DESIGN.md | low | Recorded in Implementation Notes; updating DESIGN.md is a UX-doc change | reject |
| 11 | blind | The single-`EventSource` check is still open | low | Covered in this entry's live verification, not in code | reject |
| 12 | blind | The no-countdown test asserts only one string is absent | low | No component reads `remainingS`; nothing else could render one | reject |

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build -w dashboard` -- expected: all exit 0.

**Manual checks:**
- The live acceptance run in a browser at 1920×1080 against the simulator, recorded here. It also re-checks entry 7's header, link bar and banners and entry 6's single `EventSource` (both deferred to this entry).

**Recorded (2026-10-23):**
- `npm run typecheck`, `npm run lint`, `npm test` (backend 59, dashboard 111) and `npm run build -w dashboard` all exit 0.
- Live run: `npm run broker`, `npm run dev`, simulator from `feat/m1-5-simulator-vision` (scratch worktree, junctioned `node_modules`) with `--roles controller`; headless Edge over CDP at 1920×1080 with screenshots. Phase cycle (green/yellow/red per card), `level L1`/`L2`/`L3`/`L4`, `flood on` (WET with its note, then FLOODED with the L4 banner), `conflict raise`/`reset` (fault row and FAULT banner) all rendered; each REPL change was in the DOM within ~0.4 s (poll granularity). Document scroll size stayed 1920×1080 in every state; no countdown. Killing the simulator: all three panels showed "STALE · HH:mm:ss" with their last values and lenses lit without glow (the link bar read Controller OFFLINE via the simulator's will, which `useLiveness` also treats as stale).
- Shell re-check: top bar, link bar pilots/Sim tags, data-source note and L4/FAULT banners looked right. The single `EventSource` was **not** confirmed (resource timing doesn't list a pending SSE request); still open.

- **Live acceptance after review fixes (2026-10-23):** native Mosquitto, `npm run dev`, and the simulator from `feat/m1-5-simulator-vision` with `--roles controller`, driven through headless Edge at 1920×1080 over the DevTools protocol.
  - **Display:** the page was ready 0.4 s after load. The NS aspect flipped Green → Yellow on its own.
  - **Latency:** after the REPL commands, the L4 banner showed in 102 ms, WET with its note in 92 ms, and the FAULT banner in 98 ms. Under L4 + FAULT, the ladder stayed on L4 and the fault row read "FAULT · Conflict monitor".
  - **Layout:** scroll stayed 1920×1080 in every state, and no countdown showed.
  - **Stale:** stopping the simulator showed "STALE · HH:mm:ss" on all three panels, with the last values kept and the flashing lens steady. The live region read "Controller stale" once, so the entry-7 dedupe works.
  - **Deferred checks:** exactly one `EventSource`, on `http://127.0.0.1:4000/api/stream`, never failed. That closes entry 6's deferred check, and the header, link bar and banners close entry 7's.
