---
title: 'Live status: signal state on /'
type: 'feature'
ticket: '8'
created: '2026-10-23'
status: 'draft'
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
- [ ] `backend/src/services/state.ts`, `backend/src/mqtt/handlers/controller-state.slice.ts`, and the registration line -- the slice writer.
- [ ] `backend/src/services/state.test.ts` -- the three backend matrix rows.
- [ ] `dashboard/src/components/live/{panel,signal-head,signal-state-panel,ladder-panel,flood-fault-panel}.tsx` -- the panels.
- [ ] `dashboard/src/app/page.tsx` -- the grid, mounts and slots.
- [ ] Tests next to each dashboard component -- the remaining matrix rows.

**Acceptance Criteria:**
- Given `npm run broker`, `npm run dev` and the simulator with `--roles controller`, when `/` is open at 1920×1080, then:
  - each NS and EW aspect change shows within 1 s without a reload;
  - REPL `level L1`…`L4`, `flood on` (WET, then FLOODED) and `conflict raise` each read distinctly, and the shell's banners follow;
  - no countdown shows and the page doesn't scroll;
  - stopping the simulator marks the three panels STALE with their last values.
- When `npm run typecheck`, `npm run lint`, `npm test` and `npm run build -w dashboard` run, then all exit 0.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build -w dashboard` -- expected: all exit 0.

**Manual checks:**
- The live acceptance run in a browser at 1920×1080 against the simulator, recorded here. It also re-checks entry 7's header, link bar and banners and entry 6's single `EventSource` (both deferred to this entry).
