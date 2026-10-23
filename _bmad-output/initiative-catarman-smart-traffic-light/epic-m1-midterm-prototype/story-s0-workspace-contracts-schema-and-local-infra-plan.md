---
title: 'S0: workspace, contracts, schema and local infra'
type: 'feature'
ticket: '1'
created: '2026-10-23'
status: 'built'
baseline_revision: 'f27587b1be34048ac0298976c20cfe74a6de9d21'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-catarman-smart-traffic-light/architecture-smart-traffic-light/architecture-smart-traffic-light.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The repo holds only planning docs. Every M1 story needs one workspace, one pinned toolchain, the shared contract shapes, the M1 schema and a local broker and database before it can start (AD-14).

**Approach:** Land the AD-14 foundation in one story: an npm-workspace monorepo with every Stack dependency pinned, the tooling configs, `@stl/contracts` with every Structural Seed shape plus the generated JSON Schema, the initial dbmate migration, `infra/` and `docs/setup.md`. Write no backend, simulator or dashboard runtime code.

## Boundaries & Constraints

**Always:** Follow the spine: AD-4, AD-5 (topic QoS and retain), AD-7 rule 6, AD-8 wire format, AD-10, AD-11 optional crop, AD-12, AD-13, AD-14, AD-15, AD-16, Stack, Structural Seed. Pin Stack versions exactly, with `vite` 8.3.4 explicit. Use `z.object` (never strict), `ts` as `int 1.6e12..4.1e12`, `v: z.literal(1)`, and `reason` as the regex string `^[A-Z][A-Z0-9_]{0,31}$`, never an enum. `contracts/src/` imports only `zod`. npm scripts stay cmd/PowerShell/bash-safe. Relative imports carry `.ts`.

**Never:** No `src/` code in backend, simulator or dashboard. No `next.config.ts`, PostCSS config, `globals.css`, dashboard `.env*` or `simulator/.env.example` (entries 4 and 6 own them). No `StateChangeItem` (CAP-2's). No M2 files (hotspot conf, ACL). No TypeScript `enum`. No `additionalProperties: false` in the generated schema.

**Decisions (user, 2026-10-23):**
- Keep S0 as one plan (~3,100 tokens).
- Compose MySQL: `compose.yaml` carries an inline init (`configs.content`) that creates `'stl'@'%'` inside the container only, with `create-user.sql`'s grants, plus a random root password. The host port stays `127.0.0.1:3306`. `create-user.sql` stays `localhost`/`127.0.0.1`-only for native installs, and compose users skip it.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Spine examples | each jsonc example in MQTT contract v1 | parses with its topic's schema | No error expected |
| Unknown keys | a payload plus an extra key | parses; key stripped | No error expected |
| Override variants | `controller/state` with `override` absent, or `{mode:"NONE"}` without `commandId` | parses | No error expected |
| Corridor without phase | `override`, `override/cmd` or `OverrideRequest` with `CORRIDOR` and no `phase` | rejected | ZodError |
| Unknown rejection code | ack `REJECTED`, `reason:"FOO_BAR"` | parses | none; `reason:"bad"` or missing reason is rejected |
| Seconds, not ms | `ts: 1793000000` | rejected | ZodError |
| Counts edge | empty `crossings`, `count: 0`, or a repeated approach+class pair | rejected | ZodError |
| Breach crop | no `crop`, or any `{mime, data}` strings | parses (the backend checks crops, AD-11) | centroid outside 0..1 is rejected |
| Speed alert | `elapsedMs >= thresholdMs` | rejected | ZodError |
| ListQuery | `limit` absent / `"20"` / `"0"` / `"201"` | 50 / 20 / reject / reject | ZodError → 400 later |

</frozen-after-approval>

## Code Map

- Repo today: docs only. Root `.gitignore` ignores `.env.*`, which conflicts with AD-15's committed env files, so it gets replaced. One vendored file, `.agents/skills/bmad-brainstorming/assets/brain-methods.csv`, is committed with CRLF.
- Node 24.22.1 is installed at `~/.nvm/versions/node/v24.22.1/bin`; the system Node is 24.18.0, so put the nvm one first on PATH. Docker and Compose v5.6 are available; there is no native MySQL server or Mosquitto. All 28 Stack pins exist on npm with compatible peers, and `mysql:9.7.4` and `eclipse-mosquitto:2.1.2-alpine` resolve.
- dbmate (npm) ships per-OS binaries as optional deps. `--env-file` loads only the listed file. `up` creates the database, so grants must cover `stl` and `stl_test`.
- The eclipse-mosquitto entrypoint chowns only `/mosquitto`, and the broker runs as uid 1883.

## Tasks & Acceptance

**Execution:**
- [ ] `package.json`, `.nvmrc` (`24.22.1`), `tsconfig.base.json`, `biome.json`, `.gitattributes`, `.gitignore` -- the root workspace (`contracts`, `backend`, `simulator`, `dashboard`), `engines`, and root scripts dev, sim, broker, build, start, test, typecheck, lint, format, db:migrate, db:seed, contracts:schema, each delegating `npm run <s> -w <ws> --` (`dev` through `concurrently`; `test`/`typecheck` with `--workspaces`; `lint` is `biome check .`). The base config follows AD-13 plus `target: es2024` and `skipLibCheck`. Biome: tailwind directives, next/react domains, space indent, JSON always expanded, `contracts/schema` and docs/BMad folders excluded. `.gitattributes` is `* text=auto eol=lf`. `.gitignore` covers AD-14's list plus `.env.local`, `.next/`, `out/`, `next-env.d.ts`, `*.tsbuildinfo` and `_bmad/render/`, keeps the Python lines, and drops `.env.*`.
- [ ] `contracts/` package files, `vehicle-classes.json` (AD-12 seed, in order) -- `@stl/contracts` exports `./src/index.ts` and `./vehicle-classes.json`. Its deps are zod, plus typescript, @types/node, vitest, vite and tsx.
- [ ] `contracts/src/enums.ts`, `scalars.ts` -- every enum family in Consistency Conventions except rejection reason; `epochMs`, `uuid` (`z.uuid()`), `isoUtc` (`z.iso.datetime()`), `vehicleClassId` and `rejectionReason`.
- [ ] `contracts/src/mqtt/` -- one file per payload in MQTT contract v1, plus `topics.ts`, `as const`: per topic `{pattern, build(iid), qos, retain, publisherRole, schema}`.
- [ ] `contracts/src/api/common.ts`, `breaches.ts`, `overrides.ts`, `counts.ts` (+ `HourlyCountsQuery {date?}`), `speed-alerts.ts`, `stream/` (one file per event; `index.ts` with `streamSchemas` in order link, state, counts, demand, breach, override, speedAlert, and `sseFrame`); `src/index.ts` re-exports everything except the JSON.
- [ ] `contracts/scripts/schema-files.ts` (pure) and `generate-schema.ts` (writes), then `contracts/schema/*.json` -- one file per MQTT payload plus `topics.json`, generated with `z.toJSONSchema(…, {io:'input'})`, each with a `title`, written as `JSON.stringify(x, null, 2)` plus a newline.
- [ ] `contracts/test/*.test.ts` -- cover every I/O-matrix row, the topic table against the spine, the `sseFrame` bytes, the `streamSchemas` keys and nullability, no `additionalProperties: false`, and `vehicle-classes.json` validity.
- [ ] `backend/` `package.json` (AD-10 scripts verbatim; dev/start/predev/prestart/db:seed point at entry 2's files), `tsconfig.json`, `vitest.config.ts` (`globalSetup`, `fileParallelism: false`, `passWithNoTests`), `.env.example`, `.env.test`, `test/global-setup.ts` (`execSync('npm run db:migrate:test')` from the backend root), `db/migrations/<ts>_create_m1_tables.sql` -- see Design Notes.
- [ ] `simulator/` and `dashboard/` `package.json`, `tsconfig.json`, `vitest.config.ts` -- simulator script `sim: tsx src/index.ts`. The dashboard runs `next dev`/`next build`, uses jsdom, and its tsconfig carries every option Next 16 enforces, so `next build` never rewrites it. Every config's `include` names `vitest.config.ts`, so `tsc` always has an input.
- [ ] `infra/mosquitto/mosquitto.conf`, `compose.conf`, `infra/compose.yaml`, `infra/mysql/create-user.sql`, `infra/scripts/broker.mjs` -- AD-15 verbatim. `broker.mjs` creates `infra/mosquitto/data/`, tries `mosquitto` and then `C:\Program Files\mosquitto\mosquitto.exe` on ENOENT, forwards signals and exits with the child's code.
- [ ] `docs/setup.md` -- the spine's Local setup steps per OS, run as written, plus the compose path, the gates and troubleshooting (OS Mosquitto service, MySQL bind addresses).
- [ ] `npm install` → `package-lock.json` -- run it once every `package.json` exists, before generating the schema or running any gate.

**Acceptance Criteria:**
- Given a fresh clone with MySQL and Mosquitto running per `docs/setup.md`, when `npm install`, `npm run db:migrate`, `npm run contracts:schema`, `npm run typecheck`, `npm run lint` and `npm test` run, then each exits 0, `git status` is clean, and `stl` holds the five M1 tables plus `schema_migrations`.
- Given the compose stack, when the migration runs against MySQL 9.7.4 and again against 8.4, then both succeed and `migrate:down` drops all five tables.
- Given a scratch TSX test and a scratch page importing `@stl/contracts`, when the dashboard tests and `next build` run, then both pass and no tracked file changes; the scratch files are then deleted.

## Design Notes

- **Migration:** the ERD verbatim, InnoDB/utf8mb4 defaults. Enum-like columns are `VARCHAR(16)`, phase is `VARCHAR(2)`, reason `VARCHAR(32)`, `fault BOOLEAN`. Nullable: `signal_state_change.override_*`, and `override_command.phase`, `reason` and `resolved_at`. Unique keys: `vehicle_count(msg_id, approach, vehicle_class)`, `breach_event(event_id)`, `override_command(command_id)`. One FK, cascade (AD-10). Indexes: `received_at` on all four history tables, `occurred_at` on `vehicle_count` and `breach_event`, `requested_at` on `override_command`. Down drops `breach_crop` first.
- **Optional `ts`:** optional on `vision/counts`, `breach` and `speed-alert` (AD-6 "ts when present"); required on heartbeat, demand and `override/cmd`, as their examples show.
- **Unions:** `state.override`, `override/cmd` and `OverrideRequest` are discriminated on `mode`; the ack is discriminated on `result`. `commandId` is optional only in the `NONE` variant.
- **Generator in `contracts/scripts/`:** it uses `node:fs`. The zod-only fence guards the bundled `src/`.
- **Compose Mosquitto:** `working_dir: /mosquitto`, and a named volume at `/mosquitto/infra/mosquitto/data`, so `compose.conf` differs from `mosquitto.conf` only in `listener`.
- **CRLF csv:** if `.gitattributes` marks the vendored csv modified, add `.agents/** -text`.

## Implementation Notes

- **Code Map correction:** the eclipse-mosquitto entrypoint chowns only `/mosquitto/data`, not all of `/mosquitto`. So `compose.yaml` wraps the broker in `sh -c "chown -R 1883:1883 infra/mosquitto/data && exec mosquitto -c infra/mosquitto/compose.conf"`. Confirmed: the broker saves its persistence file to the volume.
- **Interpretations:**
  - `topics.ts` records the `controller/override/cmd` publisher as `gateway`, the Design Paradigm's role name for the backend.
  - `breach_crop.mime` is `VARCHAR(32)`.
  - `override_command` has no `received_at` in the ERD, so it is indexed on `requested_at` only.
  - The heartbeat's `confidence` and `fps` are required, as the spine's example shows.
  - The generator deletes stale `.json` files in `contracts/schema/`.
  - Schemas share a name with their inferred type (`BreachItem`), with no `Schema` suffix.
- **Additions:**
  - `contracts/test/fence.test.ts` checks that `contracts/src` imports only `zod` and relative `.ts` files.
  - `create-user.sql` grants on `` `stl\_test` ``, escaped so the underscore is literal: `stl` can create `stl_test` but not `stlXtest`.
- **Tooling:**
  - Biome 2.6 deprecates `linter.rules.recommended`, so it is omitted; recommended rules are on by default.
  - `.agents/** -text` was not needed: git leaves the committed CRLF csv alone.
  - Next skips rewriting a `tsconfig.json` that uses `extends`.
  - npm 11.19 warns that esbuild's install script is unapproved; `tsx` works without it.
- **Verified by the implementer:**
  - A fresh clone runs every AC command with exit 0 against the compose stack.
  - The migration runs up, down and up on MySQL 9.7.4 and 8.4.13.
  - `create-user.sql` is idempotent on both.
  - The backend `globalSetup` migrates `stl_test`.
  - A scratch TSX test and a scratch `next build` importing `@stl/contracts` pass with no tracked changes, and the scratch files were removed.
  - The native `mosquitto.conf` parses and listens on 127.0.0.1 in the 2.1.2 image.
  - `broker.mjs` handles ENOENT, signals and exit codes, checked with a stub.
- **Unverified:** `npm run broker` against a native Mosquitto, which isn't installed here, and the Windows steps.
- **Expected until later stories land:** `npm run dev`, `start`, `sim`, `build` and `db:seed` fail because there is no `src/` yet. With no backend tests, Vitest exits before `globalSetup`.
- **Re-checked by the orchestrator:**
  - `typecheck`, `lint` and `test` all exit 0.
  - 175 of 175 contract tests passed, none skipped, and every I/O-matrix row is covered.
  - The lockfile pins exact versions from registry.npmjs.org, with single copies of zod and vite, all four workspaces linked, and the win32 dbmate entry present.

## Plan Change Log

## Review Triage Log

### Pass 1 (quick lens, loop 0)

Verdicts: high 0, medium 2, low 1, false 0, maybe-false 1.

| # | Finding | Verdict | Route | Evidence / action |
|---|---------|---------|-------|-------------------|
| 1 | `dashboard/vitest.config.ts`: Testing Library never cleans up between tests | medium | patch | `@testing-library/react/dist/index.js:26` registers `afterEach(cleanup)` only when a global `afterEach` exists, and Vitest defaults to `globals: false` (`vitest/dist/chunks/defaults…js:54`). So every later dashboard test file would leak renders, and S0 owns the config. Patch: `globals: true`. |
| 2 | `contracts/test/vehicle-classes.test.ts`: the seed test pins every label and PCU weight | low | patch | AD-12 (spine :335, :347): class data changes by editing the file "and restart; no code changes", and Squad B will replace the PCU placeholders. The test would then fail `npm test`. The fix is a deletion; the validity and unique-id tests stay. |
| 3 | `infra/scripts/broker.mjs`: SIGHUP is forwarded unchanged | medium | patch | Mosquitto reloads its config on SIGHUP, and the wrapper's `process.on('SIGHUP')` suppresses Node's default exit (`broker.mjs:15,43-45`). Closing a terminal therefore leaves an orphan broker on `127.0.0.1:1883`, and the next `npm run broker` fails with "address in use". Patch: send SIGTERM to the child on SIGHUP. |
| 4 | Ticket verify: `npm run broker` on a fresh clone not shown | maybe-false | defer | There is no native Mosquitto here; the user chose compose-only verification. This is settled by running `npm run broker` against a native Mosquitto 2.0/2.1 (Fedora `dnf install mosquitto`, the Windows installer). If it fails, it is medium. Logged in `deferred-work.md`. |

**Patches applied** by the implementer:
- `dashboard/vitest.config.ts` sets `globals: true`. A temporary two-render test passed and was then removed.
- The seed-pinning test is deleted.
- `broker.mjs` turns SIGHUP into SIGTERM for the child. Checked with a stub: the wrapper exits 0.

**Re-verified by the orchestrator** on a fresh scratch clone of the patched tree, against the compose stack:
- `npm install`, `db:migrate` (5 tables plus `schema_migrations`), `contracts:schema` with no diff, `typecheck`, `lint` and `test` (174 of 174) all exit 0.
- `git status` is clean.
- A broker pub/sub round trip works.
- The stack and the clones were then removed.

## Verification

**Commands:**
- `npm run typecheck && npm run lint && npm test` -- expected: exit 0 (MySQL up for the backend `globalSetup`)
- `npm run contracts:schema && git diff --exit-code contracts/schema` -- expected: no diff
- `docker compose -f infra/compose.yaml up -d`, then `npm run db:migrate`, then `SHOW TABLES` -- expected: five tables plus `schema_migrations`
- A fresh `git clone` into the scratchpad, following `docs/setup.md` -- expected: every AC command exits 0

**Manual checks (if no CLI):**
- Mount `mosquitto.conf` into the 2.1.2 image with cwd at the repo layout: the broker starts and logs `127.0.0.1:1883`, so the native config parses. `npm run broker` itself stays unverified until Mosquitto is installed natively.
