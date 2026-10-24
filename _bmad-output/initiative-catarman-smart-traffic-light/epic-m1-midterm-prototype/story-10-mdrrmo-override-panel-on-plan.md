---
title: 'MDRRMO override panel on /'
type: 'feature'
ticket: '10'
created: '2026-10-24'
baseline_commit: '4be5a751111d53d61482c3fd64543a1a610fea9c'
status: 'done'
route: 'dispatch'
risk: 'medium'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-1-context.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-9-override-lifecycle-and-override-log-plan.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/ux-smart-traffic-light/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Entry 9's backend accepts, resolves and times out override commands, but nothing on `/` sends them. The MDRRMO dispatcher has no way to run EXPERIENCE Flow 1.

**Approach:** Build CAP-5's override panel in `ui/components/override/` and mount it with one line at the bottom of `/`'s right column. It calls entry 9's `postOverride`, follows the command over SSE `override`, and reads Current only from `state.override`.

## Boundaries & Constraints

**Always:**
- **Panel** (DESIGN → MDRRMO override panel; `mockups/live-status.html`):
  - A hazard frame around a housing, filling the rest of the right column.
  - The title row reads "MDRRMO OVERRIDE", with the controller StaleBadge on the right. The Current override plate is a full-width recess row directly below it, reading "CURRENT" and the value. This departs from the mock: at 432px the title row can't hold the plate with "Flashing amber" (about 397px) or with a StaleBadge (about 520px), against 380px available (user, 2026-10-24).
  - A 2×2 grid of buttons, each with a 34px stroke icon: Flashing amber, Evacuation corridor — NS, Evacuation corridor — EW, and Release to automatic (the release style).
  - The footer has a lock icon and "Every override asks for confirmation first".
- **Confirm:** every button, release included, opens the shell's `ConfirmDialog`. Confirm calls `postOverride` with `{mode:"FLASHING_AMBER"}`, `{mode:"CORRIDOR",phase}` or `{mode:"NONE"}`. Cancel or Esc sends nothing. Dialog copy (title / effect line):
  - Corridors: "Activate evacuation corridor NS?" (EW the same) / "All other approaches go red."
  - Flashing amber: "Activate flashing amber?" / "Every approach flashes amber." (user, 2026-10-24)
  - Release: "Release to automatic?" / "The controller returns to its automatic level." (user, 2026-10-24)
- **Command tracking:**
  - The panel follows the last command it sent, keyed on the server's `commandId`: the 202 body, then each SSE `override` with that id.
  - An SSE frame for that id may arrive before the 202. It wins over the 202's REQUESTED.
  - On every stream epoch while the command is REQUESTED, the panel re-reads `listOverrides()` and takes that id's row if it's there, so a missed SSE frame can't leave the buttons disabled.
- **Status display:**
  - **REQUESTED:** all four buttons are disabled, and the pressed one reads "Pending · waiting for controller". Current doesn't change.
  - **APPLIED:** the buttons re-enable and any notice clears.
  - **REJECTED:** a notice reads "Rejected · <reason label>", using `rejectionReasonVisual`. An unknown code shows raw.
  - **TIMEOUT:** a notice reads "No reply from controller in 5 s", and the buttons re-enable. A later APPLIED for that id clears the notice.
- **Failed POST:** a 409 or any other `ApiRequestError` shows "Rejected · <code label>" and keeps the buttons enabled. The orphan REJECTED SSE that follows a 409 is ignored.
- **Current plate:** reads only `state.override`. NONE shows "None", FLASHING_AMBER shows "Flashing amber", and CORRIDOR shows "Corridor NS" or "Corridor EW". Before any state arrives (slice `null` or not yet received), the chip reads "No data yet" (user, 2026-10-24). While the controller is STALE, it keeps its last value under a `StaleBadge` (controller, `state.receivedAt`). The buttons stay enabled.
- **Ended on its own:** a notice shows when `state.override` goes from a non-NONE mode to `{NONE, X}`, and X isn't a release `commandId` this page has seen (its own 202, or any SSE `override` with mode NONE). The first state a page mounts with never shows it. Wording: "Corridor ended — link loss or fault" after a corridor, "Override ended — link loss or fault" after flashing amber.
- **Notices:** sending a new command clears any notice.
- **Announcements:** pending, applied, rejected, timeout and ended-on-its-own are each spoken once through `useAnnounce()`, using the same words as on screen.
- **Labels:** every label and color token comes from `visuals.ts`.
- **Tests:** Vitest under `LiveTestProvider` with `fetch` stubbed, firing `override` through `createLiveBus()`.

**Never:**
- No edits outside `ui/components/override/`, except the one mount line in `ui/app/page.tsx` and the `app/page.test.tsx` assertion that the panel mounts.
- No edits to entry 7's `ConfirmDialog`, `LiveRegion` or `visuals.ts`, to entry 9's `lib/api/overrides.ts`, or to the backend or contracts. No dependency.
- The dashboard never mints ids or dedupes POSTs. It shows no countdown and no M2 fields.
- No banner work: the shell already shows OVERRIDE from `state.override`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Corridor applied | confirm NS → 202 REQUESTED; SSE APPLIED; state `{CORRIDOR,NS,id}` | NS button reads Pending, all disabled; then enabled; Current "Corridor NS" | — |
| Cancel | click, then Cancel or Esc | no POST | — |
| Release | confirm Release → 202, then state `{NONE, releaseId}` | Current "None", no ended notice | — |
| Fast ack | SSE APPLIED for id arrives before the 202 resolves | ends APPLIED, not stuck at Pending | — |
| Offline | POST → 409 `CONTROLLER_OFFLINE` | "Rejected · Controller offline"; buttons enabled | orphan SSE REJECTED ignored |
| Conflict | SSE REJECTED `CONFLICT_FAULT` for id | "Rejected · Conflict fault" | — |
| Timeout, then late | SSE TIMEOUT; later SSE APPLIED | notice shows, buttons enabled; notice clears | — |
| Missed frame | REQUESTED; epoch increments; list has id APPLIED | buttons enabled | list failure → stays Pending until next epoch or SSE |
| Ended on its own | state `{CORRIDOR,NS,a}` → `{NONE,b}`, b unseen | "Corridor ended — link loss or fault" | — |
| Mount on NONE | first state `{NONE,x}` | Current "None", no notice | — |
| Stale | controller STALE | Current kept under StaleBadge; buttons enabled | — |

</frozen-after-approval>

## Code Map

- **Mount:** `dashboard/src/app/page.tsx` has the right-column slot comment `{/* entry 10: MDRRMO override panel */}`. Replace it with `<OverridePanel />`, keeping the entry 13 and 16 comments above it. `app/page.test.tsx` shows the mount-test pattern (`simLink`, `state` from `components/shell/fixtures.ts`).
- **Reused, unchanged:**
  - `components/ui/confirm-dialog.tsx`: `ConfirmDialog({open, title, effect, confirmLabel, onConfirm, onCancel})`. `onConfirm` returns a promise, and Confirm stays disabled until it settles (a rejection is swallowed, so the caller shows it). It traps focus, opens on Cancel, restores focus, and supports one open dialog at a time.
  - `components/shell/live-region.tsx`: `useAnnounce()`.
  - `components/ui/stale-badge.tsx`: `StaleBadge({of, since})`.
  - `components/ui/styles.ts`: `stencil`, `focusRing`, `hazardStripes`.
  - `components/live/panel.tsx`: `well`. Don't use its `Panel`, because the hazard frame is a different housing.
  - `lib/api/overrides.ts`: `postOverride`, `listOverrides`. `lib/api/client.ts`: `ApiRequestError.code`. A network failure is `INTERNAL`.
  - `lib/live/hooks.ts`: `useLive("state")`, `useLiveEvent("override")`, `useStreamEpoch()`.
  - `lib/visuals.ts`: `overrideModeVisuals`, `phaseVisuals`, `commandStatusVisuals` (the REQUESTED and TIMEOUT labels), `rejectionReasonVisual`.
- **Contracts:** `StateOverride` (`contracts/src/mqtt/controller-state.ts`) is a union on mode. NONE may omit `commandId`. `OverrideCommand` and `OverrideRequest` are in `contracts/src/api/overrides.ts`.
- **Tokens:** `--spacing-hazard-frame` (10px), `text-label-control`, `rounded-xl` for the frame. The mock's CSS is at `mockups/live-status.html` lines 770–830 and its markup at 1327–1349, with the button icons' SVG paths in it.
- **Pattern for SSE plus REST races:** `components/override-log/override-log.tsx` (an epoch ref, and an SSE replay over a REST read).
- **Live check:** same setup as story 9. Run the broker and `npm run dev`. The simulator comes from `feat/m1-5-simulator-vision`, by `git archive` into the scratchpad with a `node_modules` junction. The never-acks fake controller uses `mosquitto_pub`. Use headless Edge at 1920×1080.

## Tasks & Acceptance

**Execution:**
- [x] `dashboard/src/components/override/override-panel.tsx` -- the panel, buttons, Current plate, notice, dialog wiring and command tracking.
- [x] `dashboard/src/components/override/override-panel.test.tsx` -- every I/O matrix row, plus the announcements and the dialog's titles.
- [x] `dashboard/src/app/page.tsx` + `app/page.test.tsx` -- the mount line, and an assertion that the "MDRRMO override" region renders.

**Acceptance Criteria:**
- Given the broker, `npm run dev` and the simulator with `--roles controller` in L4: when the dispatcher confirms Corridor NS on `/`, the button reads Pending, then Current reads "Corridor NS" beside the L4 ladder. Release returns Current to "None".
- Given the simulator stopped, when a corridor is confirmed, then "Rejected · Controller offline" shows. Given `conflict raise`, then "Rejected · Conflict fault" shows.
- Given a fake controller that never acks, then the timeout notice shows at about 5 s.
- When `npm run typecheck`, `npm run lint`, `npm test` and `npm run build -w dashboard` run, then all exit 0.

## Implementation Notes

- **Busy state:** while a command is REQUESTED or its POST is in flight, the buttons are `aria-disabled` and their clicks do nothing. They don't get the `disabled` attribute, because ConfirmDialog restores focus to the pressed button as it closes, and a `disabled` button can't take focus (review entry 1).
- **Final statuses:** once a command is APPLIED or REJECTED, later frames for it are ignored. TIMEOUT is not final, so a late APPLIED still clears its notice.
- **Pending placement:** "Pending · waiting for controller" shows as a caption under the pressed button's label, not in place of it.
- **Current plate:** moved out of the title row onto its own row (user, 2026-10-24; see the frozen Panel rule). The first live screenshot showed the title row wrapping at 432px.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind | Focus falls to `<body>` after Confirm | medium | `send()` sets REQUESTED and closes the dialog in one render. ConfirmDialog's cleanup calls `before.focus()` on a button that is now `disabled`, so the focus call fails, against EXPERIENCE → Accessibility Floor ("returns focus to the button that opened it") | patch |
| 2 | edge | Cancel or Esc during an in-flight POST re-enables the buttons, so a second command can overlap the first; out-of-order 202s then mis-track the command | low | `tracked` is null until the 202 lands, and Cancel stays enabled in ConfirmDialog. One `sending` flag in `busy` closes both | patch |
| 3 | edge | A list snapshot with TIMEOUT, arriving after SSE APPLIED, brings the timeout notice back | low | `apply` blocks only REQUESTED from regressing. Making APPLIED and REJECTED final is a direct correction | patch |
| 4 | verification-gap | No test checks that a late REQUESTED (a stale list row) can't undo a final status | medium | Deleting the guard passes every test. The re-read race needs it | patch |
| 5 | verification-gap | No test checks "spoken once" across ticks | medium | LiveRegion de-duplicates only within one 100 ms batch. Replacing `say` with `announce` passes every test | patch |
| 6 | blind | Notices don't clear when `state.override` changes | low | Matches the frozen rules (cleared by a new command or by APPLIED). The scenario needs a second tab, and EXPERIENCE has one edge laptop | reject |
| 7 | blind | The `seen` map can keep a REQUESTED that arrived after APPLIED | false | The backend emits REQUESTED before it publishes (story 9 Implementation Notes), so on the one ordered stream, SSE REQUESTED never follows its own APPLIED | reject |
| 8 | blind | Buttons stay disabled if TIMEOUT never arrives on a live stream | low | Needs a backend bug. Story 9's timeout job is covered by fake-timer tests | reject |
| 9 | blind | A false "ended" notice after a reconnect when another tab released | low | Needs a second tab and a dropped stream. A fix adds list-scanning logic | reject |
| 10 | blind | Repeated failures aren't announced | false | LiveRegion clears the text before each new batch, so the same text in a later tick is re-read (`live-region.tsx`, "Clear first") | reject |
| 11 | blind | No-op commands (release while None) stay enabled | low | EXPERIENCE disables buttons only while REQUESTED, and the backend accepts these commands | reject |
| 12 | blind | Untested branches: reason null, SEEN_MAX eviction, unmount mid-POST, a 202 already APPLIED | low | No user-visible defect is shown. React 19 doesn't warn on setState after unmount | reject |
| 13 | blind | Fragile test helpers; page.test counts 4 across the page | low | Test style only. The counts follow from the plate being controller-fed | reject |
| 14 | blind, verification-gap | The live Flow 1 run isn't done | medium | True. It runs in this entry's verification before done | reject |
| 15 | blind | The `spoken` and `releases` sets grow without limit | low | A few dozen short strings per shift | reject |
| 16 | verification-gap, edge | Own release: the NONE state arrives before the 202 and before the SSE REQUESTED, so a false "ended" notice shows | low | On one SSE stream, REQUESTED (emitted before publish) precedes the state frame. This needs the stream to drop exactly during the release POST | reject |
| 17 | edge | Epoch bumps while the POST is in flight, so the re-read is skipped | low | A stream drop inside a millisecond local POST. The fix adds an epoch-at-send guard | reject |
| 18 | edge | The tracked row is not on page 1 of the re-read | low | Needs more than 50 commands during one reconnect | reject |

## Design Notes

- **Why the epoch re-read:** TIMEOUT comes only over SSE. If the stream drops while a command is REQUESTED, the TIMEOUT frame is lost, and the buttons would stay disabled until a reload. Reading `listOverrides()` once on each reconnect is the smallest fix.
- **Keep an SSE map:** hold the last SSE `override` per `commandId` in a small ref (the last few ids), so a 202 that loses the race to its own APPLIED takes the newer status.
- **Ended on its own:** this needs the previous `state.override` in a ref, plus a set of release ids seen. It's computed on state change, never on mount.

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build -w dashboard` -- expected: all exit 0.

**Manual checks:**
- Flow 1 on `/` against the simulator and the fake controller, as in the Acceptance Criteria, with the run recorded here.

**Recorded (2026-10-24):**
- `npm run typecheck`, `npm run lint`, `npm test` (contracts 174, backend 89, dashboard 152) and `npm run build -w dashboard` all exit 0.
- `/` page tests: the "No data yet" and StaleBadge counts went from 3 to 4, because the Current plate is a fourth value fed by the controller.
- **Live run:** native Mosquitto, `npm run dev`, and the simulator from `feat/m1-5-simulator-vision` (`git archive` into the scratchpad, with a `node_modules` junction) with `--roles controller`. `/` was open in headless Edge at 1920×1080, driven over CDP: buttons clicked, Confirm pressed in the dialog, and the REPL fed through stdin.
  - **Flow 1:** after `flood on`, the L4 banner showed (5 s debounce). Corridor NS opened "Activate evacuation corridor NS? · All other approaches go red. · MDRRMO only." with focus on Cancel. After Confirm, focus went back to the pressed button. Current read "Corridor NS" beside the L4 ladder (still CURRENT) and FLOODED, with both banners up. The ack was too fast for Pending to be seen.
  - **Release:** Release opened "Release to automatic? · The controller returns to its automatic level." Current read None within 60 ms, with no ended notice.
  - **Conflict fault:** after `conflict raise`, Corridor EW gave "Rejected · Conflict fault" within 60 ms.
  - **Offline:** with the simulator quit, Corridor NS gave "Rejected · Controller offline" within 70 ms. Every controller panel, including this one, showed `STALE · 12:52:34`, and Current kept its value.
  - **Timeout:** the fake controller published state every second with `mosquitto_pub` and never acked. Flashing amber read Pending at 60 ms, then "No reply from controller in 5 s" at about 6.3 s, with the buttons re-enabled. That's about 1.3 s past the 5 s rule; the driver's synchronous `mosquitto_pub` loop blocked its polling, the same effect as story 9's 6.2 s. A late `mosquitto_pub` ack then cleared the notice.
  - **Display:** no page scroll (scrollHeight 1080). Notices have the hazard edge, never red.
- **Still open, human:** the epic's check by a second Squad C developer covers story 9 (PR #12). This entry is medium risk, so it adds no human gate.
