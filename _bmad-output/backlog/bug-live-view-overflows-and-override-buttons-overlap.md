---
id: 2
type: bug
title: "The live view overflows and its override buttons overlap at 1920×1080"
parent: none
covers: [CAP-3, CAP-5]
after: []
assignee: ""
refined: true
hitl: false
risk: medium
severity: P1
---

# The live view overflows and its override buttons overlap at 1920×1080

## Description

On `/` at 1920×1080, the MDRRMO override buttons shrank and overlapped while a notice showed, so pressing Corridor NS sent Release. The page scrolled, which EXPERIENCE bans, and at L4 the left column clipped the conflict-fault row. Every state should fit the artboard, with each button's centre hitting that button.

## Reproduction

1. `main` at `d3af9de`: `npm run dev`, then `npm run sim`, and `/` in headless Chrome at 1920×1080.
2. `conflict raise`, then press Corridor NS and confirm, so the "Rejected · Conflict fault" notice shows.
3. **Actual:**
   - the 2×2 buttons drop to about 23 px, and their rows overlap;
   - the point at the centre of "Evacuation corridor — NS" is "Release to automatic";
   - `main` scrolls (scrollHeight 993 > clientHeight 948).
   
   **Expected:** no scroll, and each button's centre hits that button.
4. `level L4`. **Actual:** both phase cards read "Flashing amber" on two lines, and the conflict-fault row is clipped below the left column. **Expected:** the fault row is fully visible.

## Cause Hypothesis

Stories 13 and 16 mounted the counts and latest-breach panels above the override panel after story 10 checked it. The right column's content then exceeded its 904 px, and the mock itself was 27 px over. The override grid flexed to fill whatever was left. In the left column, "Flashing amber" wrapping to two lines pushed the column past its height.

## Acceptance Criteria

1. **The expected behavior holds**
   **Given** `/` at 1920×1080 against the simulator
   **When** it shows L1 to L4, FAULT, an active override, Pending, and each notice
   **Then** `main` doesn't scroll, every override button's centre hits that button with no overlap or overflow, and the fault row is fully visible
2. **Tests cover the condition found and fixed**
   **Given** the dashboard test suite
   **When** it runs
   **Then** tests cover Pending in the label's place, a notice taking the footer's slot, and "Flashing amber" on one line
3. **Or: no change is needed, with proof**
   **Given** the reproduction
   **When** it is run on the current code
   **Then** the expected behavior already holds, with the evidence recorded in Notes; this supersedes 1 and 2

## References

- parent — none
- design — _bmad-output/initiative-catarman-smart-traffic-light/ux-smart-traffic-light/DESIGN.md, Layout & Spacing and Components (MDRRMO override panel)
- retrospective — _bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-m1-midterm-prototype-retrospective.md, findings F1, F2 and F5

## Notes

- Decision: filed after the fact, at M1's closure, so the fix is in the ticket tree (user, 2026-10-26).
- Fixed in PR #22 (`8007e4b`). Its build plan, first written at the initiative root as `plan-live-layout-overflow.md`, now sits beside this ticket as its plan, and `deferred-work.md` points there. The retrospective still cites the old path, as it stood when it was written.
- Verified in the M1 demo run (`docs/m1-demo.md`, check 3) and again by the 1.17 sweep, in 20 states at 1920×1080. `node infra/scripts/check-live-layout.mjs` now runs the same check.
