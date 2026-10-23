---
review: rubric
target: ../architecture-smart-traffic-light.md
inputs:
  - ../.memlog.md
  - ./review-reconcile.md
  - ../../spec-smart-traffic-light/spec-smart-traffic-light.md
  - ../../spec-smart-traffic-light/{degradation-levels,stack,privacy-compliance,kpis,milestones,risks,hardware,users,glossary,roadmap}.md
date: 2026-10-22
---

# Rubric review: architecture spine vs. good-spine checklist

## Verdict

**Revise before ticketing.** The spine is sound: the contract, delivery semantics, time authority, override lifecycle, static-client and toolchain rules are concrete and enforceable, and every CAP is covered. The problems cluster in AD-14 (single-owner, extend-by-addition), which is the spine's main promise to three parallel developers. Several files every wave-2 story must touch have no extension point. One dashboard page spans two wave-2 stories. Some core-owned contracts (the LiveProvider API, `link.controller` liveness, SSE occurrence payloads) are left for whoever gets there first.

Counts: critical 0 · high 2 · medium 7 · low 13.

Reconcile fixes R-01 to R-25 were checked. Three were applied in a way that leaves a gap or causes a new one: R-01 → RB-07, R-04 → RB-03, R-05 → RB-06. R-12 was only partly applied (RB-12).

## Findings

### RB-01 · high · Shell- and core-owned files that every wave-2 story has to edit

- **Checklist:** 1, 7 (AD-14 vs. AD-9 and the conventions)
- **Location:** AD-14 extension-point table; AD-9 ("Data comes only through `src/lib/api.ts`"); Dashboard data convention ("`api.ts` functions"); AD-8 (counts pushed at the hour boundary); AD-5 (latest `signal_state_change` read at startup); AD-7 step 4 (`REQUESTED` swept to `TIMEOUT` at startup, plus a 5 s timer).
- **Problem:** The dashboard shell owns `api.ts`, and the CAP-2/4, CAP-3/5 and CAP-6 stories each have to add fetch functions to it. Those are function bodies, not one registration line, so the file gets three-way merge conflicts. On the backend, several pieces need a place to run at startup or on a timer, and the extension table has no row for one: the initial `counts` slice on connect, the hour-boundary timer, the state-dedup preload, and the override TIMEOUT sweep. Without a row, each story edits the core-owned `src/index.ts` or `app.ts`.
- **Fix:** Add rows: "API client → `dashboard/src/lib/api/<resource>.ts` (shell ships a typed `apiGet/apiPost` in `api/client.ts`)" and "Startup task or timer → `backend/src/services/<name>.ts` exporting `start()`, registered in `backend/src/startup/index.ts`".

### RB-02 · high · A dashboard page belongs to two wave-2 stories

- **Checklist:** 1, 7
- **Location:** Source tree `dashboard/src/app/` comment (`log/` = "override + state history, CAP-2/CAP-5" [ASSUMPTION]; `page.tsx` = CAP-3 + CAP-5); REST table owners (`/api/state-changes` → CAP-2 story, `/api/overrides` → CAP-5 story); AD-14 ("Dashboard page | `<route>/page.tsx`", one owner); "Suggested M1 split … (not binding)".
- **Problem:** `log/page.tsx` needs the CAP-2+4 story and the CAP-3+5 story, which are different wave-2 stories in the spine's own split. `/` holds CAP-3 and CAP-5 together only because the split pairs them, and the split is declared non-binding. If `bmad-ticket` separates CAP-3 from CAP-5, `page.tsx` gets two owners.
- **Fix:** Bind page ownership: `/log/` belongs to the CAP-5 story and shows overrides only. State history moves to its own `/history/` page (CAP-2), or it stays API-only. Also say that a page composes owned components from `src/components/<cap>/`, so a second CAP adds a component, not page edits.

### RB-03 · medium · The LiveProvider contract covers slices only

- **Checklist:** 1, 2 (AD-8), 7 (Staleness convention vs. AD-18)
- **Location:** AD-8 ("components read slices with `useLive(name)`"); Staleness convention (keyed only on `link.controller`/`link.vision`); AD-18 ("Stopping the backend … is a recorded step in the CAP-1 demo"); AD-16 (jsdom).
- **Problem:** (a) There is no API for the occurrence events (`breach`, `override`). The CAP-5 and CAP-6 stories will either edit `live-provider.tsx`, which the shell owns, or open a second `EventSource`, which breaks AD-8. (b) There is no SSE connection state. When the backend stops, which is a scripted demo step since the AD-18 fix for R-04, the frozen `link` slice still reads ONLINE and every view shows stale data as live. (c) jsdom has no `EventSource`, so each story will mock it in its own way.
- **Fix:** Fix the shell's API in AD-8: `useLive(slice)`, `useLiveEvent(name, cb)`, `useLiveStatus()` (`OPEN | RECONNECTING`, where every slice counts as stale unless `OPEN`), and a `LiveTestProvider` for tests.

### RB-04 · medium · No story owns `link.controller` liveness

- **Checklist:** 1, 7 (AD-14 vs. the topic table)
- **Location:** AD-14 backend core ("the `status` and `heartbeat` handlers that feed the `link` slice"); topic table, `controller/state` row ("marks `link.controller` `STALE` after 5 s"); AD-5; AD-7 step 2 (a 409 when not `ONLINE`).
- **Problem:** The STALE→ONLINE and ONLINE→STALE transitions come from `controller/state`, not from `status` or `heartbeat`. No owned handler covers them. The backend core developer, the CAP-3 developer or the CAP-5 developer (who needs it for the 409 gate) could each build it, and fan-out handlers writing the `link` slice in different ways would conflict.
- **Fix:** Add `controller-state.link.ts` to the backend core's list in AD-14, and say that only backend-core handlers write the `link` slice.

### RB-05 · medium · S0 has to write SSE schemas for DTOs that later stories own and the spine never defines

- **Checklist:** 1, 7 (AD-14 vs. the SSE table)
- **Location:** AD-14 (S0 creates "every … SSE event schema"); SSE table (`breach` = "one breach list item", `override` = "one `override_command` record"); extension table (a REST DTO is added by its CAP story); the REST table says only "breach list items with `cropUrl`".
- **Problem:** S0 cannot write the `breach` and `override` event schemas without inventing the breach list item and the override record. The CAP-6 and CAP-5 stories own those DTOs and will define them again. Field names are unspecified (`occurredAt`/`receivedAt`, `requestedAt`/`resolvedAt`, `cropUrl`), so the two definitions can drift.
- **Fix:** Add the `BreachListItem` and `OverrideRecord` field lists to the Structural Seed. S0 creates them in `contracts/src/api/`, and the CAP stories import them.

### RB-06 · medium · A release (`NONE`) can only be confirmed by a QoS 0 ack

- **Checklist:** 2 (AD-7), 7 (AD-7 vs. the `controller/state` example)
- **Location:** `controller/state` example (`commandId` is present only "while an override is active"); AD-7 step 4; AD-5 (ack is QoS 0); the R-05 fix (state republished every 2 s).
- **Problem:** After a release, `state.override` is `{mode: "NONE"}` with no `commandId`, so the periodic state that R-05 added cannot resolve a release. A dropped ack gives a false `TIMEOUT` on exactly the action CAP-5 must log. It also leaves the simulator's output open: some implementations would include a `commandId` with `NONE`, and some wouldn't.
- **Fix:** Make `state.override.commandId` the id of the last applied command for every mode, `NONE` included, and absent only before any override.

### RB-07 · medium · Parallel cores against one root lockfile

- **Checklist:** 1, 4
- **Location:** AD-13 (one root `package-lock.json`, `npm install <pkg> -w`); AD-14 (three cores in parallel after S0); Stack table.
- **Problem:** The R-01 fix moved the backend, dashboard and simulator cores into parallel stories, and each will install its own dependencies. That conflicts `package-lock.json` (and the workspace `package.json` files) on every merge. The Stack table also leaves out packages that S0 would need to pre-install: `@testing-library/dom` (a required peer of RTL 16), `@types/node`, `@types/react`/`react-dom`, `@types/supertest`, `postcss`, and a JSX transform for Vitest (for example `@vitejs/plugin-react`).
- **Fix:** S0 installs every Stack-table dependency into its workspace. Later stories add a dependency only with a lockfile rule ("take main's lock, rerun `npm install`"), and the missing packages go into the table.

### RB-08 · medium · "Seeded rows" are relied on, but nothing produces them

- **Checklist:** 1, 6
- **Location:** AD-14 ("demonstrates … against fixtures or seeded rows"); Suggested split, last paragraph; AD-16; source tree `backend/test/fixtures`.
- **Problem:** Each wave-2 story will write its own seed SQL or script, and may add its own root script. For the M1 demo, a freshly started simulator fills only the current hour, so the CAP-4 chart shows one bar.
- **Fix:** Give one owner, the backend core, a `npm run db:seed` that writes a fixture set (24 h of counts, breaches with the placeholder crop, overrides, state changes) to `stl` through the repositories. Stories add fixture files in `backend/test/fixtures/<table>.ts`.

### RB-09 · medium · The optional compose path can't use the one Mosquitto config

- **Checklist:** 6, 7 (AD-15 internal)
- **Location:** AD-15 ("Mosquitto runs only from `infra/mosquitto/mosquitto.conf`"; "`listener 1883 127.0.0.1`"; "`infra/compose.yaml` is an optional alternative"); Local setup.
- **Problem:** Inside a container, a listener bound to `127.0.0.1` can't be reached through a published port, so compose users will get connection refused. They'll then edit the shared conf and break native users. This matters most on Windows, where host networking isn't the default.
- **Fix:** Add `infra/mosquitto/compose.conf` (`listener 1883 0.0.0.0`), with compose publishing `127.0.0.1:1883:1883` and `127.0.0.1:3306:3306`, and name both files in AD-15.

### RB-10 · low · The dependency-direction rule forbids imports every file needs

- **Checklist:** 2, 7
- **Location:** Dependency diagram ("anything not drawn is forbidden").
- **Problem:** `config.ts`, `app.ts`/`index.ts`, `mqtt/client.ts`→`handlers/index.ts`, `repos`→`pool`/`contracts`, and the `/api/stream` route→`sse/hub` aren't drawn. Read literally, the rule bans importing config and gives no legal way to mount the stream.
- **Fix:** Draw the composition root (`index.ts`/`app.ts` may import everything) and `config.ts` (importable by all). State that `/api/stream` attaches to the hub through a service or in `app.ts`.

### RB-11 · low · Status retention on clean disconnects

- **Checklist:** 1, 2 (AD-5, AD-3)
- **Location:** AD-5 ("sets an LWT with the same shape"); AD-3 (REPL "stop or start the vision role"; exits on a retained `source: "live"`).
- **Problem:** A clean MQTT disconnect suppresses the LWT, and the spine doesn't say the will is retained. After a clean exit or a REPL vision stop, the retained status stays `online: true`: the dashboard shows STALE instead of OFFLINE, and a stale retained live status blocks the simulator.
- **Fix:** Make the will retained, and require each link to publish a retained `online: false` before a clean disconnect. The REPL vision stop does the same.

### RB-12 · low · The R-12 fix was only partly applied: the default queue cap limits offline retention

- **Checklist:** 2 (AD-5 says it "carries the offline-retention KPI")
- **Location:** AD-5 (`clean: false` + `persistence true`); AD-15 broker config.
- **Problem:** Mosquitto's default `max_queued_messages 1000` drops QoS 1 messages once about 16 minutes of 1 Hz counts, plus breaches, have queued while the backend is down. The KPI says 100%.
- **Fix:** Add `max_queued_messages 0` (or a stated size) to the repo config in AD-15.

### RB-13 · low · Internal consistency nits

- **Checklist:** 7
- **Location / problem:**
  - (a) AD-5 says "Every link publishes a retained `status`", but there is no backend status topic.
  - (b) The topic table's `controller/state` row leaves out override resolution (AD-7 step 4).
  - (c) In the override sequence diagram, the 409 branch leaves out the SSE `override` push that AD-7 step 2 requires.
  - (d) The `link.broker` values `CONNECTED`/`DISCONNECTED` aren't in the Enums convention.
- **Fix:** Change (a) to "every controller and vision link". Add "resolves a matching `override_command`" to the `controller/state` row. Add the SSE arrow to the 409 branch. Add `Broker: CONNECTED, DISCONNECTED` to Enums.

### RB-14 · low · The env-var contract between S0, the backend core and the dashboard is open

- **Checklist:** 1, 7 (AD-15 vs. AD-9 and AD-10)
- **Location:** AD-15 ("Each runnable package reads config only in its own `src/config.ts` … from that package's `.env`"); AD-9 (`NEXT_PUBLIC_API_URL`, dev vs. empty); AD-10 (dbmate).
- **Problem:**
  - dbmate reads `DATABASE_URL` from `backend/.env`. S0 writes `db:migrate` and the backend core writes `config.ts`, and they may pick different variable names.
  - Next.js also loads `.env` during `next build`, so the demo build bakes in the dev URL.
  - The source tree shows no `dashboard/src/config.ts`.
- **Fix:** Fix `DATABASE_URL=mysql://…` as the one DB variable for dbmate and `config.ts`. Put the dashboard's dev URL in `.env.development` and an empty value in `.env.production`. Add `dashboard/src/config.ts`.

### RB-15 · low · AD-16's "pure functions" wording contradicts the persist handlers

- **Checklist:** 2 (AD-16)
- **Location:** AD-16 ("MQTT handlers … tested as pure functions on parsed payloads").
- **Problem:** Persist handlers write MySQL, so they aren't pure. Stories will split between `vi.mock` and injecting the publisher and hub, which gives three test styles again.
- **Fix:** Say "handlers are invoked directly with parsed payloads and real `stl_test`. The publisher and hub are injected through `createApp(deps)`/`registerHandlers(deps)` and faked in tests."

### RB-16 · low · The additive-field rule depends on non-strict schemas

- **Checklist:** 2 (AD-4)
- **Location:** AD-4 ("Adding an optional field needs no version bump"; `z.toJSONSchema`).
- **Problem:** `z.strictObject`, or emitted JSON Schema carrying `additionalProperties: false`, would make an additive field a breaking change for Python and C++ validators.
- **Fix:** State that payload schemas use `z.object` (unknown keys ignored), and that the generated JSON Schema is emitted without `additionalProperties: false`.

### RB-17 · low · The AD-12 runtime-labels rule isn't enforced

- **Checklist:** 2
- **Location:** AD-12 ("dashboard takes its labels from [`/api/vehicle-classes`] at runtime"); dependency diagram (`dashboard → contracts` is allowed).
- **Problem:** Nothing stops a dashboard file from importing `contracts/vehicle-classes.json` at build time, and the static export would then need a rebuild after a class edit.
- **Fix:** Add "the dashboard never imports `vehicle-classes.json`" to AD-9 and AD-12.

### RB-18 · low · The duplicate path for idempotent breach ingest is unstated

- **Checklist:** 2 (AD-5, AD-11)
- **Location:** AD-5 (`INSERT IGNORE`); AD-11 (one transaction for `breach_event` + `breach_crop`).
- **Problem:** On redelivery, `INSERT IGNORE` returns `insertId` 0, so the crop insert and the SSE `breach` push must be skipped. `INSERT IGNORE` also turns non-duplicate errors into warnings.
- **Fix:** Use `INSERT … ON DUPLICATE KEY UPDATE id = id`. When `affectedRows = 0`, skip the child rows and the SSE push.

### RB-19 · low · Distro MySQL may fall outside the accepted versions

- **Checklist:** 4, 6
- **Location:** Stack ("9.7 LTS (8.4 LTS accepted)"); Local setup step 1 ("distro `mysql-server`").
- **Problem:** Some current LTS distros ship 8.0 under `mysql-server`. Fedora names the package `community-mysql-server`.
- **Fix:** Name the Oracle MySQL APT/YUM repo as the Linux path, or accept 8.0 explicitly. Nothing the spine uses needs a later version.

### RB-20 · low · The spec's pedestrian-countdown open question isn't addressed

- **Checklist:** 5, 6
- **Location:** Deferred and Open Questions (absent); spec OQ `[M2 · team]` on pedestrian/countdown displays.
- **Problem:** If the countdown goes on the dashboard, `controller/state` needs a remaining-time field. That is an additive change, but it falls inside the Week-1 schema lock and isn't tracked.
- **Fix:** Add a Deferred line: "countdown display: an optional `remainingS` per phase in `controller/state`, added only if the team keeps it in M2."

### RB-21 · low · The root-to-workspace argument passthrough for the demo scenario isn't specified

- **Checklist:** 1
- **Location:** AD-3 (`npm run sim -- --scenario demo`); source tree root scripts (created by S0).
- **Problem:** If the root `sim` script is `npm run start -w simulator`, then `--scenario` is parsed by npm as an npm config flag and never reaches the simulator. S0 and the simulator core could each assume a different arrangement.
- **Fix:** Fix the root script as `"sim": "npm run start -w simulator --"`.

### RB-22 · low · `cropUrl` origin

- **Checklist:** 1
- **Location:** AD-11 ("list items carry `cropUrl`"); AD-9 (dev dashboard on :3000, API on :4000).
- **Problem:** A relative `/api/…` URL breaks `<img src>` in dev. Nothing says whether the backend or `api.ts` resolves it, and later URL fields (the CAP-9 export) will hit the same question.
- **Fix:** Add a convention: DTO URLs are API-relative paths, and the dashboard prefixes them with `NEXT_PUBLIC_API_URL`.

### RB-23 · low · Hygiene: missing [ASSUMPTION] tags and inline rationale

- **Checklist:** 8
- **Location:**
  - AD-7: the 5 s TIMEOUT, which the memlog lists as an assumption, is untagged.
  - AD-11: the 200 KB cap is untagged.
  - AD-5: the 2 s republish, 5 s STALE and 5 s keepalive are untagged.
  - Topic table: the 3 s vision STALE is untagged.
  - Inline "because …" rationale appears in AD-6 (numeric offset), AD-8 (compression), AD-15 (`::1`) and the Stack TypeScript note.
- **Fix:** Tag the inferred numeric values [ASSUMPTION] and move the "because" clauses to the memlog.

## Checklist summary

| # | Item | Result |
| --- | --- | --- |
| 1 | Fixes the real M1 divergence points | Mostly. Gaps in extension points and ownership: RB-01, RB-02, RB-03, RB-04, RB-05, RB-07, RB-08 |
| 2 | Every AD Rule is enforceable and prevents its divergence | Mostly. AD-7 has a release hole (RB-06). AD-14 and AD-8 are incomplete. Minor gaps: RB-10, RB-11, RB-12, RB-15 to RB-18 |
| 3 | Nothing deferred lets two M1 units diverge | Pass. Every Deferred item is M2-only or cannot affect M1, and the link-drop override behavior is covered by AD-7's truth-from-state rule |
| 4 | Named tech is current | No obvious version errors (deep check is separate). The table is incomplete for S0 installs (RB-07). Distro MySQL (RB-19) |
| 5 | Covers the spec's capabilities | Pass. CAP-1 to CAP-20 are all mapped; CAP-7, CAP-9 and CAP-10 are deferred with constraints. One spec open question is untracked (RB-20) |
| 6 | No silent dimension | Mostly pass. Dev and demo environments, local-only infra, ops (health, logs, mysqldump, no CI), security and privacy are all covered. Gaps: seed data (RB-08) and the compose envelope (RB-09). The git branch and merge workflow for registration-line conflicts is also silent (low; it could sit with AD-14) |
| 7 | Internal consistency | Ownership tables vs. AD-14 (RB-02, RB-04, RB-05); the SSE topic vs. sequence diagram (RB-13); AD-15 vs. AD-9 env (RB-14). The ERD agrees with AD-5 and AD-6 |
| 8 | Hygiene | No placeholders or template comments. Some missing tags and inline rationale (RB-23) |

## Checked and sound (no finding)

- **Topic table vs. AD-5:** QoS, retained flags, publishers, the ≤512 B ESP32 limit and the clientIds all agree.
- **ERD vs. AD-6:** `occurred_at` and `received_at` are on the vision tables and only `received_at` is on `signal_state_change`. The composite unique key on `vehicle_count` matches the per-crossing rows.
- **Privacy:** the Tier 1 rule as reworded by R-07 is consistent with every table and payload. Logs exclude crops.
- **AD-9 static export:** a violation fails `next build`, so the rule enforces itself.
- **AD-10:** dbmate timestamped migrations apply out of order safely across branches.
- **AD-18 and the topic table:** the controller consumes only heartbeat, demand and cmd. The backend publishes only cmd.
- **CAP-3 data needs:** level, signals and flood come from `state`; per-class counts from `counts`; PCU from `demand`. All present.
