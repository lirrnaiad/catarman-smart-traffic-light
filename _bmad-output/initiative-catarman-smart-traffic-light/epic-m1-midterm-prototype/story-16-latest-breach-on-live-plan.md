---
title: 'Latest breach on /'
type: 'feature'
ticket: '16'
created: '2026-10-24'
baseline_commit: 'd744fd30c091af6761edf68cdcb9b60b37e94a97'
status: 'done'
route: 'oneshot'
risk: 'low'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/` has no breach panel, so in Flow 2 the enforcer can't see the latest red-light breach next to the live signal.

**Approach:** Mount CAP-6's Latest breach card in `/`'s right column, between entry 13's counts slot and the MDRRMO override slot, from `components/breach/latest-breach.tsx` and one line in `app/page.tsx`:
- It is a `Panel` (`components/live/panel.tsx`) titled "Latest breach" with the tag "Red-light running · anonymized", fed by the `vision` role, so `useLiveness('vision')` STALE swaps the tag for the StaleBadge and the last breach stays shown (Staleness convention).
- It loads `listBreaches({limit: 1})` (entry 15's `lib/api/breaches.ts`) on mount and on each stream epoch, and each SSE `breach` replaces it.
- It shows entry 15's `CropThumb` at DESIGN's 156×104, then `occurredAt` through `formatManila` in `display-time`, then the approach label and the class (`ClassLabel`) in `label-row` `text-2`. No other fields.
- The whole card body is one link to `/breaches/?id=<id>` with the focus ring and an accessible name naming the breach.
- With no breach: "No breaches recorded." A REST failure: an inline notice with the error code; the rest of `/` is unaffected.
- Tests with `LiveTestProvider`: load, live replace, epoch reload, empty, failure, link target, STALE. `app/page.test.tsx` stubs `fetch` so the existing `/` tests keep passing.
- No edits beyond `components/breach/latest-breach.tsx`, its test, the mount line and the `page.test.tsx` stub.

</frozen-after-approval>

## Implementation Notes

- **Branch:** `feat/m1-16-latest-breach` is story 15's branch (#16) with `feat/m1-8-live-signal-state` (#11) merged in (baseline `d744fd3`), so `/` and `components/live/panel.tsx` exist.
- **Files:** `components/breach/latest-breach.tsx` and its test, one import and one mount line in `app/page.tsx` (replacing the entry 16 comment), and `app/page.test.tsx`: a `fetch` stub that never answers, plus the "No data yet" check scoped to the three controller panels, since the card shows its own "No data yet" while loading.
- **Reload vs live:** a reload answer older than a live breach that landed while it was in flight is ignored (`receivedAt` compared as ISO strings, which the API always emits in one format).
- **Link:** `next/link` to `/breaches/?id=<id>`. Vitest doesn't load `next.config`'s `trailingSlash`, so the test normalizes the `/` before `?`; the live run confirms the built href.

## Review Triage Log

| # | Finding | Verdict | Evidence | Route |
|---|---------|---------|----------|-------|
| 1 | The REST error notice stays up after a live breach arrives | low | `setError(null)` ran only on a successful reload; a direct correction, now tested | patch |
| 2 | The live handler doesn't apply the `newer()` check | false | Occurrences are sent once, when they happen (AD-8); the hub never replays, so a live breach is always the newest | reject |
| 3 | `newer()` compares ISO strings | false | `receivedAt` always comes from `Date.toISOString()` in `services/breaches.ts`, one fixed format | reject |
| 4 | Each page load fetches twice (epoch 0, then 1) | low | Real, but harmless (one extra `limit=1` request); `breach-log.tsx` does the same, and skipping epoch 0 would leave the card empty if the stream never opens | reject |
| 5 | No test for the error notice clearing | low | Covered by the patch for #1 | patch |
| 6 | `page.test.tsx` never checks the card on `/` | low | The card has its own tests; the live run checked it on `/` | reject |
| 7 | The aria-label repeats the class lookup; a classes failure is silent | low | An unknown id shown raw is the Unknown id pattern; the shell's hook owns the classes failure | reject |
| 8 | The rejection handler may receive a non-`ApiRequestError` | false | `lib/api/client.ts` wraps every failure, including network errors, in `ApiRequestError` | reject |
| 9 | The STALE test covers STALE only at mount | low | The transition is `Panel`'s behaviour, tested in entry 8; the live run showed it on `/` | reject |
| 10 | No test for the same breach id twice or an older live breach | false | Same as #2 | reject |

## Verification

- `npm run typecheck`, `npm run lint`, `npm test` (contracts 174, backend 104, simulator 68, dashboard 132) and `npm run build -w dashboard` exit 0.
- Live (2026-10-24), headless Edge at 1920×1080 against the broker, `npm run dev` and the simulator's vision role:
  - `/` showed the newest stored breach (no crop, "No crop"), linking `/breaches/?id=<the API's newest id>`.
  - `emit-breach N motorcycle` replaced it within 40 ms of the REPL line, with the blurred 64×48 crop.
  - Clicking the card opened `/breaches/?id=…` with that row (the top one) marked.
  - Quitting the vision role marked the card `STALE · <time>` and kept the last breach.
  - `/` fits 1920×1080 with no scroll (`scrollHeight` 1080, `scrollWidth` 1920).
