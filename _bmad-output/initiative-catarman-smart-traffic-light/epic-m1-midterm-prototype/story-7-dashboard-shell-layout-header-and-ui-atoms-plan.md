---
title: 'Dashboard shell: layout, header and UI atoms'
type: 'feature'
ticket: '7'
created: '2026-10-23'
baseline_commit: 'b7d12192916a2e62b426b4613a9d8e3f055602b5'
status: 'done'
route: 'dispatch'
risk: 'low'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-1-context.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-6-dashboard-shell-config-tokens-and-live-data-layer-plan.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/ux-smart-traffic-light/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/ux-smart-traffic-light/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Entry 6's root layout renders bare children. There is no top bar, no navigation, no link health, no loader and no shared atoms, so every CAP view would invent its own frame and its own lamps and badges.

**Approach:** Build entry 7's visible frame into `layout.tsx`:
- the top bar, with the brand, the INT-01 plate and nav tabs for the five M1 routes;
- the link health bar, with a pilot per role and Sim tags, plus the L4, OVERRIDE and FAULT banners on `/` only;
- the full-screen loader and a polite live region with a hook to announce through it;
- the five atoms `LevelBadge`, `AspectLamp`, `StaleBadge`, `ClassLabel` and `ConfirmDialog`, with M1's three animations.

It creates no `page.tsx`.

## Boundaries & Constraints

**Always:**
- Visual specs come from `DESIGN.md` → Components and Layout & Spacing, with `mockups/live-status.html` (top bar, link health bar) as the composition. Behavior comes from `EXPERIENCE.md` → Component Patterns, State Patterns, Accessibility Floor and Motion. The two documents win over the mock.
- Every color comes from entry 6's tokens. Every enum label and color token comes from `visuals.ts`. Every time comes through `formatManila`. Live data comes only through entry 6's hooks.
- Nav: static `next/link` links to `/`, `/traffic/`, `/breaches/`, `/log/overrides/` and `/log/states/`, labeled Live, Traffic peaks, Breaches, Override log and State history. The current route gets `aria-current="page"`.
- Link health bar, `role="status"`:
  - Broker, Controller and Vision pilots, each with its status word from `visuals.ts`. Pilots are lit for ONLINE and CONNECTED, unlit for OFFLINE and DISCONNECTED, and unlit with a `status-ok-deep` border for STALE.
  - A Sim tag beside a role whose `source` is `sim`.
  - The right end shows "Data source · simulated (midterm)" when any source is `sim`. On `/`, the banners replace that note while any are showing.
- Banners, on `/` only, several at once allowed:
  - L4 while `state.level` is L4: "L4 · FLASHING AMBER · FLOOD".
  - Override while `state.override.mode` is not NONE: "OVERRIDE · CORRIDOR NS", or "OVERRIDE · FLASHING AMBER".
  - FAULT while `state.fault`: "FAULT · CONFLICT MONITOR". FAULT is never drawn as L4.
- The loader covers the screen until the first SSE frame of any kind, with "Loading" and "Connecting to INT-01".
- Live region: one polite `aria-live` region in the layout. `useAnnounce()` returns `announce(text)`. `StaleBadge` announces "<Role> stale" when its role turns STALE, and "<Role> live" when it recovers.
- Atoms:
  - `AspectLamp`: `color`, `lit`, `flashing`, `size`, and `stale`, which removes the glow and breathing.
  - `LevelBadge`: `level`, with the per-level pattern and name.
  - `StaleBadge`: `of` (the live role, `controller` or `vision`), plus `since`, an ISO time shown as "STALE · HH:mm:ss". It renders nothing while LIVE.
  - `ClassLabel`: `id` and `classes`. It shows the file's label, or the raw id for an unknown id, with its `classColor` chip.
  - `ConfirmDialog`: `open`, `title`, `effect`, `confirmLabel`, `onConfirm` (returns a promise) and `onCancel`.
- `ConfirmDialog` behavior:
  - `role="dialog"`, `aria-modal="true"`, labeled by its title, with focus trapped inside.
  - Focus goes to Cancel on open. Esc equals Cancel.
  - Confirm is disabled from its first press until `onConfirm` settles.
  - On close, focus returns to the element that had it before the dialog opened.
  - Only one dialog can be open.
- Motion: only the loader R→Y→G cycle, the 3.2 s lamp glow and the 1 Hz flashing amber, all inside `@media (prefers-reduced-motion: no-preference)`, with the reduced forms from EXPERIENCE → Motion.
- Every focusable control shows the focus ring (`3px solid focus`, offset 3px).
- Tests: Vitest with Testing Library under `LiveTestProvider`. Mock `next/navigation`'s `usePathname` where a test needs a route.

**Never:**
- No `page.tsx`, panels, countdown, power, boot count or other M2 field.
- No dependency, `package.json`, lockfile or contract edit.
- No edits to entry 6's files other than `layout.tsx`. Animation CSS goes in a new file under `src/components/`, not in `globals.css`.
- No remote assets and no `next/font/google`.

**Decision (user, 2026-10-23):** fonts are the DESIGN system stack only, with nothing bundled. The demo laptop runs Windows, which has Bahnschrift. This settles the epic's open question for entry 7.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Before data | no frame yet | loader shown, and the frame is hidden behind it | — |
| First frame | `link` arrives | the loader goes, and the top bar and link bar show | — |
| All online, sim | broker CONNECTED; controller and vision ONLINE, `source: sim` | three lit pilots with "Connected"/"Online", two Sim tags, the simulated note | — |
| Mixed | broker CONNECTED, controller STALE, vision OFFLINE, sources null | lit, stale-bordered and unlit pilots with their words; no Sim tags and no note | — |
| Banners on `/` | `state` with level L4, fault true, override CORRIDOR NS | three banners in the order L4, Override, FAULT; the note hidden | — |
| Banners elsewhere | the same state on `/traffic/` | no banners | — |
| State null | `state` slice is `null` | no banners | — |
| Nav | on `/breaches/` | the Breaches tab has `aria-current="page"`, no other tab does | — |
| StaleBadge | role goes LIVE → STALE → LIVE | badge "STALE · 14:32:08" while stale; "Controller stale", then "Controller live", announced politely | renders nothing while LIVE |
| ConfirmDialog | opened from a button | Cancel is focused; Tab and Shift+Tab stay inside; Esc calls `onCancel` and focus returns to the button | — |
| Confirm once | Confirm pressed twice while `onConfirm` is pending | `onConfirm` called once; Confirm re-enables when it settles | a rejected promise also re-enables |
| ClassLabel | `bus` with classes `[car]` | the raw "bus" with the `class-unknown` chip | — |
| Reduced motion | `prefers-reduced-motion: reduce` | no keyframes run; flashing amber shows as a steady lit lens with its label | — |

</frozen-after-approval>

## Code Map

- `dashboard/src/app/layout.tsx` (entry 6) -- add the frame around `{children}`, inside `LiveProvider`: loader, top bar, link bar, live region. Keep `<html lang="en">` and the metadata.
- `dashboard/src/lib/live/hooks.ts` -- `useLive("link" | "state")`, `useLiveness(role)`, and the `LiveState.slices` "first frame" signal: any slice no longer `undefined`. Expose a tiny `useFirstFrame()` from the frame component using `useLive` for all four slices; don't edit `hooks.ts`.
- `dashboard/src/lib/visuals.ts` -- `levelVisuals`, `aspectVisuals`, `linkStatusVisuals`, `brokerVisuals`, `livenessVisuals`, `sourceVisuals`, `overrideModeVisuals`, `phaseVisuals`, `faultVisual`, `colorVar`, `classColor`. Read their exact export names in the file.
- `dashboard/src/lib/time.ts` -- `formatManila(iso)`.
- `dashboard/src/lib/live/live-test-provider.tsx` -- `LiveTestProvider` with `slices`, `open`, `epoch` and `bus` props. Rerender it with new props to drive transitions.
- New files:
  - `src/components/shell/` for the frame pieces (top bar, nav, link bar, banners, loader, live region and `useAnnounce`);
  - `src/components/ui/` for the five atoms;
  - `src/components/ui/motion.css` for the three keyframe sets, imported once by the layout.

  `components/shell/` is a new area that only this story owns.
- `mockups/live-status.html` -- the top bar and link bar markup to translate into Tailwind with tokens: brand mark, title and sub-line "Edge-only adaptive signal · Catarman, Northern Samar", the INT-01 plate, tabs, pilots, Sim tag.
- jsdom has no `matchMedia` and only partial `<dialog>` support, so build ConfirmDialog as a `div` with `role="dialog"` and a manual focus trap. Test the reduced-motion row by checking that every keyframe rule in `motion.css` sits inside the media query.

## Tasks & Acceptance

**Execution:**
- [x] `dashboard/src/components/ui/{aspect-lamp,level-badge,stale-badge,class-label,confirm-dialog}.tsx` and `motion.css` -- the atoms and the three animations.
- [x] `dashboard/src/components/shell/{top-bar,link-health-bar,state-banners,loader,live-region}.tsx` -- the frame pieces and `useAnnounce`.
- [x] `dashboard/src/app/layout.tsx` -- mount the frame and `motion.css`; the content area below the two bars is 948px tall on `/` and scrolls on other routes.
- [x] Tests next to each component -- every matrix row.

**Acceptance Criteria:**
- When `npm run build -w dashboard` runs, then it exports with no error.
- Given `npm run dev -w dashboard` with no backend, when the 404 page loads at 1920×1080, then the loader shows and the page has no horizontal scroll.
- When `npm run typecheck`, `npm run lint` and `npm test` run, then all exit 0.

## Implementation Notes

## Spec Change Log

- Frozen intent renegotiated by the user (2026-10-23): `StaleBadge`'s prop `role` becomes `of`, because Biome's `useValidAriaRole` rejects a non-ARIA `role` value at every call site (review finding 1). Code was kept and renamed rather than reverted and re-planned, because the change is one prop.

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind | `StaleBadge`'s `role` prop collides with the ARIA `role` attribute | medium | Biome's `useValidAriaRole` fails every `<StaleBadge role="controller" />`, so every panel from entry 8 on needs a `biome-ignore`; the prop name is in the frozen block. Resolved by the user: renamed to `of` | intent_gap → user |
| 2 | blind, edge | `useAnnounce` drops one of two announcements in one commit and never repeats identical text | medium | `setText` keeps only the last value; a lost stream turns controller and vision STALE in the same commit, so one transition is never announced | patch |
| 3 | blind, edge | ConfirmDialog's trap fails once focus leaves the panel: a backdrop click, or Confirm disabling itself | medium | The keydown handler sits on the panel; a disabled focused button drops focus to `body`, so Esc and Tab stop working while pending | patch |
| 4 | blind | Dialog buttons use `focus:` instead of the shared `focus-visible` ring; Confirm restates the hazard gradient | low | Direct correction to the shared `focusRing` and `hazardStripes` in `styles.ts` | patch |
| 5 | verification-gap, blind | Untested: `<main>` clipping on `/` versus scrolling elsewhere, no banner for `override.mode` NONE, and the first frame of `counts` or `demand` clearing the loader | medium | Flipping the overflow ternary, dropping the NONE check, or removing a slice from `useFirstFrame` passes every test | patch |
| 6 | blind | `role="status"` on the link bar is a second implicit live region | false | EXPERIENCE → Accessibility Floor makes the link health bar `role="status"` | reject |
| 7 | blind, edge | A second dialog never takes over after the first closes | low | The override panel is the only dialog user, one at a time | reject |
| 8 | blind | Esc and Cancel still close the dialog while `onConfirm` is pending | low | The override panel shows the command as Pending either way (entry 10) | reject |
| 9 | blind | ConfirmDialog hard-codes the MDRRMO wording; `effect` renders inside a `<p>` | low | EXPERIENCE: ConfirmDialog is the only modal and exists only for overrides | reject |
| 10 | blind | The page radial gradient is duplicated; the stale pilot border is hard-coded; AspectLamp casts token names | low | Cosmetic or developer-only, with no named breakage | reject |
| 11 | blind, edge | The L4 banner always says "Flood" | false | The frozen text fixes the banner as "L4 · FLASHING AMBER · FLOOD"; L4 is the flood level | reject |
| 12 | edge | The opener is removed before the dialog closes | low | The opener is a static override button | reject |
| 13 | edge | An invalid `since` crashes StaleBadge | low | `since` comes from schema-validated `receivedAt` | reject |
| 14 | edge | A stale flashing lens keeps flashing | false | The frozen text says `stale` removes the glow and breathing; the flash is the reported aspect | reject |
| 15 | edge | A sixth class shows the unknown chip | false | DESIGN defines five class tokens | reject |
| 16 | edge | Four keyframe sets against "three animations" | false | The loader animation is the R→Y→G cycle plus its text fade (EXPERIENCE → Motion) | reject |
| 17 | edge, verification-gap, blind | No tests next to loader, banners and live region; no test of the layout mount, `motion.css` class names, UnlitHead sizes or stripes | low | Covered through the frame and link-bar tests; entry 8 re-checks the shell live; fix 2 adds a live-region test | reject |

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build -w dashboard` -- expected: all exit 0.

**Manual checks:**
- Entry 8 re-checks the header, link bar and banners against the simulator (ticket verify). Here, record the dev-server loader check.

**Recorded (2026-10-23):**
- `npm run typecheck`, `npm run lint`, `npm test` (dashboard: 15 files, 69 tests) and `npm run build -w dashboard` all exit 0. The built CSS holds the four keyframe sets and their `animation` rules only under `prefers-reduced-motion: no-preference`.
- `next dev` on a scratch port served the 404 page (`/nope/`) with no backend: the HTML has the loader (`role="status"`, "Loading", "Connecting to INT-01"), the frame behind it `inert`, one polite live region, and no `aria-current` tab. The 1920×1080 no-horizontal-scroll check in a real browser was not run; entry 8 re-checks it with the simulator.
- **After review fixes and the `of` rename (2026-10-23):** `npm run typecheck`, `npm run lint`, `npm test` (81 dashboard tests) and `npm run build -w dashboard` exit 0, with no `biome-ignore` left. The 1920×1080 browser check (no horizontal scroll, look against the mock) and the header against the simulator are re-checked in entry 8.
