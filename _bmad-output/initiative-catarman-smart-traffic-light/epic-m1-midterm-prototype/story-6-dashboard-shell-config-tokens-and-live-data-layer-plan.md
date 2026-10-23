---
title: 'Dashboard shell: config, tokens and live data layer'
type: 'feature'
ticket: '6'
created: '2026-10-23'
status: 'draft'
route: 'dispatch'
risk: 'medium'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-1-context.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/ux-smart-traffic-light/DESIGN.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/ux-smart-traffic-light/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `dashboard/` has only its `package.json`, `tsconfig.json` and `vitest.config.ts`. No CAP view can render tokens, read live data or call the API until the shell's non-visual half exists. CAP-3 needs views that update without a reload.

**Approach:** Build entry 6:
- the static-export Next.js config, the PostCSS config, and `globals.css` with every DESIGN.md token as a Tailwind v4 `@theme` variable;
- the committed `.env.development` and `.env.production`;
- a minimal root layout that mounts `LiveProvider` once;
- `src/lib/`: `config.ts`, `api/client.ts`, `time.ts`, `use-vehicle-classes.ts`, `visuals.ts`;
- `src/lib/live/`: `LiveProvider` with `useLive`, `useLiveEvent`, `useStreamEpoch` and `useLiveness`, plus `LiveTestProvider`.

## Boundaries & Constraints

**Always:**
- AD-9:
  - `next.config.ts` sets exactly `output: 'export'`, `trailingSlash: true` and `allowedDevOrigins: ['127.0.0.1']`.
  - No route handlers, server actions, proxy, rewrites, cookies, dynamic routes, remote assets or `next/font/google`.
  - No dashboard file imports `mysql2`, `mqtt`, `backend/` or `contracts/vehicle-classes.json`.
- `src/lib/config.ts` reads the literal `process.env.NEXT_PUBLIC_API_URL`. `.env.development` holds `http://127.0.0.1:4000` and `.env.production` holds an empty value, meaning same-origin.
- Every shape comes from `@stl/contracts`. Every SSE frame and REST response is parsed with its schema. An invalid frame is dropped with a `console.warn` that names the event and the issue paths, never the data.
- AD-8:
  - One `EventSource` per tab, on `apiUrl("/api/stream")`, with one listener per key of `streamSchemas`.
  - Slices replace their value, never merge. Occurrences go only to `useLiveEvent` handlers and never into React state.
  - The epoch increments on every `open`. On a reconnect, slices keep their last value until a new frame replaces them.
- Staleness:
  - `useLiveness(role)` is `LIVE` only while the stream is open, `link.broker` is `CONNECTED` and `link[role].status` is `ONLINE`. Otherwise it is `STALE`, including before the first `link`.
  - Nothing blanks a value.
- `time.ts` uses only `Intl` with `timeZone: "Asia/Manila"`, never offset arithmetic:
  - `formatManila(iso)` gives a 24-hour `HH:mm:ss`, and `formatManila(iso, "date")` gives `YYYY-MM-DD`;
  - `manilaHourLabel(hourStartIso)` gives `HH:00`.
- `visuals.ts` is the only source of labels and color tokens for every enum family in the spine's Consistency Conventions.
  - Every value has an entry: an exhaustive `Record` typed from the contract enum.
  - Level labels are exactly "L1 Vision adaptive", "L2 Stop-bar presence", "L3 Fixed timing", "L4 Flashing Amber". Aspect labels are "Green", "Yellow", "Red", "Flashing amber", "Dark". The rest follow EXPERIENCE → Voice and Tone.
  - Colors follow EXPERIENCE → Signal Semantics: red, yellow and green only for aspects; link status in `status-*`; L4 and FAULT in `hazard-*`; never a signal hue elsewhere.
  - `classColor(id, classes)` gives the i-th class in `classes` the i-th class token in DESIGN order (car, tricycle, motorcycle, jeepney, utility van), and anything else `class-unknown`.
- `useVehicleClasses()` loads `GET /api/vehicle-classes` once per page load, shared by every caller, and returns `{classes, error}`.
- The API client exposes `apiGet(path, schema)`, `apiPost(path, body, schema)`, `apiList(path, itemSchema, query?)` and `apiUrl(path)`. A non-2xx response throws an error that carries the `ApiError` `code` and `message`, or `INTERNAL` when the body isn't an `ApiError`.
- Tests are Vitest with jsdom and Testing Library, with a fake `EventSource`. Only `LiveProvider` touches `EventSource`.

**Never:**
- No `page.tsx`, header, navigation or UI atoms. Entry 7 builds those.
- No M2 rendering, no SWR, TanStack Query, Redux or Zustand, no new dependency, no `package.json` or lockfile edit, and no contract edit.
- No minting of UUIDs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Connect | stream opens, then `link`, `state` = null, `counts`, `demand` frames | epoch 1; `useLive` returns each parsed value; `state` is `null` | — |
| Slice replace | a second `demand` frame | the value is the new frame, not a merge | — |
| Occurrence | a `breach` frame | each `useLiveEvent("breach", h)` handler is called once with the parsed `BreachItem`; no re-render from state | — |
| Bad frame | invalid JSON, or a schema failure on any event | dropped; `console.warn` names the event and the paths; the last good value stays | never throws |
| Reconnect | `error`, then `open` again | `useLiveness` is STALE while closed; epoch 2 after reopen; slices keep their last values | — |
| Liveness | open stream, broker CONNECTED, controller ONLINE, vision STALE | `useLiveness("controller")` LIVE, `useLiveness("vision")` STALE | broker DISCONNECTED → both STALE |
| REST error | 409 with an `ApiError` body; 500 with an HTML body | throws with code `CONTROLLER_OFFLINE`; throws with code `INTERNAL` | — |
| apiUrl | base `http://127.0.0.1:4000` or `""`; path `/api/breaches/x/crop` | `http://127.0.0.1:4000/api/breaches/x/crop`, or `/api/breaches/x/crop` | — |
| Manila time | `2026-10-23T06:32:08.000Z` | `formatManila` → `14:32:08`, `"date"` → `2026-10-23`; `manilaHourLabel("2026-10-23T16:00:00.000Z")` → `00:00` | — |
| Class color | classes `[car, tricycle]`; ids `tricycle`, `bus` | `class-tricycle`; `class-unknown` | — |

</frozen-after-approval>

## Code Map

- `contracts/src/api/stream/index.ts`:
  - `streamSchemas` gives the event names in hub order (`link`, `state`, `counts`, `demand`, then `breach`, `override`, `speedAlert`), and `StreamName` and `StreamData<N>` come from it;
  - the slices are `link`, `state`, `counts` and `demand`, and `state`, `counts` and `demand` are nullable;
  - `LinkSlice` has `broker` and `controller`/`vision` `.status`.
- `contracts/src/api/common.ts`: `ApiError`, `Page(item)`, `VehicleClass`, `Health`. `contracts/src/enums.ts` has every enum family for `visuals.ts` (Rejection reason is an open string, so give the known codes labels and let any other code show raw).
- `contracts/package.json` exports `.` as TS source. Next must transpile it: `transpilePackages: ["@stl/contracts"]` is allowed beside the three AD-9 keys.
- `dashboard/package.json`:
  - Next 16.4.2, React 19.3, Tailwind 4.3 with `@tailwindcss/postcss`, Testing Library and jsdom;
  - `vitest.config.ts` uses jsdom with `globals: true` and includes `src/**/*.test.{ts,tsx}` and `test/**`;
  - `tsconfig.json` includes `next-env.d.ts`, which `.gitignore` ignores.
- Root `.gitignore` already lets the two dashboard `.env.*` files be committed, and ignores `.next/`, `out/` and `next-env.d.ts`.
- `DESIGN.md` frontmatter:
  - `colors` → `--color-<key>`;
  - `typography` → `--font-stencil` and `--font-body`, plus each ramp entry as `--text-<name>` with `--line-height`, `--letter-spacing` and `--font-weight` sub-variables;
  - `rounded` → `--radius-<key>`, with `DEFAULT` as `--radius`;
  - `spacing` → `--spacing-<key>`;
  - `components` are component recipes, not tokens. Entry 7 uses them.
  - Start the theme with `--color-*: initial`, so no Tailwind default hue can leak (Signal Semantics). Use `@theme static`, so `var(--color-…)` from `visuals.ts` always resolves.
- Every file in this story is new. Nothing exists under `dashboard/src/` yet.
- The `epic-1-context.md` copied onto this branch is byte-identical to the one in PR #6.

## Tasks & Acceptance

**Execution:**
- [ ] `dashboard/next.config.ts`, `dashboard/postcss.config.mjs`, `dashboard/.env.development`, `dashboard/.env.production` -- the AD-9 config and the API URLs.
- [ ] `dashboard/src/app/globals.css` and `dashboard/src/app/layout.tsx` -- every token in `@theme`, the base `body` on `surface-page` with `font-body` and `text`; `<html lang="en">`; a layout whose `<body>` wraps its children in `LiveProvider`.
- [ ] `dashboard/src/lib/config.ts` and `dashboard/src/lib/api/client.ts` -- the API base, `apiUrl`, `apiGet`, `apiPost`, `apiList`, and the error carrying `code`.
- [ ] `dashboard/src/lib/time.ts`, `dashboard/src/lib/visuals.ts`, `dashboard/src/lib/use-vehicle-classes.ts` -- as in Boundaries. `visuals.ts` exports a lookup per family (`{label, token}`), `colorVar(token)` → `var(--color-<token>)`, and `classColor`.
- [ ] `dashboard/src/lib/live/` -- `LiveProvider`, the four hooks, and `LiveTestProvider`. A test can set slices, stream open or closed, and the epoch, and can fire occurrences through the same hooks.
- [ ] Tests next to each module -- every matrix row; every enum value has a non-empty label (a loop over each contract enum's options); a render under `LiveTestProvider`.

**Acceptance Criteria:**
- When `npm run build -w dashboard` runs with no backend, then it exports to `dashboard/out/` with no error and no warning about a disallowed feature.
- Given `npm run dev -w dashboard` and the story 1.2 backend (branch `feat/m1-2-backend-core-http-sse`) serving `/api/stream`, when the dev server's 404 page loads in the browser, then exactly one `EventSource` connects to `http://127.0.0.1:4000/api/stream`.
- When `npm run typecheck`, `npm run lint` and `npm test` run, then all exit 0.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build -w dashboard` -- expected: all exit 0, and `dashboard/out/` exists.

**Manual checks:**
- If the backend core (1.2) is available, run it with `npm run dev -w dashboard` and confirm the one stream connection and the parsed `link` slice (React DevTools or a temporary `console.info`, removed afterwards). Otherwise, record that the live check waits for entry 7/8 (epic rule 4). Record the steps here.
