---
review: adversary
lens: "Construct two units one level down that each obey every AD to the letter yet still build incompatibly"
target: ../architecture-smart-traffic-light.md
inputs:
  - ../architecture-smart-traffic-light.md
  - ../.memlog.md
  - ../../spec-smart-traffic-light/spec-smart-traffic-light.md
  - ../../spec-smart-traffic-light/degradation-levels.md
  - ../../spec-smart-traffic-light/{kpis,privacy-compliance,milestones,stack}.md
  - ./review-reconcile.md (to avoid re-raising applied findings)
units: "S0, backend core (BC), dashboard shell (DS), simulator core (SC), W2a = CAP-2+CAP-4, W2b = CAP-3+CAP-5, W2c = CAP-6; M2 Squad A firmware (FW) and Squad B vision node (VN) at the MQTT seam only"
date: 2026-10-22
---

# Adversary review: architecture spine

## Verdict

**Not yet safe to hand to three parallel sessions.** The MQTT seam is tight: topics, QoS, clientIds, idempotent ids, retained topics and time-of-record are well pinned, and SC and the backend will interoperate. The **internal** seams are where two compliant stories still diverge. Those seams are the SSE wire format, the entity shapes that cross both SSE and REST, link liveness, the shared dashboard and backend files that have no extension point, and the one lockfile. In every case below, both units obey every AD and the result still doesn't fit together.

Almost all fixes are the same move: put the shape or file into S0 or a core story with exact fields, and add the missing extension points to the AD-14 table.

Counts: **high 5 · medium 10 · low 4**, plus 5 ADs that can't be enforced as written.

| # | Sev | Hole | Units in conflict |
| --- | --- | --- | --- |
| A-01 | high | SSE wire format unspecified (named events vs envelope, null slices) | BC hub ↔ DS LiveProvider (parallel, wave 1) |
| A-02 | high | `breach`/`override` entities have two owners: S0's SSE schema vs the wave-2 REST DTO | S0 ↔ W2c, S0 ↔ W2b |
| A-03 | high | Controller liveness has zero or two owners, and the dependency graph forbids CAP-5 from reading it | BC ↔ W2b |
| A-04 | high | Shared dashboard files (`api.ts`, `time.ts`, `log/page.tsx`, `page.tsx`, `components/`, class labels) have no extension point | DS ↔ W2a ↔ W2b ↔ W2c |
| A-05 | high | One root lockfile, and every parallel story adds dependencies | BC ↔ DS ↔ SC (and W2a) |
| A-06 | medium | Backend startup work and timers have no extension point and no ordering against `clean: false` replay | BC ↔ W2a ↔ W2b |
| A-07 | medium | Staleness ignores the stream and broker, so the recorded "stop the backend" demo shows frozen data as live | DS ↔ W2b, BC |
| A-08 | medium | Occurrence events have no consumption API; bursts and reconnect gaps drop breaches | DS ↔ W2c, W2b |
| A-09 | medium | `counts` slice can be dense or sparse; the reader crashes at every hour boundary | W2a ↔ W2b |
| A-10 | medium | HTTP error type and list-query contract are shared but have no owner | BC ↔ DS ↔ W2a/b/c |
| A-11 | medium | Override resolution: release has no `commandId`, "APPLIED" timing is undefined, unclear whether TIMEOUT is terminal | SC ↔ W2b ↔ FW |
| A-12 | medium | TS module resolution unset; contracts source is type-checked under two resolvers | S0 ↔ BC (↔ DS) |
| A-13 | medium | DB connection config: dbmate's `DATABASE_URL` vs `config.ts`'s own vars; where `db:migrate` runs | S0 ↔ BC |
| A-14 | medium | Field precision: `ts` units, crop size unit and optionality | S0 ↔ W2c ↔ VN |
| A-15 | medium | M2 semantics: what `pcu` means, who thresholds `confidence`, whether edge_vision reads `vehicle-classes.json` | SC ↔ VN ↔ FW |
| A-16 | low | Root script argument forwarding swallows `--scenario demo` | S0 ↔ SC |
| A-17 | low | A graceful disconnect leaves a retained `online: true`, so the simulator refuses to start after an M2 rehearsal | SC ↔ FW/bridge |
| A-18 | low | QoS and retain live only in prose; MQTT.js defaults to QoS 0 | S0 ↔ BC ↔ SC ↔ W2c |
| A-19 | low | `visuals.ts` covers only 4 enum families; command status, flood and class colors have no home | DS ↔ W2a/b |

---

## High

### A-01 · high · The SSE wire format is unspecified, and the two ends are built in parallel

- **Units:** backend core (builds `sse/hub.ts` and `GET /api/stream`) and dashboard shell (builds `LiveProvider`). Both are wave 1 and run in parallel, so neither sees the other's code.
- **Both comply:**
  - S0 writes `contracts/src/api/stream/*` as "every SSE event schema" (AD-14). A natural reading is one discriminated union: `streamEvent = z.discriminatedUnion('type', [{type: 'link', data}, …])`.
  - BC serializes that union faithfully as unnamed frames: `data: {"type":"state","data":{…}}\n\n`.
  - DS reads AD-8's event table, where events are *named* `link`, `state`, `counts`, `demand`, `breach`, `override`, and calls `es.addEventListener('state', …)` for each.
- **Clash:**
  - A frame with no `event:` line fires only `onmessage`, so none of DS's listeners ever fire. The reverse pairing fails the same way: if BC writes `event: state` and DS uses `onmessage`, nothing arrives either.
  - Secondary forks the spine leaves open:
    - whether the `data` line carries the bare slice or an envelope;
    - whether the hub sends a slice that has no value yet (AD-8 says slices go "on connect", but `counts` and `link` aren't nullable in the table, while `state` and `demand` are);
    - the order of slices on connect;
    - `id:` and `retry:` fields.
- **Consequence:** Both stories pass typecheck, lint and tests, and both demo "against the simulator" in isolation: BC with `curl`, DS against a mock. The live view first fails when wave 2 starts, inside a W2b session that doesn't own either file.
- **Fix (tighten AD-8, and add to S0's scope):**
  > Every SSE frame is exactly `event: <name>\ndata: <JSON>\n\n`. `<name>` is the event name from the table, and `<JSON>` is the bare value of `contracts/src/api/stream/<name>.ts`: no envelope and no `id:`. On connect the hub writes `retry: 2000`, then the four slices in the order `link`, `state`, `counts`, `demand`. A slice with no value yet is sent as `null`, so all four slice schemas are `.nullable()`. S0 exports `streamSchemas` (a map from name to schema) and `sseFrame(name, data)`. The hub writes only through `sseFrame`. `LiveProvider` registers one `addEventListener` per key of `streamSchemas`, parses each frame with that schema, and logs and drops invalid frames.

### A-02 · high · The entities carried by SSE events have two owners: S0's stream schema and the wave-2 REST DTO

- **Units:**
  - S0, which per AD-14 is "the only story that creates `contracts/`, with every … SSE event schema";
  - W2c, which owns `GET /api/breaches` "with its DTO" (AD-14) in `contracts/src/api/breaches.ts`;
  - likewise W2b for the `override` event and `GET`/`POST /api/overrides`.
- **Both comply:**
  - The SSE table defines `breach` as "one breach list item, without crop bytes", but no list-item shape exists when S0 runs. S0 invents one by mirroring the MQTT payload: `{id, ts, approach, vehicleClass, centroid: {x, y}, cropUrl}`.
  - W2c declares the REST `BreachListItem` it owns by mirroring the table: `{id, occurredAt, receivedAt, approach, vehicleClass, centroidX, centroidY, cropUrl}`.
  - AD-4 forbids only *other packages* redeclaring shapes. Both declarations sit in `contracts/`, each by its owner.
- **Clash:**
  - **Breaches:** the breaches page loads the REST list and prepends live SSE items. Live rows have no `occurredAt`, which renders as "Invalid Date", and they carry a nested `centroid` where the list uses flat fields.
  - **Overrides:** S0 writes the SSE `override` as the full row `{commandId, mode, phase, status, reason, requestedAt, resolvedAt}`. W2b follows the sequence diagram literally and returns `202 {commandId, status: REQUESTED}`. AD-7's prose says "returns 202 with the command", which is a third reading. The override panel then holds two shapes for one record.
  - The spine also contradicts itself on ownership. AD-14 makes the SSE event "belong to exactly one story" (the feeder), and also makes S0 the only creator of every SSE event schema.
- **Consequence:** The bug shows only when live and historical rows meet on one screen, which is the CAP-6 and CAP-5 demo itself. Changing either shape after both have merged means editing a merged contract file owned by another story.
- **Fix (amend AD-14 and the Structural Seed):**
  > S0 owns the full shape of every entity that crosses the SSE stream. The feeding story owns only the code that produces it. S0 creates:
  > - `contracts/src/api/breaches.ts` with `BreachItem = {id: uuid, occurredAt: iso, receivedAt: iso, approach, vehicleClass, centroid: {x, y}, cropUrl: string | null}`. `cropUrl` is API-relative (`/api/breaches/<id>/crop`), and the dashboard resolves it with `apiUrl()`; see A-04.
  > - `contracts/src/api/overrides.ts` with `OverrideCommand = {commandId, mode, phase: 'NS'|'EW'|null, status, reason: string|null, requestedAt: iso, resolvedAt: iso|null}`.
  >
  > SSE `breach` is `BreachItem` and SSE `override` is `OverrideCommand`, both by import. `GET` lists return `page(Item)` (A-10). `POST /api/overrides` returns 202 with the full `OverrideCommand`; correct the sequence diagram to match. Wave-2 stories add request and query schemas and other endpoints' DTOs, never these two.

### A-03 · high · Controller liveness has zero or two owners, and the dependency graph forbids the reader CAP-5 needs

- **Units:** backend core (owns "the `status` and `heartbeat` handlers that feed the `link` slice") and W2b (owns the `state` slice and AD-7's `409 CONTROLLER_OFFLINE` check).
- **Both comply, part (a): the watchdog.** The topic table gives `controller/state` the job "marks `link.controller` `STALE` after 5 s with no state".
  - BC builds what its scope lists: `controller-status.link.ts` and `vision-heartbeat.link.ts`. A `controller/state` handler isn't "status" or "heartbeat".
  - W2b builds `controller-state.slice.ts`, which updates the `state` slice. That is its scope.
  - **Nobody builds the 5 s watchdog**, so a hung but still-connected controller shows ONLINE forever. In M2 that is exactly the QoS 0 drop case AD-5 was written for.
  - Or **both build it**. W2b adds `controller-state.link.ts` that pushes `{...itsCache, controller: {status: 'STALE'}}`, while BC's heartbeat handler pushes a full `link` slice from *its* cache, where the controller is still ONLINE. AD-8's full-replace rule means the last writer wins, and the badge flickers ONLINE and STALE once a second.
- **Both comply, part (b): the 409 read.** W2b's `services/overrides.ts` must read `link.controller` (AD-7 step 2). BC naturally keeps liveness in `services/link.ts`.
  - The dependency diagram allows services to import only repos, the publisher, the hub and contracts. "Anything not drawn is forbidden", and service → service is not drawn.
  - A strict reader of W2b's story therefore adds `controller-status.override.ts` to keep a private online flag. That flag ignores the 5 s STALE rule, so a POST against a frozen controller returns 202 and ends in TIMEOUT instead of 409.
  - A lenient reader imports `services/link.ts`. Two compliant developers end up with different architectures.
- **Also unowned:** a *retained* `controller/state` delivered at backend restart must not count as liveness. If it does, the link reads ONLINE for 5 s after every restart even when the simulator is gone, and POSTs in that window return 202 and then TIMEOUT.
- **Fix (new rule in AD-8, plus an edge in the dependency diagram):**
  > Each slice has exactly one writer module. `backend/src/services/link.ts` (backend core) is the only writer of `link` and owns every liveness timer, including the 5 s `controller/state` watchdog in `controller-state.link.ts` (backend core). It exports a read-only `getLink()`. Add the edge "services → `services/link.ts` (read only)". The hub exposes `setSlice(name, value)` and `getSlice(name)`, and only the owning module of a slice calls `setSlice`. A message delivered with the retain flag never refreshes liveness.

### A-04 · high · Shared dashboard files have no extension point, so wave 2 must edit the shell's files or collide with each other

- **Units:** the dashboard shell and all three wave-2 stories, which run in parallel.
- **Both comply, and the files where they clash:**
  - **`src/lib/api.ts`.** AD-9 says data comes "only through `src/lib/api.ts`", and the Dashboard data convention says history comes from "`api.ts` functions". DS creates the file in wave 1, before any DTO exists. W2a adds `getStateChanges` and `getHourlyCounts`, W2b adds `getOverrides` and `postOverride`, and W2c adds `getBreaches` and `getBreach`, all in the same file at the same time. That is a three-way merge conflict, and each edit breaks AD-14's rule that stories only add files. The alternative, a component calling `fetch` directly, breaks AD-9.
  - **`src/lib/time.ts`.** It appears in the source tree but in no story's scope. W2a needs Manila hour labels for the chart, W2b needs `receivedAt` and override times, and W2c needs breach `occurredAt`. Each creates `time.ts`, and their contents differ:
    - one uses `Intl.DateTimeFormat('en-PH', {timeZone: 'Asia/Manila'})`, which is correct;
    - another uses `new Date(Date.parse(iso) + 8 * 3600e3).getHours()`, which is correct only on a UTC-set dev machine and double-shifts to +16 h on the Manila-set demo laptop.

    Both obey AD-6 ("only the dashboard converts").
  - **`src/app/log/page.tsx`.** The source tree assigns `/log/` to "override + state history, CAP-2/CAP-5": two wave-2 stories, one file. AD-14's single-owner list names handlers, endpoints, slices and behaviors, but not pages, so both are entitled to write it.
  - **`src/app/page.tsx`.** DS must render something for its DoD demo. If it creates `/`, or placeholder pages so the nav links resolve, W2b must later replace a file it doesn't own.
  - **`src/components/`.** `level-badge.tsx`, `stale-badge.tsx` and `class-label.tsx` are each needed by the live view, the state history, the override log and the breach list. Two or three stories will create the same file names.
  - **Vehicle-class labels.** AD-12 fetches labels at runtime. W2a, W2b and W2c all need them, which produces three `useVehicleClasses` hooks, or one file created three times.
- **Fix (add rows to the AD-14 extension table and widen DS's scope):**
  > The dashboard shell owns:
  > - `api.ts` as a generic typed client only: `apiGet(path, schema, query?)`, `apiPost(path, body, schema)`, `apiList(path, itemSchema, query)`, `apiUrl(path)`;
  > - `time.ts`: `formatManila(iso, 'time' | 'datetime' | 'date')` and `manilaHourLabel(iso)`, always via `Intl` with `timeZone: 'Asia/Manila'`, never by offset arithmetic;
  > - `lib/use-vehicle-classes.ts`;
  > - shared atoms in `components/ui/` (LevelBadge, AspectLamp, StaleBadge, ClassLabel, ConfirmDialog).
  >
  > Stories add `dashboard/src/lib/api/<resource>.ts` (not registered) and `dashboard/src/components/<route>/*`. Split `/log/` into `/log/overrides/` (CAP-5) and `/log/states/` (CAP-2). The shell creates no `page.tsx`. It shows the `link` slice in the layout header, which gives its DoD demo a surface, and its nav lists the fixed route set.

### A-05 · high · One root lockfile, and every parallel story adds dependencies

- **Units:** backend core, dashboard shell and simulator core in parallel, and later W2a, which adds Recharts.
- **Both comply:**
  - AD-13 requires "one root `package-lock.json`" and "install only from the root: `npm install <pkg> -w <workspace>`, pinned exactly".
  - AD-14 gives S0 the root tooling but not the workspace dependencies.
  - So BC runs `npm i -E express mysql2 mqtt supertest -w backend`, DS runs `npm i -E next react react-dom tailwindcss … -w dashboard`, and SC runs `npm i -E mqtt -w simulator`. Each rewrites `package-lock.json` on its own branch.
- **Clash:**
  - Every merge after the first conflicts across thousands of lockfile lines. Resolving by hand corrupts it. Regenerating it drifts transitive versions, because exact pins cover only direct dependencies.
  - Two stories can also pin the same package differently. If one developer types `-E mqtt` on a day the registry has moved past 5.16.1, while another copies the Stack table version, each package.json is "pinned exactly" in its own right, and they disagree.
- **Consequence:** Day 1 to 2 of a 4-day build goes to lockfile surgery, inside bmad-build sessions that share no memory.
- **Fix (amend AD-13 and S0's scope):**
  > S0 creates every workspace's `package.json` and installs every dependency in the Stack table into its workspace at the pinned version, including Recharts, Supertest, Testing Library, jsdom and concurrently. No later M1 story touches `package-lock.json`. A story that needs a new dependency lands it first as a one-commit chore on `main`. Lockfile conflicts are resolved by taking `main`'s lockfile and re-running `npm install`, never by editing it.

---

## Medium

### A-06 · medium · Backend startup work and timers have no extension point and no ordering against `clean: false` replay

- **Units:** backend core (owns `src/index.ts`), W2a and W2b.
- **Work that has no home:**
  - W2a: read the latest `signal_state_change` row before the first `controller/state` arrives (AD-5); seed the `counts` slice from the DB at boot; run the Asia/Manila hour-boundary push (AD-8).
  - W2b: the startup sweep that marks REQUESTED rows as TIMEOUT, and the per-command 5 s timers (AD-7).
  - BC: the liveness timers.
  - The AD-14 table has no row for any of this, and the dependency graph has no node for a timer or startup job, so a timer module calling a service is "not drawn, forbidden".
- **Both comply, and clash:** Either W2a and W2b both edit BC's `index.ts`, which conflicts and breaks the add-only rule, or each hides the work as import-time side effects in its handler module, such as a top-level `await` read or a `setInterval` at import. Supertest imports `app.ts` and with it the handler registry, so DB reads and timers then run inside every route test and leak timers.
- **Ordering:** With `clean: false`, the broker flushes queued QoS 1 messages and the retained `controller/state` as soon as the backend connects.
  - If `index.ts` connects MQTT before W2a's async "latest row" read resolves, the retained state is compared against `undefined` and inserted again. That is the duplicate R-15 was meant to stop.
  - If handlers attach after `connect()` (an `await` in between), MQTT.js emits the queued messages to no listener and acks them, so they are lost, which breaks the offline-retention KPI.
- **Fix (add an extension point and fix the boot order):**
  > Add `backend/src/jobs/<name>.ts`, exporting `{start(ctx): Promise<void>, stop(): void}` and registered in `backend/src/jobs/index.ts`. Add the edge "jobs → services" to the dependency graph. `index.ts` (backend core) boots in this fixed order: pool, then `await` every job's `start`, then attach all MQTT handlers, then `mqtt.connect`, then `listen`. `app.ts` never starts jobs or connects MQTT.

### A-07 · medium · Staleness ignores the stream and the broker, so the recorded "stop the backend" demo step shows frozen data as live

- **Units:** dashboard shell (LiveProvider) and W2b (the live view), with backend core (the `link` slice).
- **Both comply:**
  - The Staleness convention keys a view's staleness only off `link.controller` and `link.vision`.
  - AD-18 makes "stopping the backend while the simulator runs" a *recorded* CAP-1 demo step.
  - When the backend stops, the SSE stream drops and EventSource retries silently. The last `link` slice in memory still says ONLINE, so W2b, following the convention to the letter, keeps showing the frozen phase and level as live while the simulator terminal shows them changing.
  - The same happens when `link.broker` goes DISCONNECTED: unless BC happened to downgrade the roles, `link.controller` stays at its last-known ONLINE.
  - DS may expose a `connected` flag, but no rule makes wave-2 views use it.
- **Consequence:** At the demo step the instructor watches, the dashboard misreports.
- **Fix (tighten the Staleness convention):**
  > A source is live only when the SSE stream is open, `link.broker` is `CONNECTED`, and `link.<role>` is `ONLINE`. `LiveProvider` exposes `useLiveness(role): 'LIVE' | 'STALE'`, and views read only that. When EventSource fires `error`, everything goes STALE immediately. When the backend loses the broker, `services/link.ts` sets both roles to `STALE`.

### A-08 · medium · Occurrence events have no consumption API; bursts and reconnect gaps drop breaches

- **Units:** dashboard shell (LiveProvider) and W2c (breach list), and W2b (override log).
- **Both comply:**
  - AD-8 defines only `useLive(name)`, which reads slices. DS's natural extension is to store occurrences as "latest" state too.
  - W2c then writes `useEffect(() => prepend(latestBreach), [latestBreach])`.
- **Clash:**
  - After a backend restart, the broker replays every queued `vision/breach` (QoS 1, `clean: false`). That is N SSE `breach` frames within milliseconds. React batches the `setState` calls, the effect sees only the last value, and N−1 breaches never appear in the live list. CAP-6 says "each breach event received is listed".
  - Occurrences sent during an SSE reconnect gap are never re-sent, and nothing tells views to refetch REST.
  - `override` events are *transitions of one record*. A consumer that appends instead of upserting shows REQUESTED and APPLIED as two log rows.
- **Fix (amend AD-8):**
  > `LiveProvider` exposes `useLiveEvent(name, handler)`, which calls the handler once per frame and holds no React state, and `useStreamEpoch()`, which increments on every (re)connect. History views refetch REST page 1 when the epoch changes, and upsert occurrences by `id` (breach) or `commandId` (override).

### A-09 · medium · The `counts` slice can be dense or sparse, and the reader crashes at every hour boundary

- **Units:** W2a (writer of the `counts` slice and the hourly endpoint) and W2b (the live view that reads it), in parallel.
- **Both comply:**
  - The seed is `{hourStart, byApproach: {N: {<classId>: n}, …}}`.
  - S0's schema could be `z.record(z.enum(['N','S','E','W']), z.record(z.string(), z.number()))`, which in zod 4 is *exhaustive* (all four keys required). Outbound SSE isn't validated, though: AD-4 parses only inbound messages.
  - W2a's `GROUP BY approach, vehicle_class` naturally emits a sparse object, `{N: {tricycle: 3}}`, with S, E and W absent at 10:00:05.
  - W2b's tile reads `counts.byApproach.E.car`, which throws a TypeError, and with no error boundary the whole `/` page goes blank at the start of every Manila hour. The fixtures W2b builds against are dense, so its tests pass.
- **Fix (add to the Structural Seed and AD-8):**
  > The `counts` slice always holds all four approaches. Each approach lists every class id in `vehicle-classes.json` (0 when there are none), plus any unknown id seen this hour. `hourStart` is the ISO UTC instant of the Manila hour start (for example `…T06:00:00.000Z` for 14:00). `GET /api/counts/hourly` returns exactly 24 buckets `{hourStart, total, byClass, byApproach}` with the same density. The backend parses every outbound SSE payload with its contract schema in dev and test, and throws in tests.

### A-10 · medium · The HTTP error type and the list-query contract are shared but have no owner

- **Units:** backend core (error middleware), the dashboard shell (api client), and every wave-2 route.
- **Both comply, and the forks:**
  - **Error type.** W2c throws its own `NotFoundError` for an unknown crop id. BC's middleware recognizes only its own `HttpError`, or only `ZodError`, so the response is `500 INTERNAL` instead of `404 NOT_FOUND`.
  - **Where the error class lives.** W2b decides `CONTROLLER_OFFLINE` inside a *service*, but services may not import `http/`. Whether W2b can throw a 409 at all depends on where BC put the error class, which nothing fixes.
  - **Limits.** For `?limit=500`, W2a clamps to 200, W2c returns 400, and W2b ignores it.
  - **Cursors.** `nextCursor` may be `null` or omitted, and `?cursor=garbage` may return 400 or 500.
  - **Duplicated wrapper.** Each story declares its own `Page<T>` zod schema in `contracts/`, so there are three near-copies, and DS's generic list helper is typed against none of them.
  - **Unowned wave-1 DTOs.** The error envelope, `/api/health` and `/api/vehicle-classes` DTOs are needed by BC and DS in parallel in wave 1. S0's scope covers only MQTT and SSE, so both developers create `contracts/src/api/error.ts`.
- **Fix (S0 adds `contracts/src/api/common.ts`, and BC adds a domain error):**
  > `contracts/src/api/common.ts` holds:
  > - `apiError = {error: {code: 'VALIDATION_FAILED'|'NOT_FOUND'|'CONTROLLER_OFFLINE'|'INTERNAL', message}}`;
  > - `listQuery`: `limit` coerced to an int from 1 to 200, default 50, and out of range returns 400; `cursor` is an optional opaque string, and an undecodable cursor returns 400;
  > - `page(item) = {items, nextCursor: string | null}`;
  > - `health` and `vehicleClass` DTOs.
  >
  > Backend core exports `AppError(code, message)` from `backend/src/services/errors.ts`, which both services and routes may import. The middleware maps `AppError` to its status and `ZodError` to `400 VALIDATION_FAILED`, and maps everything else to `500 INTERNAL`.

### A-11 · medium · Override resolution differs between the simulator, CAP-5 and the firmware

- **Units:** simulator core, W2b, and FW in M2.
- **(a) Release has no `commandId`.**
  - The seed shows `"override": {"mode": "NONE"}` with no `commandId`, which appears only "while an override is active". SC copies this literally.
  - W2b resolves on "a matching ack *or* a state whose `override.commandId` matches", so a `NONE` release can resolve only through the ack.
  - M1 works, because the ack travels over localhost. In M2 the ack is QoS 0 on congested venue Wi-Fi, which is AD-5's own premise. A dropped release ack turns into TIMEOUT while the junction really has been released, the panel says "release failed", and the operator retries.
- **(b) "APPLIED" timing is undefined.**
  - Squad A owns the clearance timings (Deferred). A correct firmware that sends `APPLIED` only after the yellow and all-red clearance can exceed AD-7's 5 s, and every corridor then shows TIMEOUT.
  - SC applies overrides instantly, so M1 never exposes this.
- **(c) Whether TIMEOUT is terminal.**
  - After a backend restart, the startup sweep marks a fresh REQUESTED row as TIMEOUT, and then the retained state arrives carrying its `commandId`.
  - W2b's `UPDATE … WHERE status = 'REQUESTED'` leaves it TIMEOUT. The log then says the override failed while `state.override` shows it active.
- **Fix (tighten AD-7):**
  > `state.override.commandId` always carries the id of the last command the controller applied, including a `NONE` release. It is absent only before the first command since boot. The controller acks within 1 s of receipt, and `APPLIED` means accepted and now in effect or transitioning to it. A later matching `controller/state` upgrades `TIMEOUT` to `APPLIED`. Only `APPLIED` and `REJECTED` are terminal.

### A-12 · medium · TypeScript module resolution is unset, and contracts source is type-checked under two resolvers

- **Units:** S0 (`tsconfig.base.json` and the contracts source) and backend core (`backend/tsconfig.json`), with the dashboard shell.
- **Both comply:**
  - AD-13 fixes `strict`, ESM, tsx and `transpilePackages`, but not `module` or `moduleResolution`.
  - S0 writes contracts with extensionless imports (`export * from './mqtt/topics'`) under `bundler` resolution.
  - BC sets `"module": "nodenext"`, the textbook Node ESM setting, which "extends" the base config.
- **Clash:**
  - `tsc --noEmit -p backend` type-checks contracts' *source* under `nodenext` and reports TS2835 ("relative import paths need explicit file extensions") on every contracts file. So `npm run typecheck` is red in BC's story because of S0's files.
  - Importing `vehicle-classes.json` also needs `with {type: 'json'}` under `nodenext`.
  - Separately, a later story adding a helper to contracts that imports `node:crypto` breaks the dashboard's browser build, since the dashboard transpiles contracts.
- **Fix (amend AD-13 and AD-4):**
  > `tsconfig.base.json` sets `module: "preserve"`, `moduleResolution: "bundler"`, `noEmit: true`, `resolveJsonModule: true` and `verbatimModuleSyntax: true`. Packages may not override `module` or `moduleResolution`. Both tsx and Next accept this. `contracts/` imports only `zod` and no `node:` built-ins, because the browser bundles it.

### A-13 · medium · DB connection config has two readers with different variable names, and `db:migrate` has no fixed home

- **Units:** S0 (root scripts, `docs/setup.md`, the initial migration) and backend core (`config.ts`, `pool.ts`, `.env.example`, `.env.test`).
- **Both comply:**
  - S0 writes the root script `"db:migrate": "dbmate --wait --no-dump-schema up"`, which is AD-10 verbatim.
  - dbmate reads `DATABASE_URL` from `./.env` and migrations from `./db/migrations`, both relative to its working directory. Run from the root, it finds neither.
  - BC's `config.ts` reads mysql2-style `DB_HOST`, `DB_USER`, `DB_PASSWORD` and `DB_NAME` from `backend/.env`, and `.env.test` sets `DB_NAME=stl_test`.
  - AD-15's "only `config.ts` reads `process.env`" says nothing about dbmate.
  - AD-10 says `db:migrate` "runs before backend `dev` and `start`". S0 wires it into root `dev`, and BC wires it into `predev`.
- **Clash:** There are two sets of DB variables to keep in sync, migrations land in `stl` while tests run against an unmigrated `stl_test`, and `db:migrate` runs twice on every boot.
- **Fix (amend AD-10 and AD-15):**
  > `backend/.env` holds one variable, `DATABASE_URL=mysql://stl:stl@127.0.0.1:3306/stl`, and `backend/.env.test` holds the `stl_test` URL. `config.ts` (mysql2 `uri`) and dbmate both read it. `backend/package.json` defines `db:migrate` as `dbmate --env-file .env -d db/migrations --wait --no-dump-schema up`, and `db:migrate:test` with `.env.test`, which the backend Vitest `globalSetup` runs. Backend `predev` and `prestart` call it. The root `db:migrate` only delegates with `-w backend`.

### A-14 · medium · Contract field precision: `ts` units, crop size unit, and crop optionality

- **Units:** S0 (zod schemas, and the JSON Schema they generate), W2c (breach ingest), and VN at the M2 seam.
- **`ts` units:**
  - S0 writes `ts: z.number().optional()`, and `z.toJSONSchema` emits `{"type": "number"}`.
  - Squad B's Python sends `time.time()`, which is in *seconds* as a float. It validates.
  - Every `occurredAt` becomes 1970-01-21, so every count lands in a 1970 hour bucket, and CAP-4's chart for today and the live counts panel both read 0.
- **Crop:**
  - The ERD makes `breach_crop` 0..1, but the payload example always carries `crop`, and AD-11 writes both rows "in one transaction".
  - If S0 makes `crop` optional, W2c's unconditional `breach_crop` insert fails on a missing crop and the transaction rolls back, losing the breach.
  - If S0 makes it required with `.max(200_000)` while Squad B targets 200 KiB (204,800), crops between those two sizes make AD-4 drop the *whole breach*. That breaks CAP-6's "each breach event received is listed" over a crop problem.
- **Fix (tighten AD-4 and AD-11):**
  > `ts` is `z.number().int().min(1.6e12).max(4.1e12)` (epoch ms). If `|ts − receivedAt| > 24 h`, then `occurredAt = receivedAt`, and the backend logs a warning. `crop` is optional in v1, and `crop.data` is at most 204,800 base64 characters. An oversized or missing crop stores the breach without a crop, `cropUrl` is `null`, and the backend logs a warning. A crop problem never loses the event.

### A-15 · medium (M2 seam) · What `pcu` means, who thresholds `confidence`, and whether edge_vision reads the class file

- **Units:** simulator core (vision role), VN (Squad B) and FW (Squad A).
- **What `pcu` means:**
  - `vision/demand` is "PCU per approach". That could be PCU currently in the ROI (a presence or queue proxy), PCU crossed in a window, or a PCU rate.
  - SC picks one, Squad B another, and Squad A's green-extension logic (CAP-14) assumes a third. Every combination is schema-valid.
  - The result is green extended for the wrong approach, or a "ghost red" that never ends early.
- **Who thresholds `confidence`:**
  - AD-17 makes `ok: false` the L2 trigger. `degradation-levels.md` also lists "low frame confidence".
  - Firmware may also threshold `confidence < x`. That gives two owners of the low-confidence decision, so L2 flaps when the two disagree.
- **The class file:**
  - AD-12 calls `vehicle-classes.json` the only source of PCU weights, but nothing says the Python vision node loads it.
  - Squad B keeps its weights in its own config, and `/api/vehicle-classes` then shows weights the vision node doesn't use.
- **Fix (tighten AD-17 and AD-12):**
  > `pcu.<approach>` is the sum of PCU weights of vehicles currently inside that approach's ROI. It is ≥ 0, is not a rate, and is 0 when the approach is empty. The simulator models the same quantity. The controller decides L2 only from missed heartbeats and `ok`; `confidence` and `fps` are informational for the dashboard. `edge_vision` loads `contracts/vehicle-classes.json` by repo path at startup and keeps no other weight table.

---

## Low

### A-16 · low · Root script forwarding swallows `--scenario demo`

- **Units:** S0 (root `package.json` scripts) and simulator core (argv parsing).
- **Clash:**
  - S0 writes `"sim": "npm run start -w simulator"`, and SC parses `--scenario` with `node:util` `parseArgs`.
  - `npm run sim -- --scenario demo` expands to `npm run start -w simulator --scenario demo`. The inner npm takes `--scenario` as its own config flag, so the simulator receives at most `demo`. It starts the REPL and no scripted demo runs.
  - AD-3 and AD-13 are both obeyed. This bites at the M1 demo.
- **Fix (AD-13):**
  > Root scripts delegate as `npm run <script> -w <ws> --`, with a trailing `--`. S0's DoD runs `npm run sim -- --scenario demo` once, against a stub entry point if SC hasn't merged yet.

### A-17 · low · A graceful disconnect leaves a retained `online: true`, so the simulator refuses to start after an M2 rehearsal

- **Units:** simulator core, and FW or the serial bridge.
- **Clash:**
  - The LWT fires only on an ungraceful drop. MQTT.js `end()` and PubSubClient `disconnect()` are graceful, so no LWT is sent.
  - The retained `controller/status {online: true, source: "live"}` therefore outlives the ESP32. With `persistence true` it also survives broker restarts.
  - AD-3's check makes the simulator exit on every later start until someone clears the topic by hand.
  - The same happens with the simulator's own Ctrl-C: the status stays `online: true, source: sim` until A-03's watchdog (if anyone built it) marks it STALE.
- **Fix (AD-5 and AD-3):**
  > Every link publishes its retained `online: false` status before a graceful disconnect. The simulator refuses to start only if a `source: live` status is online *and* a `controller/state` arrives within 5 s. `--force` clears the retained status.

### A-18 · low · QoS and retain live only in prose, and MQTT.js defaults to QoS 0

- **Units:** S0 (`topics.ts` builds strings only), backend core (subscribes in the registry), simulator core (publishes), and W2c (registers `vision/breach`).
- **Clash:**
  - MQTT.js's `subscribe` and `publish` both default to QoS 0.
  - If W2c registers its handler without QoS, or SC publishes breaches without `qos: 1`, the effective QoS is 0. Breaches sent while the backend restarts then aren't queued, which breaks the offline-retention KPI.
  - No test catches this, because AD-16 says no test uses a broker.
- **Fix (AD-4 and AD-5):**
  > S0's `topics.ts` exports one table: `{build(iid), qos, retain, publisherRole}` per topic. The backend subscribes, and the simulator publishes, only from that table. No QoS or retain literal appears anywhere else.

### A-19 · low · `visuals.ts` covers only four enum families

- **Units:** the dashboard shell, and W2a and W2b.
- **Clash:**
  - DS's scope is "levels, aspects, overrides and links".
  - W2b needs colors for command status (REQUESTED is pending; REJECTED and TIMEOUT are failures) and for flood (DRY, WET, FLOODED). W2a and W2b need per-class series colors.
  - Each story either edits DS's `visuals.ts` and `globals.css`, or defines colors locally, which breaks the convention. The likely outcome is a tricycle shown in amber on `/` and in blue on `/traffic/`.
- **Fix (widen DS's scope):**
  > `visuals.ts` covers every enum in the Enums convention, plus `classColor(id)`, which is deterministic from the order in `vehicle-classes.json` and has a neutral fallback for unknown ids.

---

## ADs that can't be enforced as written

- **U-1 · AD-14 contradicts itself in three places.**
  - "At most one registration line in a shared index" can't be met by the combined stories. W2b alone registers about four handlers (`controller-state.slice`, `controller-state.override`, `controller-override-ack.resolve`, `vision-demand.slice`), plus DTOs.
  - "S0 contains no runtime code" contradicts S0 creating `topics.ts` builders and `infra/scripts/broker.mjs`.
  - "Each SSE event belongs to exactly one story" contradicts S0 being the only creator of SSE event schemas (A-02).
  - Every wave-2 branch also appends at EOF of the same three index files, so git conflicts on every merge after the first.
  - Reword: "per shared index, one line per artifact the story owns; entries kept alphabetical, one per line". Then state that S0 owns shapes and feeding stories own producers.
- **U-2 · The dependency diagram is incomplete.** "Anything not drawn is forbidden" bans:
  - service → service, which the CAP-5 link read needs (A-03);
  - the `/api/stream` route → hub, so the backend core's own route has to go through a pointless service;
  - the composition root (`app.ts`, `index.ts`), which must import everything;
  - jobs and timers (A-06).

  Add the composition-root exemption, `jobs → services`, `routes → sse/hub` (for the stream route only), and read-only `services → services/link.ts`.
- **U-3 · AD-15's config rule can't hold for the dashboard.**
  - Next.js inlines only *literal* `process.env.NEXT_PUBLIC_API_URL` references. A `src/config.ts` that zod-parses `process.env` gets `{}` in the browser.
  - The demo build's empty value fails `z.string().url()`.
  - `next build` reads the developer's `.env`, so it bakes in the dev URL unless a committed `.env.production` sets it empty.
  - Carve the dashboard out: `src/lib/config.ts` reads the one literal reference, accepts `''`, and the shell commits `dashboard/.env.production` with `NEXT_PUBLIC_API_URL=`.
- **U-4 · AD-16's "MQTT handlers tested as pure functions on parsed payloads" doesn't fit what handlers do.** Handlers call services, which persist data or push SSE, so they aren't pure. Say instead: "handlers take `(payload, ctx)`, where `ctx` injects `receivedAt`, services or repos and the hub, and tests pass fakes. Repository tests hit `stl_test`." Otherwise each story picks its own mocking style.
- **U-5 · AD-8's 250 ms budget has no check and conflicts with the 4 Hz coalescing.**
  - A trailing 250 ms coalesce alone uses the whole budget. If BC coalesces in the hub and W2b also throttles in its `vision-demand` handler, both legitimately, demand reaches SSE up to about 500 ms late.
  - Fix: coalescing lives only in the slice's owner (W2b) and is leading-edge (send at once, then hold 250 ms). The budget is checked by one test that stamps `receivedAt` and asserts the hub write time.

## Checked: no hole found

| Seam | Why it holds |
| --- | --- |
| Persisted-event idempotency (SC or VN ↔ W2a, W2c) | Publisher UUID plus a unique key plus `INSERT IGNORE`. `vehicle_count` is keyed on `(msg_id, approach, vehicle_class)`. |
| ClientIds and kick loops (SC ↔ FW ↔ bridge) | Fixed and unique, with exactly one active controller link. |
| Hour bucketing (W2a's chart ↔ W2a's slice) | Same owner, same `occurredAt` rule, numeric `CONVERT_TZ`. |
| Vehicle-class ids (S0 ↔ every reader) | The regex matches `VARCHAR(32)`, and unknown ids are accepted by rule. |
| Topic strings (BC ↔ SC ↔ VN ↔ FW) | Built only by `topics.ts`. `iid` defaults to `cat-01` on both sides. |
| Migration filenames across branches | dbmate timestamps can't collide, and merged migrations are immutable. |
| Handler fan-out on one topic | One file per concern, with no dependence between handlers on side effects. W2a keeps persist-then-slice in one file, as the rule implies. |
| Ports and hosts | Fixed, with `127.0.0.1` everywhere and the `DASHBOARD_ORIGINS` default covering both `localhost` and `127.0.0.1`. |
| Backend → controller topics | AD-18 limits them to `controller/override/cmd`. |

## Minimal patch set, in priority order

1. **AD-8:** SSE wire format and nullable slices (A-01); one writer per slice, `getSlice` (A-03); `useLiveEvent` and `useStreamEpoch` (A-08); dense `counts` (A-09); where coalescing lives (U-5).
2. **AD-14 and S0 scope:** S0 owns the entity DTOs `BreachItem`, `OverrideCommand` and `common.ts` (A-02, A-10). S0 installs every dependency (A-05). New extension points: `jobs/`, `lib/api/<resource>.ts`, `components/<route>/`. Shell owns `time.ts`, `use-vehicle-classes.ts`, `components/ui/` and a complete `visuals.ts` (A-04, A-19). Split `/log/` (A-04). Fix the registration-line rule (U-1).
3. **Dependency diagram:** composition root, `jobs → services`, read-only `services → services/link.ts`, stream route → hub (U-2, A-03, A-06).
4. **Staleness convention:** stream open, broker CONNECTED and role ONLINE, read through one `useLiveness` (A-07).
5. **AD-7:** `commandId` on release, ack within 1 s, TIMEOUT can be upgraded (A-11).
6. **AD-13, AD-10, AD-15:** tsconfig resolution (A-12), `DATABASE_URL` and backend-owned `db:migrate` (A-13), root script forwarding with `--` (A-16), the dashboard config carve-out (U-3).
7. **AD-4, AD-5, AD-11, AD-12, AD-17 contract precision:** `ts` as int epoch ms with a plausibility fallback, crop optional with a size cap in characters (A-14); a topic table with QoS and retain (A-18); graceful `online: false` (A-17); what `pcu` means, the controller ignores `confidence`, edge_vision loads the class file (A-15).
