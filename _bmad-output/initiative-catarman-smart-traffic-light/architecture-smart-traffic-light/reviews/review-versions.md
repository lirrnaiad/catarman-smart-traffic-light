---
review: versions-and-reality-check
target: ../architecture-smart-traffic-light.md
inputs:
  - ../architecture-smart-traffic-light.md
  - ../.memlog.md (entries typed `version`)
  - ../../spec-smart-traffic-light/kpis.md (offline-retention KPI)
date: 2026-10-22
lens: >-
  Every committed decision was web-researched or reality-checked, not asserted from training data:
  current versions, each named technology still exists and fits, and (greenfield) the live defaults
  of any starter it leans on.
---

# Versions and reality-check review: architecture spine

## Verdict

**The version pins hold up. Two committed claims are wrong, and several live defaults the spine relies on were never checked.**

Every one of the 21 Stack rows exists at the pinned version, is the current `latest` (TypeScript is the deliberate exception), and is engine-compatible with Node 24.22.1. The memlog's `version` entries match the registry today. The problems are elsewhere:

- **Wrong claim:** the TypeScript row's reason ("Next.js's default type checker can't load TypeScript 7") is false for Next 16.4.2 (V-01).
- **Unchecked live default:** AD-13's "contracts consumed as TS source" breaks `next build` under the most natural ESM import style (V-02).
- **Unchecked live default:** Mosquitto's queue and autosave defaults undercut the claim that `clean: false` plus `persistence true` "carry" the 100 % offline-retention KPI (V-03).
- **Unchecked live default:** the static export fails at build time on `useSearchParams` without Suspense, and the DoD never runs `next build` (V-05).
- **Missing pins:** several required packages are not in the Stack table, although AD-13 says versions are pinned exactly (V-04).
- **Out-of-date assumption:** PubSubClient, the library AD-5 is sized for, is now officially unmaintained (V-06).

Counts: critical 0 · high 0 · medium 6 · low 9 · info 5. Confirmed without findings: 30+ individual claims (table at the end).

### How I checked

- `npm view <pkg> version|time|engines|peerDependencies|dependencies` for every package, run on 2026-10-22.
- The published tarballs of next@16.4.2, zod, mqtt, dbmate, vitest, mysql2, express, router and @biomejs/biome, unpacked and grepped (source and bundled docs).
- `nodejs.org/dist/index.json` and `nodejs/Release/schedule.json`.
- The Mosquitto v2.1.2 man-page source and ChangeLog via the GitHub API. mosquitto.org itself was unreachable from the sandbox.
- dev.mysql.com, the dbmate, PubSubClient, Express, concurrently, tsx and go-sql-driver repos via `gh api`, Docker Hub, Launchpad, `dnf repoquery` on Fedora 44, MDN, and the TypeScript 6.0 and Vitest 5 docs.
- **Empirical builds** in a scratch npm-workspace: Next 16.4.2 + React 19.3.1 + a TS-source `@stl/contracts` workspace package, built with `output: 'export'`, `trailingSlash: true` and TypeScript 7.0.2. Also a Vitest 5.0.5 + jsdom 30.1.3 + @testing-library/react 16.3.3 TSX test, and TS 6.0.3 against a backend-style config. All ran on Node 24.18.0, the dev laptop's version.

## Findings

| ID | Sev | Finding |
| --- | --- | --- |
| V-01 | Medium | The TypeScript row's reason is wrong. Next 16.4.2's *default* checker is the TS CLI, and it runs TS 7 |
| V-02 | Medium | Contracts-as-TS-source: `.js`-suffixed relative imports (needed under NodeNext) fail Turbopack in `next build`. The import convention is unspecified |
| V-03 | Medium | Mosquitto defaults (`max_queued_messages 1000`, `autosave_interval 1800`) undercut the offline-retention claim in AD-5 |
| V-04 | Medium | Required packages are missing from the Stack table, so they float despite AD-13's exact pinning |
| V-05 | Medium | Static export plus query strings: `useSearchParams` without `<Suspense>` fails `next build` only. The DoD never builds |
| V-06 | Medium | PubSubClient is officially unmaintained (README notice, 2026). The AD-5 sizing basis and the Open Question are out of date |
| V-07 | Low | Biome 2.6 doesn't parse Tailwind v4 `@theme` unless `css.parser.tailwindDirectives` is on (default false), so `npm run lint` fails |
| V-08 | Low | TS 6 changed defaults (`types: []`, `rootDir`, …). Backend and simulator fail on `process` without `"types": ["node"]` |
| V-09 | Low | `next dev` blocks HMR from origin `127.0.0.1` (403), which clashes with AD-15's 127.0.0.1-everywhere rule |
| V-10 | Low | Node 24 became *Maintenance* LTS on 2026-10-20, and Node 26 goes Active LTS on 2026-10-28. The dev laptop's 24.18.0 is two security releases behind |
| V-11 | Low | Linux "distro `mysql-server`" gives 8.4 on Fedora 44 and Ubuntu 26.04 but 8.0 (EOL) on Ubuntu 24.04. The Workbench version is unpinned |
| V-12 | Low | compose.yaml: `eclipse-mosquitto:2.1` isn't a Docker Hub tag. A `127.0.0.1` listener inside a container is unreachable from the host |
| V-13 | Low | Mosquitto `persistence_location` resolves relative to the broker's cwd, so `broker.mjs` must control it |
| V-14 | Low | dbmate isn't CI-tested upstream against MySQL 9.x (only 8.0). The auth path checks out, but it needs an S0 smoke test |
| V-15 | Low | `crypto.randomUUID()` needs a secure context in browsers. Fine on 127.0.0.1, breaks if the dashboard is served on a LAN IP |
| V-16 | Info | mysql2 `timezone: 'Z'` doesn't set the session `time_zone`. A per-connection `SET` is still needed |
| V-17 | Info | The App Router ships Next's vendored React canary, not the pinned 19.3.1 |
| V-18 | Info | Vitest 5 behavior changes worth knowing (vite is a required peer, no parent-dir config lookup, `clearMocks: true`) |
| V-19 | Info | Many pins are under two weeks old (Biome 2.6.2 is one day old). Acceptable with the lockfile |
| V-20 | Info | `transpilePackages` is redundant for workspace packages under Turbopack, but harmless |

---

### V-01: The TypeScript pin's stated reason is false [Medium]

- **Claim (Stack table, memlog `version` line 17):** "TypeScript 6.0.3 (not 7.x: Next.js's default type checker can't load TypeScript 7)". The memlog adds: "needs experimental.useTypeScriptCli".
- **Verified:**
  - In `next@16.4.2/dist/server/config-shared.js`, `defaultConfig.experimental.useTypeScriptCli` is `true`.
  - The bundled doc `dist/docs/01-app/03-api-reference/05-config/01-next-config-js/useTypeScriptCli.md` says: *"By default, `next build` runs the project-local `tsc` command instead of loading the TypeScript JavaScript compiler API. This supports TypeScript 6 and enables TypeScript 7 … The CLI checker is enabled by default."* The API-based checker, which can't load TS 7, is now the opt-out.
  - `dist/lib/typescript/runTypeScriptCli.js` has explicit TS 7 handling: it spawns the ESM `tsc` wrapper and runs the native compiler in its own process group.
  - **Empirical:** `next build` with `typescript@7.0.2` and no config printed "Running TypeScript … Finished TypeScript". An injected `const bad: number = 'x'` failed the build with `TS2322`, so the check really ran.
  - `npm view typescript dist-tags`: latest `7.0.2` (2026-07-08), beta `7.1.0-beta`. 6.0.3 (2026-04-16) is the last 6.x.
- **Status:** wrong.
- **Severity:** Medium. The runtime impact is low, but this is a committed reason in the Stack table and it will mislead whoever re-evaluates the pin.
- **Fix:** keep 6.0.3 if you want the conservative choice, but give the true reason, or move to 7.0.2. Suggested row text: "TypeScript 6.0.3, the last JS-API release. 7.0.2 also works with Next 16.4's default CLI checker, but has no JS compiler API (Next's editor plugin and any API-based tooling need it)." Either way, drop "needs experimental.useTypeScriptCli" from the memlog.

### V-02: The TS-source contracts package breaks `next build` under the NodeNext import style [Medium]

- **Claim (AD-13):** "`@stl/contracts` exports its TypeScript source, and the dashboard lists it in `transpilePackages`". Every package is `"type": "module"` and extends `tsconfig.base.json`. The backend and simulator run under tsx.
- **Verified (empirical, Next 16.4.2 Turbopack):**
  - `contracts/src/index.ts` with `export … from './topics.js'` fails with `Module not found: Can't resolve './topics.js'`. It still fails when contracts' tsconfig is `module/moduleResolution: nodenext`. TypeScript under NodeNext *requires* these `.js` suffixes (TS2835 otherwise), so "strict ESM via NodeNext" and "Turbopack consumes the source" conflict.
  - Extensionless `./topics` builds under Turbopack, but it is a TS error under NodeNext. It only fits `moduleResolution: "bundler"`.
  - `.ts` suffixes (`./topics.ts`) plus `allowImportingTsExtensions: true` work everywhere: Turbopack build ✓, `tsc` 6.0.3 ✓ and 7.0.2 ✓, `tsx@4.23.15` ✓, plain `node` 24 ✓. The dashboard's own tsconfig must also set `allowImportingTsExtensions`, or Next's type-check step reports TS5097 on the transitively checked contracts source.
- **Status:** unverified by the spine. The fit was asserted, and it fails under the most likely setup.
- **Severity:** Medium. It breaks the demo build and the dashboard's use of every contract, and the first time the three parallel wave-1 stories meet it is late.
- **Fix:** add to AD-13: "Relative imports use the `.ts` extension. `tsconfig.base.json` sets `module`/`moduleResolution: "nodenext"`, `allowImportingTsExtensions: true`, `noEmit: true`, and the dashboard tsconfig keeps `allowImportingTsExtensions`." Or standardize on `moduleResolution: "bundler"` with extensionless imports. Either way, S0 should prove it with a `next build` that imports `@stl/contracts`.

### V-03: Broker defaults undercut "clean: false + persistence carry the offline-retention KPI" [Medium]

- **Claim (AD-5):** "The backend connects with `clean: false` … and the broker runs with `persistence true` (AD-15). Together these carry the offline-retention KPI (`kpis.md`)." The KPI is "100% of hourly counts and anonymized violation logs retained locally during network drops".
- **Verified (Mosquitto 2.1.2 `man/mosquitto.conf.5.xml` at tag v2.1.2):**
  - `max_queued_messages`: "The maximum number of QoS 1 or 2 messages to hold in the queue (per client) … **Defaults to 1000**." Messages over the limit are silently dropped.
  - `persistence`: "The data will be written to disk when mosquitto closes and also at periodic intervals as defined by `autosave_interval`." `autosave_interval`: "**Defaults to 1800 seconds** (30 minutes)."
  - `persistence`: "It is recommended that a plugin based persistence is used instead." The 2.1 ChangeLog adds the `persist-sqlite` plugin, and 2.1.2 "Forbid[s] running with `persistence true` and with a persistence plugin at the same time".
- **Impact:** each backend outage queues `vision/counts` (≤ 1/s), `vision/breach` and `vision/status`. After roughly 15 minutes down, the 1000-message cap starts dropping counts with no error. A broker crash or power loss (CAP-19 is literally brownout) loses up to 30 minutes of queued and retained state.
- **Status:** unverified. The mechanism was asserted without checking broker defaults.
- **Severity:** Medium. It carries a named KPI.
- **Fix:** in `infra/mosquitto/mosquitto.conf`, set `max_queued_messages 0` (or a sized value such as 100000) with a `max_queued_bytes` ceiling, and `autosave_interval 10` (or `autosave_on_changes true` with a small count). All of these exist in both 2.0.x and 2.1.x, so the "options common to both" promise holds. Record the bound in AD-5, for example "retention survives a backend outage of ≥ N h".

### V-04: Required packages are missing from the Stack table [Medium]

- **Claim (AD-13):** "Dependency versions are pinned exactly". The Stack table is the seed.
- **Verified (`npm view … peerDependencies`, peerDependenciesMeta, and an empirical `npm ls`):**

  | Package | Why it's needed | Current |
  | --- | --- | --- |
  | `vite` | Vitest 5.0.5 lists `vite: ^6.4 \|\| ^7 \|\| ^8` as a **required** peer. The Vitest 5 migration guide: "It is now a required peer dependency". npm auto-installed 8.3.5, released 2026-10-21 | 8.3.5 |
  | `@testing-library/dom` | Required peer of @testing-library/react 16.3.3 (`^10.0.0`) | 10.4.2 |
  | `react-is` | Required (non-optional) peer of recharts 3.10.1 | 19.3.1 |
  | `postcss` | In Tailwind's official Next.js install command (`npm install tailwindcss @tailwindcss/postcss postcss`) | 8.5.31 |
  | `@types/node` | Needed because of the TS 6 `types: []` default (V-08). Pin to the 24 line, not latest 26.x | 24.19.2 |
  | `@types/react`, `@types/react-dom` | Next's TS setup requires them | 19.3.0 / 19.3.0 |
  | `@types/supertest` | Typed Supertest in route tests | 7.2.1 |
  | `@vitejs/plugin-react` (optional) | Named in Next 16.4's bundled Vitest guide. Empirically **not** required for TSX tests with `jsx: "react-jsx"`. Needs vite ^8 and Node ≥ 22.12 | 6.1.2 |

- **Status:** gap. npm 11 auto-installs required peers, but at whatever version is latest on the day of each developer's install.
- **Severity:** Medium. Three parallel sessions could resolve different peer versions until the first lockfile lands. S0 owns the lockfile, so the window is small if S0 pins these.
- **Fix:** add these rows to the Stack table, or say "S0 pins all peers listed above".

### V-05: Static export with query strings fails only at build time, and the DoD doesn't build [Medium]

- **Claim (AD-9):** no dynamic routes, so "Use query strings instead (`/breaches/?id=…`)". **AD-16 DoD:** `typecheck` + `lint` + `test`, with no build.
- **Verified:**
  - Bundled doc `use-search-params.md`: "During production builds, a static page that calls `useSearchParams` from a Client Component must be wrapped in a `Suspense` boundary, otherwise the build fails … In development … things may appear to work without `Suspense`."
  - **Empirical:** `next build` with `output: 'export'` failed with "useSearchParams() should be wrapped in a suspense boundary at page "/breaches"". With `<Suspense>` it built `out/breaches/index.html` (trailingSlash ✓).
- **Status:** an unverified live default of the starter.
- **Severity:** Medium. A CAP-6 story can pass its DoD in `next dev` and break the demo build.
- **Fix:** add to AD-9: "Any component calling `useSearchParams` sits under a `<Suspense>` boundary." Add `npm run build -w dashboard` to the DoD for dashboard-touching stories.

### V-06: PubSubClient is now officially unmaintained [Medium]

- **Claim (AD-5, Open Questions, memlog assumption):** "Will the ESP32 use a PubSubClient-class library? AD-5's QoS 0 publishing and 512-byte limit are sized for it."
- **Verified (`gh api repos/knolleary/pubsubclient`):**
  - The README now opens: *"[!CAUTION] This library is not maintained … Alternative libraries exist and I urge you to pick one that is actively maintained." (Nick, 2026)*. The last release is v2.8 (2020-05-20). The only commit since is the 2026-06-10 README notice.
  - The technical facts hold in `src/PubSubClient.h`, `src/PubSubClient.cpp` and the README Limitations section: MQTT 3.1.1 default (`MQTT_VERSION_3_1_1`), "can only publish QoS 0 … can subscribe at QoS 0 or QoS 1", PUBACK sent for inbound QoS 1, `MQTT_MAX_PACKET_SIZE 256`, which covers the **whole packet including header**, adjustable by `setBufferSize()`. `setKeepAlive()` defaults to 15 s, so it must be set to 5. LWT goes through `connect(id, user, pass, willTopic, willQos, willRetain, willMessage[, cleanSession])`.
  - Alternatives (web search, Arduino Library Manager listings): PubSubClient3 (fork, 3.3.0 on 2025-12-14, adds QoS 1/2 publish), arduino-mqtt (256dpi), and ESP-IDF `esp-mqtt` through the Arduino-ESP32 core.
- **Status:** out of date.
- **Severity:** Medium for decision relevance, though it's M2 and Squad A owns it.
- **Fix:** reword the Open Question to say "PubSubClient (unmaintained since 2026) or a maintained successor (PubSubClient3, arduino-mqtt, esp-mqtt). AD-5's limits stay as the lowest common denominator." Add an arithmetic note: a 512-byte payload on `stl/cat-01/controller/state` needs a buffer of at least about 545 bytes, so `setBufferSize(1024)`.

### V-07: Biome 2.6 doesn't parse Tailwind v4 `@theme` by default [Low]

- **Claim:** Biome lints and formats the whole repo (AD-16). Visuals are backed by Tailwind v4 `@theme` tokens in `globals.css` (Conventions).
- **Verified:** in `@biomejs/biome@2.6.2/configuration_schema.json`, `CssParserConfiguration.tailwindDirectives` is described as "Enables parsing Tailwind CSS 4.0 directives and functions, including `@theme`, `@utility`, `@variant`, `@source`, and `@apply`. **Defaults to `false`**." `RuleDomains` includes `next`, `react`, `tailwind` and `test`. Next 16 removed `next lint` (bundled `03-eslint.md`: "Starting with Next.js 16, `next lint` is removed"), so Biome as the only linter fits.
- **Status:** an unchecked live default.
- **Fix:** S0's `biome.json` sets `"css": { "parser": { "tailwindDirectives": true } }` and enables `linter.domains.next`/`react: "recommended"`.

### V-08: TypeScript 6 changed compiler defaults [Low]

- **Verified:** the TS 6.0 announcement (devblogs.microsoft.com) says `types` now defaults to `[]`, `rootDir` defaults to the tsconfig directory, `strict` is on by default, `module` defaults to `esnext`, `noUncheckedSideEffectImports` is on, `baseUrl` and `moduleResolution node10` are deprecated, and `esModuleInterop: false` is not allowed. **Empirical:** TS 6.0.3 with `module: nodenext` and no `types` gives `TS2591: Cannot find name 'process'`. With `"types": ["node"]` it passes.
- **Fix:** `tsconfig.base.json` sets `"types": ["node"]` (backend, simulator, contracts tests). Dashboard stays on Next's generated config.

### V-09: `next dev` blocks HMR from origin 127.0.0.1 [Low]

- **Claim (AD-15):** "Service URLs use `127.0.0.1`, not `localhost`". `DASHBOARD_ORIGINS` defaults include `http://127.0.0.1:3000`.
- **Verified:**
  - In `next@16.4.2/dist/server/lib/router-utils/block-cross-site-dev.js`, the allowed origins are `localhost`, `**.localhost`, the start hostname and `allowedDevOrigins`.
  - **Empirical:** `next dev` served the page at `http://127.0.0.1:3123/` (200). `/_next/webpack-hmr` with `Origin: http://127.0.0.1:3123` returned **403**, and the log said "Blocked cross-origin request to Next.js dev resource /_next/webpack-hmr from "127.0.0.1"".
- **Fix:** add `allowedDevOrigins: ['127.0.0.1']` to `next.config.ts` (dev-only, allowed with `output: 'export'`), or document the dashboard dev URL as `http://localhost:3000`.

### V-10: Node 24 is now Maintenance LTS, and the dev laptop is behind on security releases [Low]

- **Claim:** "Node.js (LTS "Krypton") 24.22.1". The memlog says it is the "newest LTS … Node 26 still Current".
- **Verified:**
  - `nodejs.org/dist/index.json` shows v24.22.1 on 2026-10-20, `lts: Krypton`, `security: true`, npm 11.19.1.
  - `nodejs/Release/schedule.json` gives v24 maintenance from **2026-10-20** and end of life 2028-04-30, and v26 Active LTS from **2026-10-28**.
  - The dev laptop runs 24.18.0, which predates the security releases 24.18.1 and 24.22.1.
  - Every engine field fits Node 24 and 26: next ≥ 20.9, vitest `^22.12||^24||>=26`, jsdom 30 `^22.22.2||^24.15.0||>=26`, concurrently ≥ 22, express ≥ 18, tsx ≥ 18, @vitejs/plugin-react ≥ 22.12.
- **Status:** confirmed version, but the label is stale.
- **Fix:** "Node 24.22.1 (Maintenance LTS, EOL 2028-04-30); minimum 24.22.1". Add `engines.node: ">=24.22.1 <25"` and an `.nvmrc`. Revisit Node 26 LTS after M1.

### V-11: Linux MySQL packaging and the Workbench version [Low]

- **Claim:** MySQL "9.7 LTS (8.4 LTS accepted)". Setup: "on Linux the Oracle repo or distro `mysql-server`". Workbench is unversioned.
- **Verified:**
  - MySQL 9.7.0 LTS went GA on 2026-04-21 (dev.mysql.com relnotes, Oracle blog). The newest patch is **9.7.4 (2026-10-20)**. Innovation releases have moved to calendar versions (26.7, 26.10).
  - `dnf repoquery` on Fedora 44: `mysql-server` is **8.4.10**, and 9.7 is the separate `mysql9.7-server` package (9.7.1).
  - Launchpad: Ubuntu 26.04's `mysql-8.4` is 8.4.11, but Ubuntu 24.04's distro MySQL is **`mysql-8.0` 8.0.46**. 8.0 is past EOL and outside the accepted range.
  - The Oracle blog says Workbench 26.7 supports 9.7 LTS. The 9.7 refman still says Workbench is "developed and tested against 8.0".
- **Fix:** give per-distro packages: Fedora `mysql9.7-server` (or `mysql-server` for 8.4), Ubuntu 26.04 `mysql-server` (8.4), Ubuntu 24.04 the Oracle APT repo. Pin "9.7.4+ or 8.4.x" and "MySQL Workbench 26.7+".

### V-12: compose.yaml image tag and loopback listener [Low]

- **Claim:** `infra/compose.yaml # optional MySQL 9.7 + Mosquitto 2.1`. The broker config sets `listener 1883 127.0.0.1`.
- **Verified (Docker Hub API):** `mysql:9.7` and `mysql:9.7.4` exist. `eclipse-mosquitto:2.1` and `:2.1.2` return **404**. The published tags are `2.1.2-alpine`, `2.1-alpine`, `2`, `latest` and `2.0.22`. Separately, `listener 1883 127.0.0.1` inside a container binds the container's own loopback, so a host port mapping can't reach it.
- **Fix:** use `eclipse-mosquitto:2.1.2-alpine`, with a container-only conf (`listener 1883`) and `ports: ["127.0.0.1:1883:1883"]`, so the host-side guard stays.

### V-13: Mosquitto `persistence_location` is relative to the broker's cwd [Low]

- **Verified (man page):** "`persistence_location` … If not given, then the current directory is used". A relative path resolves against the process cwd. The spine's options (`listener <port> <addr>`, `allow_anonymous`, `persistence`, `persistence_location`) all exist in 2.1.2 and 2.0.x. `allow_anonymous` defaults to false unless no listeners are defined. `per_listener_settings` is deprecated in 2.1, and the spine doesn't use it.
- **Fix:** AD-15 / `broker.mjs`: spawn mosquitto with `cwd` = repo root and keep `persistence_location infra/mosquitto/data/` (trailing slash), or have the script write an absolute path.

### V-14: dbmate against MySQL 9.7 isn't tested upstream [Low]

- **Verified:**
  - `dbmate@2.37.0` (2026-10-18) ships `@dbmate/win32-x64` and `@dbmate/linux-x64` (also linux-arm, linux-arm64, linux-ia32, darwin-x64 and darwin-arm64; **no win32-arm64**).
  - The README confirms `--wait` (default timeout 60 s), `--no-dump-schema`, `--env-file` (repeatable; *"only the listed files are loaded — the default `.env` is not included"*), `dbmate new` producing `db/migrations/20151127184807_create_users_table.sql`, `-- migrate:up` / `-- migrate:down`, `mysql://user:pass@127.0.0.1:3306/db`, and "`dbmate up` will create the database if it does not already exist (assuming the current user has permission)".
  - The default migrations dir is `./db/migrations` relative to cwd, which matches `backend/db/migrations` only when run with cwd `backend/`.
  - The upstream test compose uses `mysql/mysql-server:8.0` only.
  - dbmate's `go.mod` pins go-sql-driver v1.9.3. Its `auth.go` handles `caching_sha2_password` full auth over plain TCP by requesting the server's RSA key (`cachingSha2PasswordRequestPublicKey`), so MySQL 9's removal of `mysql_native_password` isn't a blocker.
- **Status:** likely works. It is unverified against 9.7 upstream.
- **Fix:** S0 runs `dbmate --wait --no-dump-schema up` against MySQL 9.7 on Windows and Linux. The `db:migrate` script runs via `npm run … -w backend` (cwd = backend) or passes `--migrations-dir`. Tests use `--env-file .env.test`.

### V-15: `crypto.randomUUID()` and secure contexts [Low]

- **Claim (Conventions):** "New UUIDs come from `crypto.randomUUID()`."
- **Verified:** MDN `Crypto/randomUUID` says it is "available only in secure contexts". MDN Secure Contexts says `127.0.0.0/8`, `::1`, `localhost` and `*.localhost` are potentially trustworthy, and private LAN IPs over http are not. Node 24 exposes `globalThis.crypto.randomUUID()`, and it also ran inside the jsdom test.
- **Assessment:** the dashboard doesn't need UUIDs, because the backend mints `commandId` (AD-7). The demo URL `http://127.0.0.1:4000/` is a secure context, but a later LAN binding (Deferred) would not be.
- **Fix:** add "UUIDs are minted by publishers and the backend, never by the dashboard", or note the secure-context limit next to the LAN-binding deferral.

### V-16: mysql2 `timezone: 'Z'` doesn't set the session time zone [Info]

- **Verified:**
  - `mysql2@3.24.6/lib/connection_config.js` accepts `timezone` matching `^(?:local|Z|[ +-]\d\d:\d\d)$`. It only governs JS Date conversion.
  - `lib/auth_plugins/caching_sha2_password.js` requests the server key when the connection isn't TLS or a socket. ✓ MySQL 9.7.
  - MySQL 9.7 refman: numeric offsets (`'+08:00'`, range `-13:59` to `+14:00`) need no tz tables. Named zones error with "Unknown or incorrect time zone" when the tables are missing, which is common on Windows. `CONVERT_TZ(...,'+00:00','+08:00')` ✓. `DATETIME(3)` and `MEDIUMBLOB` are standard.
- **Fix:** `pool.ts` runs `SET time_zone = '+00:00'` on each new connection (pool `connection` hook), as AD-6 implies. Nothing more to change.

### V-17: The App Router runs Next's vendored React [Info]

- **Verified:** `next@16.4.2/dist/compiled/react` is `19.3.0-canary-278794d7-20261002`. The installed `react@19.3.1` (peer `^19.0.0` ✓) is what Vitest and Testing Library render, and what the types come from.
- **Fix:** none. This is standard Next behavior, worth one line so nobody chases a "version mismatch".

### V-18: Vitest 5 changes [Info]

- **Verified:**
  - The Vitest migration guide lists: vite is a required peer, "Vitest 5.0 requires Vite >= 6.4.0 and Node.js >= 22.12.0", "Config files are no longer looked up in parent directories", `clearMocks` now defaults to `true`, `test.sequential` is removed, and inline projects inherit root options.
  - `fileParallelism?: boolean` and `projects?:` are still in the 5.0.5 types ✓.
  - **Empirical:** Vitest 5.0.5 + jsdom 30.1.3 + RTL 16.3.3 + React 19.3.1 TSX test passed on Node 24.18.0 without `@vitejs/plugin-react`.
- **Fix:** S0 gives every workspace its own `vitest.config.ts`, or one root config with `test.projects`, since parent lookup is gone.

### V-19: Freshness of the pins [Info]

Release dates (`npm view <pkg> time`):

- One day old: Biome 2.6.2 (2026-10-21).
- Four days: dbmate 2.37.0 (10-18).
- Seven days: Next 16.4.2, Vitest 5.0.5 and jsdom 30.1.3 (all 10-15).
- Eight days: React 19.3.1 and mqtt 5.16.1 (10-14).
- Nine days: mysql2 3.24.6 (10-13).
- Ten days: zod 4.6.7 (10-12).
- Thirteen days: Express 5.3.0 (10-09).
- Fourteen days: concurrently 10.0.6 (10-08).

With exact pins and one lockfile this is acceptable. If S0 hits a regression, step back one patch rather than unpinning.

### V-20: `transpilePackages` is redundant [Info]

- **Verified:** bundled `transpilePackages.md`: "Turbopack transpiles workspace packages (npm, pnpm, or Yarn workspaces) in your monorepo automatically under both routers. Webpack does the same for the App Router." Empirically harmless.
- **Fix:** optional. Keep it as documentation, or drop the requirement.

---

## Confirmed claims (no finding)

| Claim | Evidence | Status |
| --- | --- | --- |
| next 16.4.2 is latest; engines `node >=20.9.0`; peers react/react-dom `^19.0.0` | `npm view`; released 2026-10-15 | confirmed |
| react / react-dom 19.3.1 latest | `npm view`; 2026-10-14 | confirmed |
| tailwindcss + @tailwindcss/postcss 4.3.3 | `npm view`; 2026-07-16; the plugin depends on `tailwindcss: 4.3.3`, `postcss ^8.5.16`; tailwindcss.com Next guide: `postcss.config.mjs` with `"@tailwindcss/postcss": {}`, `@import "tailwindcss";` | confirmed |
| recharts 3.10.1; React 19 peer | `npm view` peers `react ^19`, `react-dom ^19`, `react-is ^19` (required, see V-04); 2026-07-25 | confirmed |
| express 5.3.0; async errors reach one error middleware | `router@2.2.0/lib/layer.js` `isPromise(ret) → ret.then(null, err => next(err))`; GitHub release v5.3.0 2026-10-09 (Content-Length/Transfer-Encoding fix in `res.send`, qs CVE fixes); engines ≥ 18 | confirmed |
| Express serves `dashboard/out/`; no compression middleware | Express 5 bundles serve-static 2 (no compression; directory → trailing-slash redirect + `index.html`), which matches `trailingSlash: true` output (`out/breaches/index.html` built) | confirmed |
| @types/express 5.0.6 | `npm view` latest; 2025-12-01 | confirmed |
| mysql2 3.24.6; caching_sha2_password (the MySQL 9 default, native_password removed) | tarball auth plugin code (V-16) | confirmed |
| dbmate 2.37.0 with Windows binary; all CLI flags | V-14 | confirmed (9.7 smoke test pending) |
| mqtt 5.16.1 speaks 3.1.1; `clean:false`; keepalive | `build/lib/client.js` defaults `protocolVersion: 4`, `keepalive: 60`, `clean: true`, so the spine must override keepalive to 5 and clean to false for the backend (it does) | confirmed |
| zod 4.6.7 `z.toJSONSchema` | `v4/classic/external.d.ts` exports `toJSONSchema`; targets `draft-04`, `draft-07`, `draft-2020-12` (default), `openapi-3.0`; `io: input/output` | confirmed |
| tsx 4.23.15 with Node 24 and TS 6/7 | engines ≥ 18; esbuild ~0.28; 4.23.14 "restore the CJS bridge namespace for Node 24 require(esm)"; empirically ran a `.ts`-specifier ESM import on Node 24.18.0 | confirmed |
| concurrently 10.0.6 | `npm view`; engines ≥ 22; ESM; v10.0.5 fixed non-ASCII output on Windows | confirmed |
| Vitest 5.0.5 with jsdom 30.1.3 | peer `jsdom: *` (optional); empirical pass (V-18) | confirmed |
| Supertest 7.3.1 | `npm view` latest; 2026-10-02 | confirmed |
| @testing-library/react 16.3.3 with React 19 | peers `react ^18 \|\| ^19`; empirical pass | confirmed |
| @biomejs/biome 2.6.2; React/Next support; Next 16 doesn't lint in build | V-07 | confirmed |
| npm 11.x bundled with Node 24 | Node 24.22.1 bundles npm 11.19.1 | confirmed |
| Mosquitto 2.1.2 is newest; `max_packet_size` default 2,000,000 | GitHub tag v2.1.2 (2026-02-09); ChangeLog 2.1.0: "max_packet_size now defaults to 2,000,000 bytes"; man page "Defaults to 2000000 bytes since 2.1"; 200 KB crops fit (AD-11) | confirmed |
| Mosquitto options `listener 1883 127.0.0.1`, `allow_anonymous true`, `persistence true`, `persistence_location` | man page v2.1.2 (V-13); all valid in 2.0.x | confirmed |
| Mosquitto Windows installer 2.1.2 | WinGet listing and ManageEngine patch catalogue show `mosquitto-2.1.2-install-windows-x64.exe` under mosquitto.org/files/binary/win64; mosquitto.org itself unreachable from the sandbox | confirmed (secondary sources) |
| Mosquitto on Linux distro | Fedora 44 `mosquitto` 2.1.2-2.fc44 (dnf) | confirmed |
| MySQL 9.7 LTS exists | V-11 | confirmed |
| `CONVERT_TZ` with numeric offsets needs no tz tables | refman 9.7 §7.1.15 and §14.7 | confirmed |
| Next static export `output: 'export'` + `trailingSlash: true` | bundled `static-exports.md`; empirical build produced `out/<route>/index.html` | confirmed |
| Unsupported in export: route handlers reading Request, cookies, rewrites, proxy, server actions, dynamic routes without `generateStaticParams`, default image loader | bundled `static-exports.md` "Unsupported Features" | confirmed (AD-9 should also warn off `next/image` with the default loader) |
| `next/font/local` | bundled `13-fonts.md` | confirmed |
| `NEXT_PUBLIC_*` inlined at build | bundled `environment-variables.md` ("frozen with the value evaluated at build time"); an empty `NEXT_PUBLIC_API_URL=` inlined as `""` empirically | confirmed (build reads `.env.production`; keep the dev value in `.env.development` so it isn't frozen into the demo build) |
| ESP32 PubSubClient facts (3.1.1, QoS 0 publish, sub QoS 0/1, 256-byte default, `setBufferSize`, LWT, keepalive settable) | V-06 | confirmed (library unmaintained) |
| LWT within about 8 s at 5 s keepalive | MQTT 3.1.1: broker disconnects after 1.5 × keepalive = 7.5 s | confirmed |
| `crypto.randomUUID()` on 127.0.0.1 | V-15 | confirmed |

## Memlog `version` entries: audit

| Memlog line | Result |
| --- | --- |
| 16 (registry versions, next engines) | All match `npm view` today |
| 17 (TS 7 can't load, needs `experimental.useTypeScriptCli`) | **Wrong** for Next 16.4.2 (V-01) |
| 18 (Node 24.22.1 newest LTS, Node 26 Current) | True today, but Node 24 went Maintenance on 2026-10-20 and Node 26 goes LTS on 2026-10-28 (V-10) |
| 19 (MySQL 9.7.0 LTS 2026-04-21; "third-party lists 9.7.2") | GA date confirmed. The latest patch is now 9.7.4 (2026-10-20), so this was a stale secondary source (V-11) |
| 20 (Mosquitto 2.1.2, max_packet_size, allow_anonymous) | Confirmed from primary source (man page and ChangeLog at tag v2.1.2) |
| 21 (static export unsupported list) | Confirmed against the bundled 16.4.2 docs. The `useSearchParams`/Suspense build rule was missed (V-05) |
