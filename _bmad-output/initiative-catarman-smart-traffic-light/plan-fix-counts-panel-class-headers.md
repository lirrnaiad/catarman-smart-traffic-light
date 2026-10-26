---
title: 'Fix the counts panel class headers on /'
type: 'bugfix'
ticket: ''
created: '2026-10-26'
status: 'built'
baseline_revision: '84fad22d02b84d9603a602e81db13fe722f85102'
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

**Problem:** On `/`, the "Vehicle counts this hour" headers print each class's full file label, so "Motorcycle (incl. habal-habal)" wraps over three lines. The headers' `flex-wrap` then puts some class chips on their own line and leaves others inline, so the colored squares sit at different heights (docs/prototype-screenshots/01-frontend-live-status.png).

**Approach:** Follow DESIGN.md → Counts table: a class label with a trailing parenthetical shows as a short header marked with an asterisk ("Motorcycle*"), and a footnote under the hour total explains it ("* Motorcycle includes habal-habal"), as in mockups/live-status.html. Each header puts its label above its chip and bottom-aligns, so every chip lines up in one row just above the numbers. The full label stays the header's accessible name. The fixed 1920×1080 layout of `/` must still pass `infra/scripts/check-live-layout.mjs`, with all four approach rows fully visible.

</frozen-after-approval>

## Implementation Notes

Oneshot: about 80 lines across `dashboard/src/lib/visuals.ts` (a label-splitting helper next to `classColor`, since EXPERIENCE.md keeps labels in `visuals.ts`), `components/ui/class-label.tsx` (an optional `label` override), `components/live/counts-panel.tsx` (short headers, the chip-below layout, the footnote) and their tests. `traffic-peaks.tsx` and `breach-log.tsx` keep the full label: they have room for it, and the user asked only about this panel.

- `visuals.ts`: `classLabelParts(label)` splits a trailing "(…)" aside into `short` and a footnote `note` ("incl. X" reads "includes X", any other aside stays in parentheses). `softHyphenate(text)` puts a U+00AD at known word breaks (Motor-cycle, Tri-cycle, Jeep-ney, from the mockup's `<br>`s), keeping case.
- Surprise: "MOTORCYCLE*" is 75 px in a 71 px column, and the existing `hyphens-auto` does nothing in a Chrome profile that has never downloaded its hyphenation dictionary (headless; Sean's own profile has `hyphen-data/`). The label overflowed 8 px right, against "TRICYCLE". Soft hyphens make the break deterministic and offline-safe; `hyphens-auto` stays for unknown ids.
- `class-label.tsx`: an optional `label` prop replaces the text and keeps the chip.
- `counts-panel.tsx`: each column gets `head` (short label, soft-hyphenated, plus `*`, `**`… per noted class) and `foot`. The header span is `flex-col-reverse items-end`, so the chip sits under its label and the chips share one row (all at y=244). `aria-label` on each `th` is the full file label. The footnote follows the hour total at `mt-[4px] leading-none`.
- Surprise: the two-line header pushed the W row 7 px past the table container's `overflow-hidden` edge (389 vs 382), which `check-live-layout.mjs` doesn't measure. The footnote's tight margin and leading plus a 3 px chip gap brought the container to 392, so the W row (389) shows in full. Measured the same in the normal, conflict-fault, flood (L4) and vision-STALE states.
- Tests: `classLabelParts` and `softHyphenate` in `visuals.test.ts`, the label override in `class-label.test.tsx`, and the short header, accessible name, soft hyphen and footnote (and no footnote without an aside) in `counts-panel.test.tsx`; `headers()` strips soft hyphens.
- Verified: dashboard 216 tests, typecheck, lint and build pass; `check-live-layout.mjs` exits 0 in all four states.

## Plan Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run typecheck && npm run lint && npm test -w dashboard` (repo root, nvm Node 24.22.1) -- expected: all pass
- `npm run build`, `npm start`, `npm run sim`, then `node infra/scripts/check-live-layout.mjs` -- expected: exit 0

**Manual checks (if no CLI):**
- A headless 1920×1080 screenshot of `/`: one header line per class, the five chips in one row, the footnote visible, and the W row's bottom edge inside the table's container.
- Review: the quick lens was launched twice and stopped both times without findings (a session restart, then the user's call at the 2026-10-26 23:00 deadline: no more reviews). The change ships unreviewed by a subagent; only the checks above vouch for it. Re-took docs/prototype-screenshots/01-frontend-live-status.png on the fixed build.
