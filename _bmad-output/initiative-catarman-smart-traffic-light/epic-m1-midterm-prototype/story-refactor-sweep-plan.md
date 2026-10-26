---
title: 'Refactor sweep'
type: 'refactor'
ticket: '17'
created: '2026-10-26'
status: 'built'
baseline_revision: 'f99b906800a9bc7396e11e292ce203ffe4d1311d'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-m1-midterm-prototype-retrospective.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** M1 shipped with cleanup that the stories and the retrospective deferred. The SSE slice list is declared twice, in `hub.ts` and `hooks.ts`, with nothing tying them together (retro F7). One view formats Manila dates outside `lib/time.ts` (F8). Three backend paths have no test that would fail if they broke: the `db:seed` CLI, the static mount, and the `DASHBOARD_ORIGINS` parse. `npm run broker` has never run on Linux.

**Approach:** One sweep, kept whole (user, 2026-10-26):
- the slice list moves into contracts and both sides import it;
- the date label moves into `lib/time.ts`;
- the three tests are added, with the smallest seams that make them possible;
- the Linux broker check is run and recorded;
- the retro's F13 items are triaged.
Behavior changes go out to a new story, not into this one.

**Decisions:**
- **AD-4 waiver (Sean, 2026-10-26):** the contracts export lands first as its own one-commit chore PR, naming the waiver. The generated `contracts/schema/` doesn't change.
- **Native Mosquitto (Sean, 2026-10-26):** Sean installs it with `sudo dnf install mosquitto`. The check stops the compose broker for the run and restarts it afterwards.

## Boundaries & Constraints

**Always:**
- Gates: `npm run typecheck`, `npm run lint`, `npm test` and `npm run build -w dashboard` pass.
- `/` and every view behave exactly as before: same frames, same labels, same layout.
- Contracts keep their camelCase export style (`topicNames`, `streamSchemas`).
- Backend tests share `stl_test` and run serially. A test that writes rows resets them.

**Never:**
- No change to dispatch acking, publish timeouts, subscribe retry, notice logic or SSE backpressure (F11, F12, F13); those are behavior changes.
- No new dependency.
- No edit to `package-lock.json`, the migrations or the generated `contracts/schema/`.
- No change to `createApp`'s core-dependency rule (AD-16): a static-dir option is configuration, not a service.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Seed CLI, test DB | `tsx scripts/db-seed.ts`, `DATABASE_URL` = stl_test | exit 0; 5,760 seed rows | The rows are reset after |
| Seed CLI, DB down | `DATABASE_URL` = `127.0.0.1:1` | exit 1; stderr has `[db] seed failed` | — |
| Static mount | A temp dir with `index.html` and a file at `api/nope` | `GET /` serves the HTML; `GET /api/nope` is still a JSON 404 `NOT_FOUND` | — |
| Origins | `" http://a:1 , ,http://b:2 "`, or the variable unset | `["http://a:1","http://b:2"]`, frozen; unset gives the two localhost:3000 defaults | — |

</frozen-after-approval>

## Code Map

- `contracts/src/api/stream/index.ts:18-35` -- `streamSchemas`, whose slices come first. Add `sliceNames` (`as const satisfies readonly StreamName[]`) and the `SliceName` and `OccurrenceName` types beside it.
- `contracts/test/stream.test.ts:13-23` -- pins the key order. Add: `sliceNames` equals the first keys of `streamSchemas`, and each slice except `link` parses `null`.
- `backend/src/sse/hub.ts:9-12` -- `SLICES`, `SliceName` and `OccurrenceName` become imports from contracts. Keep the exported type names; `attach` loops over the same list.
- `dashboard/src/lib/live/hooks.ts:6-13` -- the same change for `SLICE_NAMES`, `SliceName` and `OccurrenceName`. `live-provider.tsx:15-23` imports them from `hooks.ts`; keep that import working.
- `dashboard/src/components/traffic/traffic-peaks.tsx:34-45` -- `plateDate` and `dayLabel` move to `dashboard/src/lib/time.ts` as `manilaDayLabel(date)`. Callers are at lines 161 and 348. `traffic-peaks.test.tsx:124,143,218` already asserts "Thu 22 Oct 2026".
- `dashboard/src/lib/time.test.ts` -- add a `manilaDayLabel` case.
- `backend/scripts/db-seed.ts` -- unchanged. Its CLI branch builds its own `multipleStatements` pool and sets `exitCode = 1` on error. `process.loadEnvFile` doesn't override variables already set, so a child process's `DATABASE_URL` wins.
- `backend/test/seed-vehicle-count.test.ts` -- the pattern to copy: `resetDb` and the row checks. Spawn the CLI with the repo's `node_modules/.bin/tsx`, using `cwd: backend/`.
- `backend/src/app.ts:20-22,41-53` -- `dashboardOut` is a module constant. Add `createApp(deps, staticDir = dashboardOut)`, and export `dashboardOut`.
- `backend/src/app.test.ts:101-107` -- the API 404 test exists already. Add the static tests, and assert that `dashboardOut` resolves to `<repo>/dashboard/out/`.
- `backend/src/config.ts:14-46` -- export `Env`, so a test can parse an explicit object. Nothing else reads it.
- `infra/scripts/broker.mjs`, `infra/mosquitto/mosquitto.conf` -- the commands for the broker check; neither changes.
- `_bmad-output/initiative-catarman-smart-traffic-light/deferred-work.md` -- append the F13 triage entries.
- **Environment:**
  - **Node:** put `$HOME/.nvm/versions/node/v24.22.1/bin` first on `PATH`; the system node is below `engines`.
  - **Services:** MySQL and Mosquitto run as the compose stack (`smart-traffic-light-mysql-1`, `smart-traffic-light-mosquitto-1`).
  - **Git:** work on the branch `story/1-17-refactor-sweep` and leave every change uncommitted. The orchestrator makes the chore commit and both PRs after review; this step allows no remote operations.
  - **Broker check:** it waits for Sean's `sudo dnf install mosquitto`. Skip it and say so; the orchestrator runs it.

## Tasks & Acceptance

**Execution:**
- [ ] Chore PR first (`chore/contracts-slice-names`): `contracts/src/api/stream/index.ts` and `contracts/test/stream.test.ts`. Run `npm run contracts:schema` and `git diff --exit-code contracts/schema`, then `npm test -w contracts`. One commit, naming Sean's AD-4 waiver. Merge before the rest.
- [x] `backend/src/sse/hub.ts`, `dashboard/src/lib/live/hooks.ts` -- import the slice list and types from contracts -- one declaration (F7).
- [x] `dashboard/src/lib/time.ts`, `time.test.ts`, `traffic-peaks.tsx` -- move `dayLabel` into `manilaDayLabel` -- one formatting path (F8).
- [x] `backend/test/db-seed-cli.test.ts` -- the two seed CLI rows of the matrix.
- [x] `backend/src/app.ts`, `app.test.ts` -- the `staticDir` parameter and the static-mount row.
- [x] `backend/src/config.ts`, `backend/src/config.test.ts` -- export `Env` and add the origins row.
- [x] The broker check, after Sean installs Mosquitto:
  - `docker compose -f infra/compose.yaml stop mosquitto`, then `npm run broker`;
  - confirm `ss -ltn` shows only `127.0.0.1:1883`, a `mosquitto_pub` and `mosquitto_sub` round trip works, and `infra/mosquitto/data/mosquitto.db` appears after autosave;
  - Ctrl+C exits cleanly, then `docker compose -f infra/compose.yaml start mosquitto`;
  - record the result in Verification.
- [x] `deferred-work.md` -- append one entry each:
  - subscribe retry (`client.ts:83-85`): new robustness story;
  - the missed-release "ended" notice (`override-panel.tsx:203-220`): new robustness story;
  - the offline-branch insert error code (`overrides.ts:58-71`): new robustness story;
  - SSE backpressure (`hub.ts:52-54`): accepted for M1's one local tab, to revisit for M2;
  - the single live context (`live-provider.tsx:79-85`): accepted, to revisit for M2.

**Acceptance Criteria:**
- Given the merged chore, when `hub.ts` and `hooks.ts` are read, then neither declares slice names itself.
- Given the sweep, when the M1 demo's checks 2 and 3 run against the simulator, then `/` and `/traffic/` look and update as recorded in `docs/m1-demo.md`.
- Given `deferred-work.md`, when the sweep is done, then every F13 item has an entry with its disposition.

## Implementation Notes

- **Chore (uncommitted):** only `contracts/src/api/stream/index.ts` and `contracts/test/stream.test.ts` change, so the orchestrator can commit them alone as `chore/contracts-slice-names`. With that commit on `main` by itself, `hub.ts` and `hooks.ts` still typecheck, because neither imported the new names before. The commit and its PR, naming Sean's AD-4 waiver, are still to do; that's why the first task stays unticked.
- **Contracts:** `sliceNames` (`as const satisfies readonly StreamName[]`), `SliceName` and `OccurrenceName` sit right after `StreamData`. The `streamSchemas` comment now points at `sliceNames`. In `stream.test.ts`, one new test pins `sliceNames` to `["link","state","counts","demand"]` and checks they are the leading keys of `streamSchemas`. The old "%s is nullable" test now iterates `sliceNames` without `link` instead of its own list, so there's no third copy of the slice names.
- **hub.ts:** imports `sliceNames` and the two types, and re-exports the types (`export type { OccurrenceName, SliceName } from "@stl/contracts"`) so the exported names stay. `attach` loops over `sliceNames`.
- **hooks.ts:** re-exports `sliceNames as SLICE_NAMES` plus the two types, so `live-provider.tsx` is unchanged. `StreamName` is no longer imported.
- **time.ts:** `manilaDayLabel` keeps the old formatter's exact options and its Manila-noon read, so labels don't change; the existing `traffic-peaks.test.tsx` assertions pass unchanged.
- **Seed CLI test: deviation from the Code Map.** It spawns `process.execPath` with `tsx/cli`, resolved through `createRequire` (the same `node_modules/tsx/dist/cli.mjs` that `.bin/tsx` links to), instead of executing `node_modules/.bin/tsx`. On Windows, where the teammates run `npm test`, `.bin/tsx` is a shell shim and `tsx.cmd` needs `shell: true`, so a direct spawn fails. `cwd` is `backend/`, and `DATABASE_URL` is passed in the child's env. The success case also asserts that stderr is empty and stdout has `[db] seeding 01-vehicle_count.sql`. It uses its own pool and calls `resetDb` before each test and after all of them.
- **Static mount:** `createApp(deps, staticDir = dashboardOut)`. The `dashboardOut` test doesn't re-derive the same URL, which would be tautological. Instead it checks that the path ends in `dashboard/out/`, that its parent's `package.json` is `@stl/dashboard`, and that the grandparent's is `smart-traffic-light`.
- **config.ts:** only `export` (plus a one-line comment) changes on `Env`.
- **deferred-work.md:** five entries, with `source_plan` set to this plan. The `hub.ts:52-54` reference is still right after the edit, because the import block grew by as many lines as the removed declaration.
- **Mutation checks** (each run, then restored byte for byte with `cmp`): dropping `multipleStatements: true` and dropping `process.exitCode = 1` from `db-seed.ts`, mounting static above `/api`, a wrong `dashboardOut` path, dropping `.trim()`, changing the origins default, and replacing `Object.freeze` with `Array.from`. Each makes its new test fail.

## Plan Change Log

## Review Triage Log

**Pass 1 (quick lens):** 2 findings: 0 high, 1 medium, 0 low, 1 false, 0 maybe-false.

| # | Finding | Verdict | Route | Evidence and action |
| --- | --- | --- | --- | --- |
| 1 | AC 2 not shown as written. The runtime check skipped the backend stop and restart; `sensor` and `conflict`; `emit-breach`; L2; FAULT; an active override; and `main` in every state, at 1920×1080. | medium | patch (verification only, applied by the orchestrator) | Real: the implementer's Chrome window was 1106×897, and it measured `main` once, at L1. No code was wrong. The orchestrator ran checks 2 and 3 in full, at a true 1920×1080, in headless Chrome. The results are in Verification, under "Checks 2 and 3 in full". |
| 2 | AC 1 pending: the AD-4 chore is neither committed nor merged. | false | reject | The plan gives the chore commit and both PRs to the orchestrator after review (Code Map → Environment → Git), and step 3 allows no remote operations. The reviewer confirmed the split stands alone: the two contracts files typecheck on `main` by themselves, and the schema doesn't change. |

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build -w dashboard` -- expected: all exit 0, with the new tests passing.
- `git diff --exit-code contracts/schema` after `npm run contracts:schema` -- expected: no diff.

**Manual checks:**
- `npm run build` and `npm start`, `npm run sim -- --scenario demo`, then Chrome at `http://127.0.0.1:4000/`: live updates on `/` at L1 and L4, and `/traffic/` shows today's date label and 24 bars.
- The broker check above, recorded here.

**Results (2026-10-26, Sean's Fedora laptop, Node 24.22.1, compose MySQL and Mosquitto):**
- Gates all exit 0. `npm run typecheck` and `npm run lint` pass (Biome checked 228 files). `npm test`: contracts 185, backend 169, simulator 68, dashboard 211, for 633 tests (624 at M1 plus 9 new). `npm run build -w dashboard` exports all six routes.
- `npm run contracts:schema` then `git diff --exit-code contracts/schema`: no diff. `npm test -w contracts`: 185 pass.
- `stl_test` is empty after the run (0 rows in `vehicle_count`, `breach_event`, `override_command` and `signal_state_change`). `package-lock.json`, the migrations and `contracts/schema/` are unchanged.
- **Runtime:**
  - `npm start` listens on `127.0.0.1:4000`. `GET /` and `GET /traffic/` return 200 `text/html`, and `GET /api/nope` returns 404 JSON `NOT_FOUND`.
  - With `npm run sim -- --scenario demo` running, `curl /api/stream` gets the connect frames in order `link, state, counts, demand`, then live `state`, `demand` and `counts` frames.
- **Chrome, window 1106×897, so the page is checked by the DOM, not at 1920×1080:**
  - On `/` during the demo scenario, with no reload: L3, then flood WET (debounce running), then L4 with both phases FLASHING. Three STALE labels, from the vision role the scenario stops.
  - The sim restarted in auto mode (`npm run sim` with stdin held open): `/` reads L1, cycles NS YELLOW, then all-red, then EW GREEN, vision ONLINE, no STALE label, and `main` is 948/948 as in `docs/m1-demo.md`.
  - `/traffic/` shows "MON 26 OCT 2026" (CSS upper case of "Mon 26 Oct 2026") with the Today badge, Peak 07:00 · 3012 as in the demo record, and a sr-only table of 24 hourly rows. 17 bar columns hold counts: hours 00:00 to 16:00 at 16:38 Manila, matching `/api/counts/hourly?date=2026-10-26` (24 buckets, 17 nonzero).
- **Broker check** (orchestrator, 2026-10-26, Fedora Linux 44, native Mosquitto 2.1.2 from `dnf`, service inactive and disabled):
  - **Setup:** `docker compose -f infra/compose.yaml stop mosquitto` freed port 1883. The empty, gitignored `infra/mosquitto/data/` was removed to mimic a fresh clone.
  - **Start:** `npm run broker` started `mosquitto -c infra/mosquitto/mosquitto.conf` and recreated `infra/mosquitto/data/`. `ss -ltnp` showed only `127.0.0.1:1883`, held by `mosquitto`.
  - **Round trip:** a `mosquitto_sub` on `stl/check/#` received a `mosquitto_pub` to `stl/check/ping`.
  - **Persistence:** a retained message triggered the 10 s autosave, which wrote `infra/mosquitto/data/mosquitto.db`. The file is gitignored, and the test message was cleared afterwards.
  - **Stop:** SIGINT to `node infra/scripts/broker.mjs` was forwarded. Mosquitto logged "terminating" and saved its database, and `npm run broker` exited 0.
  - **Restore:** `docker compose -f infra/compose.yaml start mosquitto` brought the stack back, answering `$SYS/broker/version` 2.1.2.
  - **Result:** S0's deferred `npm run broker` check is settled on Linux, as it already was on Windows (stories 8 and 13).
- **Checks 2 and 3 in full** (orchestrator, after review finding 1; this branch's `npm run build`, `npm start` and `npm run sim` with both roles; headless Chrome at 1920×1080 driven over CDP; REPL lines through a FIFO; each change timed on `/api/stream`):
  - **Layout, in all 20 states:** `document` 1920×1080, `main` 948/948, all four override buttons 66 px with each centre hitting its own button, no overflow or overlap, the fault row inside its panel, and no section clipped. The states:
    - L1, L2, L3, L4, and `level auto`;
    - `sensor fault` and `sensor ok`;
    - `conflict raise` (FAULT, with the banner "FAULT · Conflict monitor" and the fault row "Reset at the controller box");
    - Corridor NS pressed during FAULT ("Rejected · Conflict fault");
    - `conflict reset`;
    - `flood on` (WET), then L4 FLOODED;
    - Corridor NS active during L4 (NS green, banner "OVERRIDE · CORRIDOR NS"), then released;
    - `flood off`, then automatic after 30 s dry;
    - `emit-breach`;
    - the backend stopped and restarted.
  - **On the stream:**
    - Changes arrived in 81 ms (L2), 76 ms (L3), 70 ms (L4), 66 ms (auto), 61 ms (sensor fault), 61 ms (conflict raise), 24 ms (conflict reset), 71 ms (WET) and 21 ms (breach).
    - The override REJECTED, APPLIED and release frames each arrived about 0.5 s after the click, the dialog included.
    - `level L1` took 1.9 s only because L1 was already current, so its frame came with the 2 s republish.
    - `sensor ok` held L3, and `flood off` held FLOODED, past each 8 to 12 s wait. These are the simulator's recovery and dry holds (degradation-levels.md); both returned to automatic by the next step.
  - **Backend stop (SIGINT to the process on :4000 only):** 7 STALE labels and "Broker disconnected". Meanwhile the simulator kept cycling (`state`: EW GREEN, then EW YELLOW). After `npm start`, the page was live again 2.5 s later, with no STALE label and "Broker connected", and with no reload (the page's load marker was unchanged).
  - **`/traffic/` at 1920×1080:** no scroll, the plate "Mon 26 Oct 2026" from `manilaDayLabel`, "Peak 07:00 · 3012" and 24 rows. This matches `/api/counts/hourly`, whose peak bucket is 23:00Z (07:00 Manila) at 3012.
