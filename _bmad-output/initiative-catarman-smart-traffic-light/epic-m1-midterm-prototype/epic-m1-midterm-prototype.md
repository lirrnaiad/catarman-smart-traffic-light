---
type: epic
title: "M1 Midterm prototype"
parent: initiative-catarman-smart-traffic-light
covers: [CAP-1, CAP-2, CAP-3, CAP-4, CAP-5, CAP-6]
after: []
assignee: ""
risk: high
---

# M1 Midterm prototype

## Description

M1 delivers CAP-1 to CAP-6 of SPEC-smart-traffic-light on simulated telemetry, due Oct 26, 2026. The simulator stands in for the vision node and the ESP32. The Express/MySQL backend ingests and stores telemetry. The static Next.js dashboard shows live status, hourly traffic peaks, the MDRRMO override and the breach log. The spec owns the capabilities. The architecture spine owns integration, layout, build order and file ownership. DESIGN.md and EXPERIENCE.md own the screens.

## Outcome

At the Oct 26 midterm, the instructor runs the dashboard and backend from the repository on simulated telemetry and sees live status, hourly peaks, a working MDRRMO override and the breach log, with history that survives a restart: the spec's M1 success signal.

## Requirements

The spec's CAP-1 to CAP-6 (spec, Capabilities) are this epic's requirements, and the spine's AD-1 to AD-19 bind how they are built. Stories cite both directly; this epic adds no local ids.

## Done when

1. After installing from a fresh clone on the demo laptop per `docs/setup.md`, with the internet then off, `npm run build`, `npm start` and `npm run sim -- --scenario demo` bring up the dashboard at `http://127.0.0.1:4000/` on simulated telemetry. `npm run typecheck`, `npm run lint`, `npm test` and `npm run build -w dashboard` pass on `main`.
2. CAP-1: with no vision node or ESP32, every M1 view populates and updates. The simulator REPL drives L1–L4, flood, sensor and conflict faults, and breaches on demand. With the backend stopped, the simulator keeps cycling, and the dashboard reconnects when the backend returns (AD-3, AD-18).
3. CAP-3: on `/`, at 1920×1080 with no page scroll, each state change appears within 1 s without a reload. L1–L4, FAULT and an active override each read distinctly.
4. CAP-5: EXPERIENCE Flow 1 runs against the simulator. Each activation and release is confirmed first, shows as active only once the controller reports it, and writes a timestamped entry to `/log/overrides/`. The controller-offline, conflict-fault and timeout paths show their notices.
5. CAP-4 and CAP-6: the per-hour totals on `/traffic/` equal the stored `vehicle_count` sums for the same Asia/Manila hours. `/breaches/` lists every breach with time, class, approach and anonymized crop, and no identifying data is stored or shown.
6. CAP-2: after the backend and MySQL restart with the internet disabled, previously recorded counts, state changes, breaches and override entries are still returned. Counts and breaches published while the backend was stopped are stored once it restarts (AD-5, offline retention).

## Boundaries

Squad C's M1 code in the monorepo: `contracts/`, `backend/`, `simulator/`, `dashboard/`, `infra/` and `docs/setup.md`, on simulated telemetry only.

Not in this epic:

- M2 (CAP-7 to CAP-20), `edge_vision/` and `firmware/`.
- AD-19's retention purge and backups.
- The countdown, power source, boot count and speed alert.
- Hotspot broker mode and its ACL.
- The CSV export.
- CAP-11 polish beyond M1's three animations.
- The spec's Non-goals.

Rules every story follows:

1. It cites the CAP ids it delivers in `covers`, and the AD rules it implements in its References.
2. It owns only the files listed for it below. It edits a shared index only with its registration lines (one per owned file, alphabetical, one per line), and the `/` page only with its mount lines (AD-14).
3. A story that touches `dashboard/` builds from the mock and the EXPERIENCE.md sections in its References. EXPERIENCE.md and DESIGN.md win over any mock.
4. Done is AD-16:
   - `npm run typecheck`, `npm run lint` and `npm test` pass.
   - A story that touches `dashboard/` also passes `npm run build -w dashboard`.
   - Its CAP flow has been demonstrated against the simulator, and the steps are recorded in its plan.
   - While an upstream entry is not merged yet, the story demonstrates against fixtures, `mosquitto_pub` or seed data, then re-checks against the simulator once that entry lands (AD-14).
5. It renders no M2 field, even though the slices carry them: no `remainingS` countdown, no `power`, no `bootCount`, no `speedAlert`. The live-status mock's countdown is not built (EXPERIENCE, Component Patterns).
6. It adds no dependency and never edits `package-lock.json`. A needed package lands on `main` first as a one-commit chore (AD-13).

### File ownership

Paths are the spine's (Source tree, Backend file ownership, REST surface and dashboard routes). `be/` is `backend/src/` and `ui/` is `dashboard/src/`. "Registers" means one line per owned file in that index; "mounts" means one line in `ui/app/page.tsx`.

| # | Owns | Registers / mounts |
|---|---|---|
| 1 | Root: `package.json` (workspaces, every root script), `package-lock.json`, `.nvmrc`, `tsconfig.base.json`, `biome.json`, `.gitattributes`, `.gitignore`. Every workspace's `package.json` (with every script the root delegates to), `tsconfig.json` and `vitest.config.ts`. All of `contracts/`, including `vehicle-classes.json` and `schema/`. The initial migration in `backend/db/migrations/`, `backend/.env.example` (`DATABASE_URL` only), `backend/.env.test` and `backend/test/global-setup.ts` (runs `db:migrate:test`). `infra/`: `mosquitto/mosquitto.conf`, `mosquitto/compose.conf`, `compose.yaml`, `mysql/create-user.sql`, `scripts/broker.mjs`. `docs/setup.md`. | — |
| 2 | `be/config.ts`, `be/app.ts`, `be/index.ts`, `be/db/pool.ts`, `be/services/errors.ts`, `be/services/occurred-at.ts`, the error middleware, `be/http/routes/index.ts`, `stream.ts`, `health.ts`, `vehicle-classes.ts`, `be/jobs/index.ts`, `be/sse/hub.ts`, `backend/scripts/db-seed.ts` (the runner entry 1's `db:seed` script points at), `backend/test/reset-db.ts`. Adds its keys to `backend/.env.example`. | creates the route and job registries |
| 3 | `be/mqtt/client.ts`, `be/mqtt/publisher.ts`, `be/mqtt/handlers/index.ts`, the four `*.link.ts` handlers, `be/services/link.ts`, `be/jobs/link-watchdog.ts`. Extends entry 2's `index.ts` boot order, `config.ts`, `backend/.env.example` (MQTT keys, optional `MQTT_PASSWORD`) and `routes/health.ts`. | `jobs/index.ts`: link-watchdog |
| 4 | `simulator/src/index.ts`, `config.ts`, `repl.ts`, `controller-role.ts`, `behaviors/index.ts`, `scenarios/`; `simulator/.env.example`. | creates the behaviors registry |
| 5 | `simulator/src/vision-role.ts`, the demo scenario in `scenarios/`, `simulator/assets/placeholder-crop.jpg`. Extends entry 4's `index.ts` and `repl.ts`. | — |
| 6 | `dashboard/next.config.ts`, the PostCSS config, `ui/app/globals.css` (every DESIGN.md token), `ui/app/layout.tsx` (minimal, mounting `LiveProvider`), `dashboard/.env.development`, `dashboard/.env.production`; `ui/lib/config.ts`, `api/client.ts`, `time.ts`, `use-vehicle-classes.ts`, `visuals.ts`, `live/`. | — |
| 7 | Extends entry 6's `ui/app/layout.tsx` with the top bar, nav tabs, link health bar, state banners, loader and the polite live region; `ui/components/ui/` (LevelBadge, AspectLamp, StaleBadge, ClassLabel, ConfirmDialog). | — |
| 8 | `be/mqtt/handlers/controller-state.slice.ts`, `be/services/state.ts`; `ui/app/page.tsx` (three-column grid with named slots), `ui/components/live/` signal-state, ladder, flood and fault panels. | `handlers/index.ts` ×1 |
| 9 | `be/services/overrides.ts`, `be/http/routes/overrides.ts`, `controller-override-ack.resolve.ts`, `controller-state.resolve.ts`, `be/jobs/override-timeouts.ts`, every `be/db/repositories/override_command.*.ts` except entry 11's; `ui/lib/api/overrides.ts`, `ui/app/log/overrides/page.tsx`, `ui/components/override-log/`. | `handlers/index.ts` ×2, `jobs/index.ts` ×1, `routes/index.ts` ×1 |
| 10 | `ui/components/override/`. | mounts ×1 (right column, bottom) |
| 11 | `controller-state.persist.ts`, `be/jobs/state-dedup-preload.ts`, `be/http/routes/state-changes.ts`, `be/db/repositories/signal_state_change.*.ts` and `override_command.state-history.ts` (read only); `contracts/src/api/state-changes.ts`; `ui/lib/api/state-changes.ts`, `ui/app/log/states/page.tsx`, `ui/components/state-history/`. | `handlers/index.ts` ×1, `jobs/index.ts` ×1, `routes/index.ts` ×1, `contracts/src/index.ts` ×1 |
| 12 | `vision-counts.persist.ts`, `be/jobs/counts-slice.ts`, `be/services/counts.ts`, `be/db/repositories/vehicle_count.*.ts`, `backend/db/seed/01-vehicle_count.sql`. | `handlers/index.ts` ×1, `jobs/index.ts` ×1 |
| 13 | `vision-demand.slice.ts`, `be/services/demand.ts`; `ui/components/live/` map, PCU tag, counts table and hour total. | `handlers/index.ts` ×1, mounts ×2 (center; right column, top) |
| 14 | `be/http/routes/counts.ts`; `ui/lib/api/counts.ts`, `ui/app/traffic/page.tsx`, `ui/components/traffic/`. | `routes/index.ts` ×1 |
| 15 | `vision-breach.persist.ts`, `be/services/breaches.ts`, `be/http/routes/breaches.ts`, `be/db/repositories/breach_event.*.ts` and `breach_crop.*.ts`; `ui/lib/api/breaches.ts`, `ui/app/breaches/page.tsx`, `ui/components/breach/` log rows and crop thumb. | `handlers/index.ts` ×1, `routes/index.ts` ×1 |
| 16 | The Latest breach card, a new file in `ui/components/breach/`. | mounts ×1 (right column, middle) |
| 17 | Set when it starts, cleanup only. | — |
| 18 | `docs/m1-demo.md`, the recorded run. | — |

### Parallel rounds (3 developers)

| Round | Developer 1 | Developer 2 | Developer 3 |
|---|---|---|---|
| 0 | 1 | installs MySQL and Mosquitto (entry 1's person step) | same |
| 1 | 2 | 4 | 6 |
| 2 | 3 | 5 | 7 |
| 3 | 9 | 15 | 8 |
| 4 | 11 | 12 | 10 |
| 5 | 16 | 14 | 13 |
| 6 | 17 | — | — |
| 7 | 18 (whole squad) | | |

Rounds are a suggestion; `after` in `tickets.toml` holds the real prerequisites. The refactor sweep (17) is the first thing to shorten if Oct 26 is at risk.

## References

- spec — _bmad-output/initiative-catarman-smart-traffic-light/spec-smart-traffic-light/spec-smart-traffic-light.md, sections Capabilities (CAP-1 to CAP-6), Constraints, Non-goals, Success signal
- spine — _bmad-output/initiative-catarman-smart-traffic-light/architecture-smart-traffic-light/architecture-smart-traffic-light.md, AD-1 to AD-19, Consistency Conventions, Structural Seed, Capability → Architecture Map
- design — _bmad-output/initiative-catarman-smart-traffic-light/ux-smart-traffic-light/DESIGN.md
- experience — _bmad-output/initiative-catarman-smart-traffic-light/ux-smart-traffic-light/EXPERIENCE.md
- mocks — _bmad-output/initiative-catarman-smart-traffic-light/ux-smart-traffic-light/mockups/ (live-status, traffic-peaks, breach-log, override-log, state-history)
- constraint — _bmad-output/initiative-catarman-smart-traffic-light/spec-smart-traffic-light/degradation-levels.md (simulated controller timings, levels, fault, override priority)
- constraint — _bmad-output/initiative-catarman-smart-traffic-light/spec-smart-traffic-light/privacy-compliance.md (Tier 1 fields)
- milestones — _bmad-output/initiative-catarman-smart-traffic-light/spec-smart-traffic-light/milestones.md, M1

## Notes

- Decision: one epic for M1, covering CAP-1 to CAP-6 on simulated telemetry. M2 is parked in the initiative's Notes (user, 2026-10-23).
- Decision: the build order follows AD-14 and the user. S0 runs alone. Then the three cores (backend, simulator, dashboard shell) run in parallel, each as two back-to-back stories for one developer. Then the CAP stories. A core whose check needs another core demonstrates against fixtures or `mosquitto_pub` first, then re-checks once that core lands (AD-14, "Upstream not merged yet") (user, 2026-10-23).
- Decision: thin stories, 18 entries. CAP-5 and CAP-6 each land their backend and log page first, then their panels on `/`, so those panels can run in parallel (user, 2026-10-23).
- Decision: the dashboard shell (entry 7) builds the L4, OVERRIDE and FAULT state banners in its link health bar, shown on `/` only. EXPERIENCE and DESIGN place them there, and the spine names no owner. Entry 8 re-checks them against the simulator (user, 2026-10-23).
- Decision: CAP-6 owns the Latest breach card on `/` and `ui/lib/api/breaches.ts`. Entry 16 mounts the card with one line (AD-14), although EXPERIENCE's IA lists `/` as CAP-3's (user, 2026-10-23).
- Decision: the epic closes with a refactor sweep (17), then a hitl M1 demo run (18). There is no browser end-to-end suite, because AD-16 rules one out for M1 (user, 2026-10-23).
- Decision: the only lines parallel stories share are registration lines in the shared indexes and mount lines in `ui/app/page.tsx`, as AD-14 allows. Every other file has the one owner in File ownership (user, 2026-10-23).
- Decision: the 18-entry breakdown and this envelope were approved as drafted after the set check (user, 2026-10-23).
- Source conflict: AD-16 vs AD-14 — AD-16 says a handler's `ctx` "injects receivedAt, services and the hub", while AD-14 says services are not registered and CAP stories add only files plus registration lines. Building every CAP service into `ctx` or `createApp(deps)` would make entries 8, 9, 12, 13 and 15 edit `index.ts` and `app.ts` side by side.
- Decision: each CAP handler, route and job imports its own CAP's service module. `ctx` and `createApp(deps)` carry only core dependencies (`receivedAt`, the hub, the publisher, `getLink`, the pool), so tests still pass fakes. No CAP story edits `be/index.ts` or `be/app.ts`. The AD-16 wording goes to `bmad-architecture` (user, 2026-10-23).
- Tracer bullet: entry 8 is the first path through every layer: simulator → broker → backend → SSE → dashboard. Entry 1 and the cores come before it because AD-14 requires them. Entry 9 follows, because the override lifecycle (AD-7) is the least certain flow.
- Assumption: entry 11 adds `StateChangeItem` in `contracts/src/api/state-changes.ts` inside its own story, per AD-14's extension table. AD-4's one-commit chore applies to edits of S0's shapes and `contracts/schema/`, and a REST-only DTO changes neither.
- Assumption: entry 1 creates `backend/.env.example` with `DATABASE_URL` and `backend/.env.test`, so `db:migrate` runs. Entry 2 adds the backend's other keys. Entry 4 creates `simulator/.env.example`.
- Assumption: entry 1 creates every workspace script the root scripts delegate to, each pointing at files later entries create.
- Assumption: `next.config.ts`, the PostCSS config, the `globals.css` tokens and the dashboard's `.env` files belong to the shell (entry 6), not S0. AD-14 gives S0 only the TypeScript, Biome and Vitest configs.
- Source conflict: AD-15 — the spine commits `.env.example`, `backend/.env.test`, `dashboard/.env.development` and `dashboard/.env.production`, but the repo's current root `.gitignore` ignores `.env.*`. Entry 1 replaces `.gitignore` per AD-14, which settles it; the source needs no change.
- High-risk check, entry 1: Squad A's data and QA member reviews the initial migration (AD-10), and the Squad A and B leads receive the generated `contracts/schema/` (milestones, Week 1 action).
- High-risk check, entry 9: before merge, a second Squad C developer runs EXPERIENCE Flow 1's failure paths against the simulator.
- Open question (entry 7): does the demo laptop have a condensed system font (Bahnschrift, Liberation Sans Narrow, Nimbus Sans Narrow, DejaVu Sans Condensed)? If not, the shell bundles one through `next/font/local` (DESIGN, Typography).
- Open question (entry 18): which remote is the M1 repository submitted to? The repo has no remote yet.
