---
title: 'Breach ingest and breach log'
type: 'feature'
ticket: '15'
created: '2026-10-24'
baseline_commit: '42a43da1cc9e1e627ea61227954b0c05b4d00b79'
status: 'done'
route: 'dispatch'
risk: 'medium'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/epic-1-context.md'
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/epic-m1-midterm-prototype/story-12-history-vehicle-counts-and-the-counts-slice-plan.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `vision/breach` reaches the backend and is dropped. No breach is stored, the SSE `breach` occurrence never fires, and `/breaches/` doesn't exist, so the POSO enforcer in Flow 2 has no breach record to read.

**Approach:** Build entry 15 per AD-5, AD-6, AD-8, AD-9, AD-11 and the Privacy convention:
- a persist handler that runs AD-11's crop checks and stores each breach once per UUID, with its crop when the crop passes;
- `services/breaches.ts`, which writes the rows and emits `breach`;
- `GET /api/breaches` and `GET /api/breaches/:id/crop`;
- on the dashboard, `lib/api/breaches.ts`, a crop thumb that entry 16 reuses, and the `/breaches/` page.

## Boundaries & Constraints

**Always:**
- **Persist** (`mqtt/handlers/vision-breach.persist.ts`):
  - Runs every AD-11 crop check in this file: `mime` is `image/jpeg`; `data` passes `z.base64()` and is at most 204,800 characters; a SOF is found by walking marker segments from offset 2 exactly as AD-11 describes (skip `FF` fill and standalone markers, skip other segments by bounds-checked length, take the first SOFn, stop at SOS, EOI, a truncated length or a zero dimension; never scan for byte pairs, no image library); its long side is at most 64 px.
  - A failing crop is dropped with one `[mqtt]` warning naming the breach id and the failed check, never crop bytes. A missing crop is not a warning. A crop problem never loses the breach.
  - `occurred_at` = `occurredAt(ts, receivedAt)`; `received_at` = the message's `receivedAt`.
  - Errors are logged `[mqtt]` (message only) and never thrown.
- **`services/breaches.ts`** is the only `breach` emitter. It inserts `breach_event` with `ON DUPLICATE KEY UPDATE id = id`, then `breach_crop` when there is one, in one transaction. A redelivery is detected as story 12 does (`insertId > 0`, because of `CLIENT_FOUND_ROWS`): it writes no crop and emits nothing. A new row emits one `BreachItem`.
- **Routes** (`http/routes/breaches.ts`):
  - `GET /api/breaches`: `Page<BreachItem>` newest first by `received_at`, ties by `event_id`, both descending. `ListQuery` is parsed; the opaque cursor encodes the last item's `receivedAt` and `id` (the public UUID), and an undecodable cursor is 400 `VALIDATION_FAILED`.
  - `cropUrl` is `/api/breaches/<id>/crop` when a crop row exists, else `null`. Items never carry crop bytes.
  - `GET /api/breaches/:id/crop`: the bytes as `image/jpeg` with `Cache-Control: no-store`; 404 `NOT_FOUND` when the breach or its crop is missing; a non-UUID id is 400.
- **Repositories:** `db/repositories/breach_event.insert.ts` (event + crop in one transaction), `breach_event.list.ts`, `breach_crop.get.ts`. Parameterized SQL only.
- **Dashboard:**
  - `lib/api/breaches.ts`: `listBreaches({limit, cursor})` through `apiList`.
  - `components/breach/crop-thumb.tsx`: an `<img>` from `apiUrl(cropUrl)` with alt "Blurred, anonymized crop" and a "BLURRED" tag; when `cropUrl` is null or the image fails to load, the placeholder with "No crop". The default size is DESIGN's 156×104; a caller may size it smaller.
  - `components/breach/breach-log.tsx`: Log table (DESIGN) newest first with columns Time (Asia/Manila, `formatManila` time and date of `occurredAt`), Approach, Vehicle class (`ClassLabel`), Crop. It loads page 1 on mount and on each stream epoch (replacing the rows), "Load more" follows `nextCursor` (limit 50), each SSE `breach` is upserted by `id` at the top. `?id=` scrolls to and marks the matching row once it is loaded; it never fetches extra pages to find it (decision: an older breach is marked after Load more brings it in). Empty: "No breaches recorded." REST failure: an inline notice with the error code; the page keeps working.
  - `app/breaches/page.tsx`: mounts the log inside `<Suspense>`, since it calls `useSearchParams`.
- **Tests:** the crop checks against hand-built JPEG headers (no image files needed): the simulator placeholder passes; 65 px fails; an EXIF APP1 holding a 16×16 thumbnail before a 640×480 main SOF fails; truncated, non-base64, oversize string and wrong mime fail. Handler and service through `dispatch` against `stl_test`; routes with Supertest; the dashboard with `LiveTestProvider`.

**Never:**
- No Latest breach card or edits to `/` (entry 16). No simulator change, seed file, CSV export, filters, detail panel, "New" tag or retention countdown.
- No contract, migration, `package.json` or lockfile edit, and no dependency.
- No edits to `index.ts`, `app.ts`, the shell or core files, except one alphabetical registration line each in `handlers/index.ts` and `routes/index.ts`.
- Nothing identifying stored, logged or shown; no crop bytes in logs or list items; no re-encoding.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New breach | id A with the placeholder crop | one event row, one crop row, one `breach` emitted, `cropUrl` set | — |
| Redelivery | id A again | no new rows, nothing emitted | — |
| No crop | id B without `crop` | event stored, `cropUrl: null`, no warning | — |
| Oversize crop | 65×48 JPEG | event stored without crop | warning |
| EXIF thumbnail | small APP1 thumbnail, 640×480 main image | stored without crop | warning |
| Bad crop | wrong mime / not base64 / >204,800 chars / truncated / no SOF | stored without crop | warning |
| Old ts | `ts` 3 h ago | `occurredAt` = ts; list still ordered by `receivedAt` | — |
| Insert fails | DB throws | nothing emitted | logged, not thrown |
| Paging | 3 rows, `limit=2` | 2 newest, then the last via `nextCursor`, then `nextCursor: null` | — |
| Bad cursor | `cursor=xyz` | 400 `VALIDATION_FAILED` | — |
| Crop route | id with crop / without / unknown | 200 `image/jpeg` no-store / 404 / 404 | — |
| Live arrival | `breach` while the page is open | row at the top; same id twice shows once | — |
| Deep link | `/breaches/?id=A`, A on page 1 | row A scrolled into view and marked | — |
| Thumb failure | crop 404s | "No crop" placeholder | — |

</frozen-after-approval>

## Code Map

- **Branch:** `feat/m1-15-breach-log` is story 12's branch (1.2, 1.3, 1.5, 1.12) with `feat/m1-7-dashboard-shell-frame` (1.6, 1.7) merged. It has no `page.tsx` at all and no entries 8 to 11.
- **Contracts (read only):** `contracts/src/mqtt/vision-breach.ts` (`VisionBreach`, `BreachCrop` deliberately unchecked), `contracts/src/api/breaches.ts` (`BreachItem` with `centroid`), `contracts/src/api/stream/breach.ts` (`BreachEvent = BreachItem`), `contracts/src/api/common.ts` (`ListQuery`, `Page`, `ErrorCode`). Topic `vision/breach`: QoS 1, not retained.
- **Schema:** `backend/db/migrations/20261023011004_create_m1_tables.sql:35-57`: `breach_event` (`event_id CHAR(36)` unique, `approach`, `vehicle_class`, `centroid_x/y`, `occurred_at`, `received_at`, both indexed) and `breach_crop` (`breach_event_id` PK, `mime`, `data MEDIUMBLOB`, FK cascade).
- **Backend:**
  - `mqtt/handlers/index.ts`: `HandlerCtx`, `HandlerFor<T>`; register `visionBreachPersist` between `controllerStatusLink` and `visionCountsPersist`. `vision-counts.persist.ts` and `vehicle_count.insert.ts` are the handler and redelivery patterns to copy.
  - `http/routes/index.ts`: register `breaches` first (alphabetical). `routes/vehicle-classes.ts` is the route shape; `AppDeps {pool, hub, publisher, getLink}`; `AppError` in `services/errors.ts`. No cursor helper exists; this is the first paged route.
  - `sse/hub.ts:68` `emit("breach", item)` validates against `streamSchemas`. `services/occurred-at.ts` `occurredAt(ts, receivedAt: Date)`.
  - Tests: `test/reset-db.ts` (already clears both tables), `handlers/vision-counts.persist.test.ts` for the `dispatch` pattern.
- **Simulator (read only):** `vision-role.ts` attaches `simulator/assets/placeholder-crop.jpg` (64×48 baseline, no EXIF) to every breach; REPL `emit-breach [N|S|E|W] [class]`.
- **Dashboard:** `lib/api/client.ts` (`apiList`, `apiUrl`, `ApiRequestError {code, status}`), `lib/live/hooks.ts` (`useLiveEvent("breach", fn)`, `useStreamEpoch`), `lib/live/live-test-provider.tsx` (`bus.emit`), `lib/time.ts` `formatManila`, `lib/visuals.ts` (`approachVisuals`, `classColor`), `components/ui/class-label.tsx`, `lib/use-vehicle-classes.ts`, `components/ui/styles.ts` (`stencil`, `focusRing`), `shell/loader.tsx`. The nav already links `/breaches/`. Tests are colocated `*.test.tsx` with Testing Library.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/db/repositories/breach_event.insert.ts`, `breach_event.list.ts`, `breach_crop.get.ts` -- transactional insert with redelivery signal, keyset page, crop bytes.
- [x] `backend/src/services/breaches.ts` -- record and emit; list with cursor encode and decode; crop lookup.
- [x] `backend/src/mqtt/handlers/vision-breach.persist.ts` -- crop checks and SOF walk, plus its registration line.
- [x] `backend/src/http/routes/breaches.ts` -- list and crop routes, plus its registration line.
- [x] `dashboard/src/lib/api/breaches.ts`, `components/breach/crop-thumb.tsx`, `components/breach/breach-log.tsx`, `app/breaches/page.tsx`.
- [x] Tests -- every matrix row.

**Acceptance Criteria:**
- Given the broker, the backend, the dashboard and the simulator's vision role, when `emit-breach E tricycle` runs, then `/breaches/` shows it at the top within a second with Asia/Manila time, East, Tricycle and the blurred crop, and the database holds it once.
- Given an oversize crop and an EXIF-thumbnail crop sent with `mosquitto_pub`, then both breaches are listed with "No crop".
- Given the backend restarts, then every stored breach is still listed and still served its crop.
- When `npm run typecheck`, `npm run lint`, `npm test` and `npm run build -w dashboard` run, then all exit 0.

## Implementation Notes

- Redelivery uses story 12's signal: `insertBreachEvent` returns `insertId > 0` (CLIENT_FOUND_ROWS), and the crop row uses that `insertId` as `breach_event_id`. A failed crop insert rolls the event back (tested), so nothing is emitted.
- `checkCrop` and `sofSize` are exported from the handler for the unit tests. Check order: mime, size (at most 204,800 chars, before decoding), `z.base64()`, the SOF walk (which also requires SOI `FFD8`), long side at most 64. The warning is `[mqtt] vision/breach <id> crop dropped: <check> check failed`.
- Cursor: base64url of JSON `[receivedAtIso, id]`, parsed back with `z.tuple([isoUtc, uuid])`; any failure is `AppError VALIDATION_FAILED`. The keyset is `received_at < ? OR (received_at = ? AND event_id < ?)`, fetching `limit + 1` to set `nextCursor`.
- Test JPEG headers live in `backend/test/jpeg.ts`. They are hand-built; the placeholder fixture mirrors `placeholder-crop.jpg` (JFIF, DQT, SOF0 64×48).
- Dashboard: the deep-linked row gets `aria-current="true"` and the selected-row band (a white 6px edge). The log uses an 87×58 thumb inside its 66px rows. Two `biome-ignore` lines: `<img>` (the spec asks for it; static export) and the `epoch` effect dependency (it is the trigger).
- A `breach` that arrives before page 1 has loaded is not held. The page-1 response includes it, because it is stored before it is emitted.

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence | Route |
|---|--------|---------|---------|----------|-------|
| 1 | blind, edge | A Load more in flight across a stream epoch appends the old page 2 under the new page 1 and keeps the old cursor | low | `loadMore` sets rows and `next` without checking the epoch; a reconnect during paging is rare, but the fix is a direct guard | patch |
| 2 | blind | Nothing renders while page 1 loads | low | `rows` null and no error renders only the heading; the shell's `Loader` exists | patch |
| 3 | verification-gap | The Load more failure path is untested | medium | Pre-verified: removing the catch or wiping rows passes all 8 tests | patch |
| 4 | verification-gap | `?id=` marking after Load more is untested | medium | Pre-verified: tying the mark to the page-1 load passes every test | patch |
| 5 | blind | The crop response has no `X-Content-Type-Options: nosniff` | low | Device-supplied bytes; one header, a direct correction | patch |
| 6 | blind | The 204,800-character limit is tested only above the boundary | low | Only 204,804 is tested; one assertion | patch |
| 7 | blind | A DB error loses the breach | medium | `vision-breach.persist.ts` logs and returns; the ack-anyway dispatch is 1.3's design, already deferred by story 12 | defer |
| 8 | blind, edge | Page 1 failing leaves no retry, and live breaches are dropped until the next epoch | low | The REST failure pattern asks only for the inline notice; a backend outage also drops the stream, and the reconnect epoch reloads page 1 | reject |
| 9 | edge | A redelivered breach with a bad crop logs the crop warning again | low | Cosmetic; a redelivery is rare and the fix reorders check and insert | reject |
| 10 | blind, verification-gap | An emit failure is logged as "not stored" | low | Production uses `createHub({validate: "log"})` (`index.ts:13`), which never throws; only tests use throw mode | reject |
| 11 | blind | No notice when the `?id=` breach isn't loaded | low | The user chose "mark only if loaded" at planning | reject |
| 12 | blind | The time column shows `occurredAt` while the list sorts by `receivedAt` | low | Both are frozen intent (EXPERIENCE: breaches show `occurredAt`; AD-6: `receivedAt` orders history); changing either edits the spec | reject |
| 13 | blind | The keyset query isn't backed by a `(received_at, event_id)` index | low | M1 holds hundreds of rows; a migration is out of scope for this story | reject |
| 14 | blind | A breach stored without a crop can't gain one from a redelivery | false | A redelivery is the same message with the same crop, so it would fail the same check | reject |
| 15 | blind | No route test for a limit above the maximum | false | `breaches.test.ts` "rejects an out-of-range limit with 400" | reject |
| 16 | blind | No test that a redelivery with a different crop keeps the first | low | Redeliveries carry the same payload | reject |
| 17 | blind | The plan isn't in the diff | false | The plan is the claims file, given to the edge-case layer by design | reject |

## Verification

**Commands:**
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build -w dashboard` -- expected: all exit 0.

**Manual checks:**
- The Acceptance Criteria against the broker, `npm run dev` and the simulator, with `/breaches/` in headless Edge at 1920×1080 (no horizontal scroll), `?id=` marking, and row counts from `stl`.

**Results (implementer, 2026-10-24, Windows, Mosquitto from `npm run broker`, MySQL `stl`):**
- `npm run typecheck`, `npm run lint`, `npm test` (contracts 174, backend 96, simulator 68, dashboard 90) and `npm run build -w dashboard` exit 0. The build lists `/breaches` as static.
- Simulator `--roles vision`, REPL `emit-breach E tricycle`: one `breach` SSE frame with `cropUrl` set, 1 ms after `receivedAt`. `GET /api/breaches/<id>/crop` returned 200 `image/jpeg` with `Cache-Control: no-store`, and the bytes match `placeholder-crop.jpg` exactly.
- A 65×48 crop and an EXIF-thumbnail crop (640×480 main image) were published over MQTT with a scratch mqtt.js client, since this machine has no `mosquitto_pub`. Both were stored and listed with `cropUrl: null`, with one `crop dropped: long side check failed` warning each.
- After killing and restarting the backend, all 3 breaches were listed and the crop was still served (200). `stl` holds 3 `breach_event` rows and 1 `breach_crop`, with no duplicate `event_id`.
- Not done: the headless Edge check of `/breaches/` at 1920×1080 (no horizontal scroll, `?id=` marking, the row appearing within a second). The UI is covered only by the component tests.
- All processes were stopped; ports 4000 and 1883 are free. The live run left 3 breaches in `stl`.

**After review fixes (2026-10-24):**
- The page-1 loading state is an inline "Loading breaches…" line, not the shell's `Loader`, which is the full-screen "Connecting" overlay for the SSE stream.
- `npm run typecheck`, `npm run lint`, `npm test` (contracts 174, backend 97, simulator 68, dashboard 93) and `npm run build -w dashboard` exit 0.
- Headless Edge at 1920×1080 against the broker, `npm run dev` and the simulator's vision role:
  - `/breaches/` listed the 3 stored breaches 355 ms after navigation.
  - `emit-breach E tricycle`: the new row was on top 43 ms after the REPL line, showing 17:23:23, East approach, Tricycle and the 64×48 crop with its BLURRED tag; stored once.
  - A breach without a crop, published twice with `mosquitto_pub` (`C:\Program Files\mosquitto`): one row on top with "No crop", one row in the API.
  - `?id=` of the third row: that row alone marked and in the viewport.
  - No horizontal scroll (`scrollWidth` 1920).
- The live runs left 5 breaches in `stl`.
