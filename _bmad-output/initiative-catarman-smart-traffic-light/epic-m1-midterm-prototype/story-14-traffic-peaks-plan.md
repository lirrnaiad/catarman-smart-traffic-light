---
title: 'Traffic peaks'
type: 'feature'
ticket: '14'
created: '2026-10-24'
baseline_commit: '20295524e4df61e319f41584f01e29f8042a7f4d'
status: 'done'
route: 'dispatch'
risk: 'low'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-1-context.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-12-history-vehicle-counts-and-the-counts-slice-plan.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Entry 12 stores crossings and buckets them by Asia/Manila hour, but nothing serves the buckets and `/traffic/` doesn't exist, so in Flow 2 the enforcer can't see the day's busiest hour.

**Approach:** Build CAP-4 per AD-6, AD-8, AD-9, AD-12 and the Dashboard time convention:
- `GET /api/counts/hourly` through entry 12's `hourlyCounts`;
- `/traffic/`, with 24 hour bars stacked by vehicle class in Recharts, the peak hour flagged, today's current bar following the live `counts` slice, and `?date=` day navigation.

## Boundaries & Constraints

**Always:**
- **Route** (`http/routes/counts.ts`): `GET /api/counts/hourly?date=YYYY-MM-DD` parses `HourlyCountsQuery` (a bad date is 400 `VALIDATION_FAILED`) and returns `hourlyCounts(pool, date)` unchanged. With no `date`, it uses today in Asia/Manila. One alphabetical registration line in `routes/index.ts`.
- **Client** (`lib/api/counts.ts`): `getHourlyCounts(date)` through `apiGet` with the `HourlyCounts` schema.
- **Page** (`app/traffic/page.tsx`, mounting `components/traffic/traffic-peaks.tsx` inside `<Suspense>`, since it calls `useSearchParams`):
  - The day is `?date=` when it is a valid `YYYY-MM-DD`, else today in Asia/Manila (computed with `Intl` and `timeZone: 'Asia/Manila'`, never offset arithmetic).
  - A date plate shows the day ("Thu 22 Oct 2026") with a "Today" flag on today. "Prev day" and "Next day" are links to `/traffic/?date=…`; "Next day" is disabled on today.
  - The day loads on entry, on each stream epoch and on each date change.
  - **Chart:** Recharts stacked bars inside a well, one bar per hour labeled by `manilaHourLabel(hourStart)`, one stack per class in `useVehicleClasses()` file order (then any unknown ids), summed over the four approaches, colored with `classColor` through `colorVar`. Axis labels in `caption` `text-3`, gridlines `edge-light`, never signal colors. A legend lists the classes.
  - **Peak:** the hour with the largest total (the earliest on a tie) is flagged by a plate, "Peak 17:00 · 248 vehicles", with a leader line to its bar.
  - **Live hour:** when the day is today and the `counts` slice's `hourStart` is one of its hours, that bucket is replaced by the slice, so the bar grows live. It is marked LIVE with a dashed cap, and a plate reads "Live · N so far". The peak includes it.
  - **Accessibility:** the chart SVG has an `aria-label` naming the peak, and a visually hidden table lists every hour's class counts and total.
  - **States:** while loading, "Loading traffic…"; a day whose 24 totals are all 0 reads "No vehicles counted." in place of the chart; a REST failure shows an inline notice with the error code.
- **Tests:** the route with Supertest against `stl_test` (a seeded day, default date, bad date); the page component with `LiveTestProvider` and a stubbed `fetch`, asserting through the hidden table and the plates.

**Never:**
- No approach-totals panel, "Day so far" or "AM peak" stats from the mockup, and no PCU.
- No edits to `services/counts.ts`, the counts repositories, contracts, migrations, `package.json` or the lockfile; no dependency (Recharts is installed).
- No edits to the shell, `lib/time.ts` or `lib/visuals.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Seeded day | `GET /api/counts/hourly?date=D` | 24 buckets; totals equal the `vehicle_count` sums for D's Manila hours | — |
| Default date | no `date` | today in Asia/Manila | — |
| Bad date | `date=2026-13-40` | 400 `VALIDATION_FAILED` | — |
| Bars | buckets with car and tricycle | 24 bars, stacks in file order, hour labels 00:00–23:00 | — |
| Peak | totals peak at 17:00 (248) | "Peak 17:00 · 248 vehicles" | — |
| Peak tie | 07:00 and 17:00 equal | 07:00 flagged | — |
| Live hour | today, slice for 18:00 with total 163 | 18:00 bucket replaced; "Live · 163 so far"; dashed cap | — |
| Other day | `?date=` yesterday, slice for today | slice ignored; no Live plate; Next day enabled | — |
| Today | no `?date=` | "Today" flag; Next day disabled | — |
| Bad `?date=` | `?date=xyz` | today | — |
| Empty day | all totals 0 | "No vehicles counted." | — |
| REST failure | 500 | inline notice with the code | — |
| Epoch | stream epoch increments | the day reloads | — |

</frozen-after-approval>

## Code Map

- **Branch:** `feat/m1-14-traffic-peaks` is story 12's branch (1.2, 1.3, 1.5, 1.12) with `feat/m1-7-dashboard-shell-frame` (1.6, 1.7) merged in. It has no `page.tsx` yet.
- **Contracts (read only):** `contracts/src/api/counts.ts`: `HourCounts`, `HourlyCounts` (`{date, buckets: HourCounts[24]}`), `HourlyCountsQuery` (`date?: z.iso.date()`).
- **Backend:**
  - `services/counts.ts` `hourlyCounts(pool, date)` returns 24 dense buckets for a Manila date; `manilaHourStart(now)`. Reuse; don't edit.
  - `http/routes/index.ts`: add `counts` alphabetically. `routes/vehicle-classes.ts` is the route shape; `AppDeps {pool, hub, publisher, getLink}`; `ZodError` maps to 400 in the error middleware.
  - Tests: `test/reset-db.ts`, `services/counts.test.ts` (inserting `vehicle_count` rows against `stl_test`). The seed is `backend/db/seed/01-vehicle_count.sql` (24 h of demo counts, `npm run db:seed`).
- **Dashboard:**
  - `lib/api/client.ts` (`apiGet`, `ApiRequestError {code}`), `lib/live/hooks.ts` (`useLive("counts")`, `useStreamEpoch`), `lib/live/live-test-provider.tsx`, `lib/time.ts` (`manilaHourLabel`, `formatManila`), `lib/visuals.ts` (`classColor(id, classes)`, `colorVar`), `lib/use-vehicle-classes.ts`, `components/ui/styles.ts` (`stencil`, `focusRing`).
  - The nav already links `/traffic/` (`components/shell/top-bar.tsx`). `recharts` 3.10.1 is a dashboard dependency.
  - Recharts measures nothing in jsdom; give the chart fixed pixel dimensions (the 1920×1080 target is fixed) and assert through the hidden table.
- **Mockup:** `_bmad-output/initiative-catarman-smart-traffic-light/ux-smart-traffic-light/mockups/traffic-peaks.html` (date controls, chart well, peak and live plates, legend). DESIGN: Hourly chart.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/http/routes/counts.ts` -- the hourly route, plus its registration line.
- [x] `dashboard/src/lib/api/counts.ts` -- `getHourlyCounts`.
- [x] `dashboard/src/components/traffic/traffic-peaks.tsx`, `dashboard/src/app/traffic/page.tsx` -- the page.
- [x] Tests -- every matrix row.

**Acceptance Criteria:**
- Given `npm run db:seed`, the broker, `npm run dev` and the simulator's vision role, then `/traffic/` shows 24 bars whose totals equal the `vehicle_count` sums for the same Asia/Manila hours, flags the peak hour, and today's current bar grows as counts arrive.
- Given "Prev day" back to a day with no rows, then the page reads "No vehicles counted."
- `/traffic/` fits 1920×1080 with no page scroll.
- When `npm run typecheck`, `npm run lint`, `npm test` and `npm run build -w dashboard` run, then all exit 0.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind | When the live hour rolls over, the previous hour's bar falls back to the value fetched at mount | medium | The day loads only on mount, date and epoch; the old bucket loses up to an hour of counts and the peak can be wrong in the demo | patch |
| 2 | blind, edge | A future `?date=` shows an empty day with "Next day" enabled indefinitely | low | `HourlyCountsQuery` accepts any date; the fix is a direct comparison with today | patch |
| 3 | verification-gap, blind | Day navigation while mounted is untested | medium | Pre-verified: trimming the effect's deps to `[epoch]` passes every test | patch |
| 4 | verification-gap | "Today" is untested when the UTC and Manila dates differ | medium | Pre-verified: replacing `formatManila` with `toISOString().slice(0, 10)` passes every test; the page would open on yesterday from 00:00 to 08:00 Manila | patch |
| 5 | edge, blind | The live hour's dashed cap (a matrix row) is not asserted | low | Only the plate text is checked | patch |
| 6 | blind | The hidden table's `<th>` cells have no `scope` | low | Accessibility floor; a direct attribute | patch |
| 7 | blind | A page left open over Manila midnight stays on yesterday | low | With #1, the new hour's slice re-renders the page, which recomputes today and loads the new day | reject |
| 8 | blind, edge, verification-gap | A failed class list is silent: raw ids, unknown color, empty legend, and no test | low | Raw ids in the neutral color are the Unknown id pattern; the classes request is the shell's | reject |
| 9 | blind | An empty `?date=` is 400 on the server but today on the client | low | The page never sends an empty date | reject |
| 10 | verification-gap, blind | The legend, the leader line and unknown-id order are untested | low | Visual; the hidden table pins class order, and the live run shows the legend | reject |
| 11 | blind | The route test doesn't parse the body with `HourlyCounts` | low | `hourlyCounts` density is entry 12's, tested there; the client parses with the schema | reject |
| 12 | blind | The live-hour test total (263) differs from the matrix example (163) | false | The matrix gives an example value; the behavior asserted is the same | reject |
| 13 | blind | The chart's `aria-label` omits the live hour; the date plate isn't a live region | low | The plate's "Live · N so far" is on screen and in the table; navigation is a page change | reject |
| 14 | blind | The fixed chart size isn't checked to fit | low | The build agent's run measured no page scroll; re-checked live | reject |
| 15 | blind, edge | A failed epoch reload replaces the chart with the notice | low | The REST failure pattern asks for the notice; a reload failure also means the stream just dropped | reject |
| 16 | edge | `?date=` with a year below 100 navigates to 19xx | low | Nobody types year 0050; the page falls back on nothing worse than an odd day | reject |
| 17 | edge | A date before 1000-01-01 may make MySQL return 500 | low | Unverified and unreachable from the page | reject |

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build -w dashboard` -- expected: all exit 0.

**Manual checks:**
- The Acceptance Criteria in headless Edge at 1920×1080, comparing the hidden table's totals with a SQL sum over `vehicle_count` grouped by `HOUR(CONVERT_TZ(occurred_at,'+00:00','+08:00'))` for the same day.

**Results (2026-10-24):**
- Implementer, before review: in headless Edge at 1920×1080 after `npm run db:seed`, the hidden table's totals for 2026-10-24 matched a SQL sum over `vehicle_count` grouped by `HOUR(CONVERT_TZ(occurred_at,'+00:00','+08:00'))` for all 19 hours with rows; the page flagged "Peak 17:00 · 3032 vehicles"; `?date=2026-10-01` read "No vehicles counted."; no page scroll (after moving the hidden table inside an `sr-only` div). The broker was down during that run, so the live bar read "Live · 0 so far"; live replacement rests on the unit tests.
- After review fixes: `npm run typecheck`, `npm run lint`, `npm test` (contracts 174, backend 72, simulator 68, dashboard 95) and `npm run build -w dashboard` exit 0.
- Not done: a re-run of the live check after the review fixes, with the simulator feeding the live bar. Port 4000 was held by an orphaned backend from an earlier agent run (PID 13780), which this session was not permitted to stop.
