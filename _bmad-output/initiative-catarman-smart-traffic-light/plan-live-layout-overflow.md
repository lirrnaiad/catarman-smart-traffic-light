---
title: '`/` fits the 1920×1080 artboard in every state'
type: 'bugfix'
ticket: ''
created: '2026-10-26'
status: 'built'
baseline_revision: 'd3af9de8a3c3fdf5a8d9a8dc161650cdc517f993'
route: 'oneshot'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Since stories 13 and 16 mounted the counts and latest-breach panels above it, the MDRRMO override panel gets 260 of the right column's 904 px. Its 2×2 buttons are 33 px tall for labels that need 37 px (two lines) and 56 px (three lines). When a notice shows (rejected, controller offline, timeout, ended on its own), the grid drops to 23 px, the rows overlap and the hit tests fail: a click on "Evacuation corridor — NS" sends Release, and one on "Flashing amber" sends Corridor EW. In the left column at L4 or FAULT, both phase cards wrap "Flashing amber" to two lines (Signal state 282 → 363 px), so the column's content is 964 px in 904 and the Flood sensor panel's conflict-fault row is clipped. Measured in headless Chrome at 1920×1080 on `d3af9de`.

**Approach:** Make each column's content fit its 904 px in every state, with no button shrinking below its label, by taking space from the panels with slack rather than from the override buttons:

- **Right column (user, 2026-10-26, option A):** the override panel takes its content height and never shrinks, so each button is as tall as its label (three lines are fine, and the copy and the Current row stay as designed). The counts panel becomes the column's flexible panel: its table rows flex between about 48 px and a compact minimum, absorbing whatever the override panel needs. A notice takes the footer line's slot ("Every override asks for confirmation first" hides while a notice shows), so a notice never overlaps or shifts the buttons.
- **After review (user, 2026-10-26):** the pressed button shows "Pending · waiting for controller" in its label's place (the icon stays, and the label stays in its accessible name), so a press never grows the panel. The tightened spacing stays: button padding 4 px, the Current value at 17 px, 8 px gaps inside the override panel, and in the flood panel 42 px cells, a 4 px caption gap and 5 px fault-row padding.
- **Left column (user, 2026-10-26, option A):** "Flashing amber" stays on one line in the phase cards, its type scaled to the card's width (container-relative units, at most 42 px) for that aspect only. Other aspects keep 42 px.

</frozen-after-approval>

## Implementation Notes

Oneshot route: about 80 lines across `override-panel.tsx`, `counts-panel.tsx`, `signal-state-panel.tsx` and their tests. It is layout only, and no state logic, API or contract changes.

- **Why the column was over budget:** the mock's own right column is 27 px over (counts 419 + breach 186 + override 286 + gaps = 931 of 904). Story 10 checked the panel at 1920×1080 before stories 13 and 16 mounted the counts and breach panels above it.
- **Right column** (`override-panel.tsx`, `counts-panel.tsx`): the override `section` is `shrink-0` at its content height. Its grid lost `min-h-0 flex-1 auto-rows-fr`, so each row is as tall as its tallest label. The counts `Panel` is `min-h-0 flex-1`, and its table sits in a `min-h-0 flex-1 overflow-hidden` wrapper at `h-full`. Cells are a `h-[30px]` minimum with `leading-none`, which the approach letters needed too, since they inherited 1.5. The 5 px row spacing is now 3 px. To make the numbers close, the override panel was tightened: buttons `py-[4px]` (66 px for the three-line labels), the Current chip 17 px (the mock's size) with `py-[4px]`, and 8 px gaps. The panel went from 260 to 308 px, and the counts rows from about 48 to 35 px.
- **Notice slot:** a notice renders in place of the footer line, in a `min-h-[28px]` one-line slot. "Corridor ended — link loss or fault", the longest, fits on one line.
- **Pending placement** (my choice, not the user's): "Pending · waiting for controller" now replaces the button's visible label, and the label stays as `sr-only` text in the button's name. As a caption under a corridor label it wrapped to four lines, grew the row by 58 px and clipped the counts table's E and W rows. Story 10's frozen rule, and EXPERIENCE, only say the pressed button "reads" Pending. The caption-under-label placement was that build's own note.
- **Left column** (`signal-state-panel.tsx`): the phase card's text box is `min-w-0 flex-1 [container-type:inline-size]`. FLASHING_AMBER gets `whitespace-nowrap` and an inline `fontSize: min(42px, 11.5cqi)` (about 38 px in a 328 px box). The inline style is there because two Tailwind font-size utilities would race on CSS order.
- **Flood panel** (`flood-fault-panel.tsx`): during the 5 s WET debounce its caption pushed the left column to 907 of 904 px, so the fault row spilled 3 px. That predates this change. Cells went from 46 to 42 px, the caption gap from 6 to 4 px, and the fault row's padding from 7 to 5 px.
- **Measured** in headless Chrome at 1920×1080 against `npm run dev` and the simulator: L1, FAULT, FAULT + WET, L4 FLOODED, L4 + corridor active, corridor Pending (fake controller), the conflict-fault notice and the ended-on-its-own notice. Every time `main` read 948/948, the right column 376/181/308, the left 282/339/244, all four hit tests passed, and the fault row was inside its panel.
- **Tests:** a Pending assertion (label `sr-only`, name kept), a test that a notice takes the footer's slot and the footer comes back, and a one-line assertion for Flashing amber.
- **Flaky, not caused here:** `breach-log.test.tsx` › "?id= marks a row that Load more brings in, scrolling once" failed once in about eight full dashboard runs on this branch, under load from the dev server, simulator and Chrome. It passed 8 of 8 alone and 3 of 3 full runs on `main`, and 3 of 3 full runs on this branch afterwards. This change doesn't touch the breach log.

## Review Triage Log

Quick lens, pass 1: 5 findings. high 0, medium 2, low 2, false 0, maybe-false 0, plus 1 real but latent.

- **medium (HALT, then user decision): Pending replaced the label, against the frozen "including the Pending caption".** It's real: the caption under a corridor label grew the row by 58 px and clipped the counts table's E and W rows. The user kept Pending in the label's place and recorded it in the Intent.
- **medium (HALT, then user decision): space came from the override and flood panels, beyond the approved intent.** It's real: the counts panel alone couldn't absorb about 350 px of override. The user kept the tightening and recorded it in the Intent.
- **low, latent (defer): the counts wrapper's `overflow-hidden` clips the bottom rows with no sign once the column runs out.** No measured state reaches it: the rows stay at 35 px against a 30 px minimum, leaving about 20 px of slack. It goes to deferred-work for a check against the demo laptop's fonts.
- **low (defer, a spec edit): DESIGN.md still says the override panel fills the right column and that count rows are 5 px apart.** It goes to deferred-work for `bmad-ux`.
- **low (patch): the Flashing amber test didn't check the fitted size, or that other aspects keep 42 px.** I added a `font-size: min(42px` assertion and a GREEN/RED test with no fitted size and no `whitespace-nowrap`. Both pass.

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build -w dashboard` -- expected: all pass.

**Manual checks (if no CLI):**
- In headless Chrome at 1920×1080 against `npm run dev` and the simulator, run the scratchpad measuring script at L1, L4, FAULT, override active, Pending and each notice (`/tmp/claude-1000/-home-lirrnaiad-vscode-smart-traffic-light/be180b1a-3f4d-4e66-a634-5c0c739b207f/scratchpad/rehearsal/measure.mjs` with `app-steps.js`). In every state, `main` has scrollHeight ≤ clientHeight (948), each override button's centre hits that button, no button is shorter than its label, and the fault row's bottom is inside its panel.
