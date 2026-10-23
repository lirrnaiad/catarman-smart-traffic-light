---
review: reconcile
target: ../architecture-smart-traffic-light.md
inputs:
  - ../../spec-smart-traffic-light/spec-smart-traffic-light.md
  - ../../spec-smart-traffic-light/{stack,milestones,degradation-levels,kpis,privacy-compliance,hardware,risks,users,glossary,roadmap}.md
  - ../../spec-smart-traffic-light/.memlog.md
  - ../.memlog.md
date: 2026-10-22
---

# Reconcile review: architecture spine vs. spec package

## Verdict

The spine is mostly reconciled. All four M1 decisions the user made landed, and so did Privacy Tier 1, the local-only runtime, the Windows and Linux portability work, the `[M1 · bmad-architecture]` open question, and stack.md's integration, simulator and push-transport items. Nothing makes an M1 success criterion impossible.

There is one **high** gap: the S0 foundation story is large and blocks all three developers, which works against the spec's parallel, thin-slice constraint four days before M1. There are seven **medium** quiet drops or contradictions:

- handler ownership collides across the parallel tracks (R-02)
- some simulator behaviors have no owner (R-03)
- the safety-path invariant is never stated (R-04)
- controller liveness and keepalive are missing (R-05)
- the spine's limit on Workbench contradicts the spec (R-06)
- the privacy rule contradicts the spine's own tables (R-07)
- the AD rules already close off the CAP-7 deferral (R-08)

The rest are **low**.

Counts: critical 0 · high 1 · medium 7 · low 17.

## Findings

### R-01 · high · S0 blocks all three developers and is not thin

- **Input:** kernel Constraints ("Squad C's 3 developers build … one `bmad-build` story per session, so stories must be buildable side by side without blocking each other"). milestones.md M1 ("M1 falls 4 days after spec creation … M1 slices must be thin"). risks.md row 5 (mitigation: "stories sliced thin for 3 parallel developers").
- **Didn't land / conflicts:** AD-14 makes one story, S0, the only creator of:
  - the root tooling
  - every contract: 9 topics and 6 SSE events
  - the full initial migration: 5 tables
  - the backend core: config, pool, MQTT client and registry, status and heartbeat handlers, SSE hub, error middleware, health
  - the dashboard shell
  - the simulator core

  `docs/setup.md`, `infra/` and the test toolchain (Vitest, Supertest, `stl_test`, `reset-db`) are implicitly in S0 as well. Two developers wait until it merges, and it is unlikely to fit in one `bmad-build` session with M1 due Oct 26.
- **Fix:** Cut S0 down to tooling, `contracts/`, the initial migration and `infra/` (S0a). Then land the backend core, dashboard shell and simulator core as three parallel foundation stories in separate directories.

### R-02 · medium · Handler ownership and DoD demos collide across the parallel tracks

- **Input:** kernel Constraints (stories "buildable side by side without blocking each other").
- **Didn't land / conflicts:** Three stories edit the one `controller/state` handler file, which breaks AD-14's "extends only by adding files":
  - the CAP-2 story inserts `signal_state_change` rows (track 1 owns "the counts and state handlers")
  - the CAP-3 story updates the `state` slice (SSE table: "CAP-3 story"; track 2)
  - the CAP-5 story resolves overrides when a matching `override.commandId` arrives (AD-7 step 4)

  AD-16's DoD ("CAP flow demonstrated against the simulator") also chains the tracks. CAP-4 (track 3) cannot finish before track 1's counts handler and simulator counts behavior land, and CAP-3's per-class counts wait on track 1's `counts` slice.
- **Fix:** Give each MQTT topic handler one owning story, or make the registry fan out so each story adds its own subscriber file. Allow a DoD demo to use seeded rows or fixtures when the upstream track hasn't merged.

### R-03 · medium · Simulator behaviors that CAP-1 and CAP-3 need have no owner, and the simulated controller's level semantics are undefined

- **Input:** CAP-1 success ("every M1 view (CAP-3 to CAP-6) populates and updates; … drive … into each degradation level L1–L4"). CAP-3 intent (signal phase per approach, PCU score per approach). degradation-levels.md (L2 when the heartbeat is lost or confidence is low; L3 fixed cycle; L4 Flashing Amber on all approaches). AD-3's own "Prevents: link-loss paths left untested in M1".
- **Didn't land / conflicts:** S0's simulator core lists "both connections, status and LWT, state publishing, REPL skeleton", and track 1 lists "level, flood and counts behaviors". Three behaviors have no owner:
  - (a) NS/EW phase cycling, GREEN→YELLOW→RED
  - (b) `vision/heartbeat` at 1 Hz. Without it, S0's own heartbeat handler marks `link.vision` STALE after 3 s, so the walking skeleton shows a stale vision link.
  - (c) `vision/demand` PCU, computed from `vehicle-classes.json`

  AD-3 also doesn't say whether stopping the vision role sends the simulated controller to L2, as the ESP32 would. It doesn't say whether L4 forces `FLASHING_AMBER` aspects either.
- **Fix:** Add heartbeat publishing to S0's simulator core, assign phase cycling and demand to named stories, and state that the simulated controller follows degradation-levels.md: heartbeat loss → L2, flood → L4 with `FLASHING_AMBER`, and an override outranks both.

### R-04 · medium · "ESP32 is the autonomous master; dashboard and backend are out of the safety path" is never stated

- **Input:** kernel Constraints ("Losing the vision node, broker, backend or dashboard lowers the degradation level but never stops signaling; the dashboard and backend stay out of the safety path"). CAP-17 success. kpis.md Signal uptime 100%. The spine memlog's inherited-constraint entry.
- **Didn't land / conflicts:** The topology honors it: vision talks to the controller directly, and the backend publishes only the override command. No AD says it, though, and grep finds neither "safety" nor "autonomous". Nothing stops a later story from adding a backend→controller topic that the controller waits on. Nothing makes the simulated controller keep cycling when the backend or broker is down, either.
- **Fix:** Add an AD stating three things. The controller never needs a backend message, retained topic or ack to keep signaling. The backend publishes only `controller/override/cmd`. The simulated controller keeps cycling with the backend or broker down, and this is a recorded M1 demo step.

### R-05 · medium · Controller liveness depends on an LWT with no keepalive set, and QoS 0 state has no periodic resend

- **Input:** CAP-3 success (each state change within 1 s). risks.md row 2 (venue 2.4 GHz congestion → dropped MQTT packets). CAP-8 success (physical changes appear on the dashboard).
- **Didn't land / conflicts:** AD-5 makes everything the ESP32 publishes QoS 0. `controller/state` only "may be republished", and `link.controller` comes only from the retained status and LWT. No keepalive is set anywhere: MQTT.js defaults to 60 s, so the LWT fires about 90 s after a kill. So:
  - In M1, a killed simulator still shows as ONLINE for up to 90 s.
  - In M2, a dropped QoS 0 state or ack leaves a stale panel and a false `TIMEOUT` until the next change.

  The controller's session settings (`clean`) are also left open, although AD-5 claims to prevent "stale commands re-applied on reconnect".
- **Fix:** Set a short keepalive (about 5 s) for every role. Require the controller to resend `controller/state` every N s (about 2 s), and mark `link.controller` STALE after a missed window. Have controller roles connect with `clean: true`.

### R-06 · medium · The spine limits MySQL Workbench to "viewing data only", which contradicts the spec's "design and admin tool"

- **Input:** stack.md Database row ("MySQL; MySQL Workbench for design and admin"). kernel Assumptions ("Workbench as the design and admin tool"). milestones.md course wording ("MySQL workbench for Backend").
- **Didn't land / conflicts:** AD-2 says "MySQL Workbench is for viewing data only", and AD-10 says "never through Workbench". Together they take away the design role the spec settled and the course names.
- **Fix:** Allow Workbench for admin work and for design artifacts, such as an EER diagram reverse-engineered from the migrated schema for the course. dbmate migrations stay the only way a schema change lands.

### R-07 · medium · The privacy convention is so broad that the spine's own tables break it

- **Input:** privacy-compliance.md Tier 1. Its list is scoped to "CAP-6, CAP-9, CAP-13" data. Forbidden: OCR, face ID, body-number or plate reading, database cross-referencing.
- **Didn't land / conflicts:** The Privacy convention says "no schema, table, log line or view holds a field outside the Tier 1 list", and the data model says "Every table holds Tier 1 fields only". None of these fields is on the Tier 1 list:
  - `signal_state_change`
  - `override_command`: mode, phase, status, reason
  - the heartbeat's `confidence` and `fps`
  - PCU demand

  A literal reviewer would block CAP-2 and CAP-5. A lenient one would stop trusting the rule.
- **Fix:** Reword the rule. Data about vehicles and road users is limited to the Tier 1 list, and nothing identifying is stored, logged, shown or exported (no OCR text, plate or body number, face, driver, or cross-frame track id). Operational signal, override and link data are not personal data and are allowed.

### R-08 · medium · The AD rules already close off the CAP-7 video deferral

- **Input:** stack.md "Open for bmad-architecture" ("Also how video frames are delivered for CAP-7"). CAP-7 success. risks.md row 1 (thermal: keep the dashboard stack light).
- **Didn't land / conflicts:** Deferred lists the transport as open; the spine memlog weighs a "vision node MJPEG endpoint vs other". But two rules already block the dashboard from loading a stream from the vision node:
  - AD-2: "The dashboard talks only to Express"
  - AD-9: "Data comes only through `src/lib/api.ts` … and `LiveProvider`"

  AD-17 also bars frames from passing "through backend ingest". The only path left is an Express video proxy, which is the heaviest option on the thermally limited laptop.
- **Fix:** Add a named exception to AD-2 and AD-9 so CAP-7 may add one video origin on the same laptop, or an Express pass-through that never decodes frames. Decide which in the deferral.

### R-09 · low · Override attempts refused with 409 leave no log entry

- **Input:** CAP-2 intent ("override actions are stored … queryable as history"). users.md POSO goal ("objective digital audit logs").
- **Didn't land / conflicts:** AD-7 step 2 "returns `409 CONTROLLER_OFFLINE` and writes nothing". An MDRRMO attempt made while the controller is offline leaves no record.
- **Fix:** Insert the `override_command` row as `REJECTED` with reason `CONTROLLER_OFFLINE` before returning 409, or state that refused attempts are not audit events.

### R-10 · low · The L2 "presence, not queue length" wording didn't reach the visuals convention

- **Input:** degradation-levels.md L2 ("Level 2 measures presence, not queue length. Calling it queue measurement is invalid."), plus that file's level names.
- **Didn't land / conflicts:** The Dashboard visuals convention puts level labels in `visuals.ts` but doesn't fix their text. Nothing stops "queue" wording on the L2 badge or on the PCU panel while at L2.
- **Fix:** Fix the `visuals.ts` level labels to the degradation-levels.md names, and add "never describe L2 as queue measurement" to the convention.

### R-11 · low · Seed values for `vehicle-classes.json` and the habal-habal label aren't fixed

- **Input:** kpis.md weights table: car 1.0, tricycle 0.5 ("1 car ≈ 2 tricycles"), motorcycle including habal-habal 0.25, jeepney 1.5, utility van 1.0; pedicab dropped. Spec memlog decision by user.
- **Didn't land / conflicts:** AD-12 fixes only the ids. S0 creates the file with no stated weights or labels.
- **Fix:** State that S0 seeds `vehicle-classes.json` from kpis.md verbatim, including the label "Motorcycle (incl. habal-habal)".

### R-12 · low · The offline-retention KPI isn't traced, and the broker's queue durability isn't set

- **Input:** kpis.md ("Offline telemetry retention: 100% of hourly counts and anonymized violation logs retained locally during network drops (now MySQL)"). CAP-2.
- **Didn't land / conflicts:** The spine never cites the KPI. AD-5 relies on `clean: false` queueing, but four things undercut it:
  - `infra/mosquitto/mosquitto.conf` sets no `persistence` or `max_queued_messages`, so the queue dies with the broker
  - the backend's subscription QoS isn't fixed at 1, and the effective QoS is the lower of publish and subscribe
  - Local setup step 5 lets the default OS service run without the repo config
- **Fix:** Add `persistence true` and a sized `max_queued_messages` to the repo config, require the backend to subscribe at QoS 1 to persisted topics, and cite the KPI in AD-5.

### R-13 · low · Queued counts are bucketed by replay time, not by when the vision role saw them

- **Input:** CAP-4 success (per-hour counts match the stored records for the same hours). kpis.md offline retention.
- **Didn't land / conflicts:** AD-6 buckets by `receivedAt`. After a backend restart, counts queued at the broker are stamped when they are replayed and can land in the wrong hour. AD-6's reason, that the ESP32 has no clock, doesn't apply to the vision role, which shares the laptop clock.
- **Fix:** Bucket `vision/counts` by `ts` when it is present, the same rule as breach `occurredAt`, and keep `receivedAt` for controller messages.

### R-14 · low · The <200 ms frame-to-LED KPI isn't referenced, and the demand rate cap can use half that budget

- **Input:** kpis.md Edge decision latency (<200 ms). CAP-15 success.
- **Didn't land / conflicts:** The spine correctly fixes `vision/demand` as a QoS 0 path from vision to controller that skips the backend. But it caps the rate "at most 10 Hz [ASSUMPTION]" with no throttling rule, and a trailing-edge throttle adds up to 100 ms.
- **Fix:** State that the cap is leading-edge (publish at once on a change, then suppress for 100 ms), and cite the KPI in the contract.

### R-15 · low · `signal_state_change` deduplication doesn't follow the AD-5 id rule

- **Input:** CAP-2 intent (signal-state changes are stored and queryable).
- **Didn't land / conflicts:** AD-5 says "Every persisted event carries an `id` (UUID) … `INSERT IGNORE`". But `controller/state` has no id and the table has no UUID column. "Inserts a row when the state changed" compares against an in-memory copy that a restart wipes, so every backend restart inserts the retained state again as a duplicate.
- **Fix:** On startup, compare against the latest `signal_state_change` row, and explicitly exempt `controller/state` from the UUID rule.

### R-16 · low · The `counts` slice doesn't reset at the hour boundary

- **Input:** CAP-3 (live per-class counts). The spine memlog's decision that the live counts match CAP-4's latest bar.
- **Didn't land / conflicts:** The slice holds the "current Asia/Manila hour" and is pushed "on every change". `vision/counts`, though, is "not sent when there were none". At :00 with no traffic, the panel keeps the previous hour's totals.
- **Fix:** Have the backend push a fresh `counts` slice at every Asia/Manila hour boundary.

### R-17 · low · A no-HDMI fallback or the M2 hotspot each defeats the only override guard

- **Input:** kernel Open Question `[M2 · team]` on the HDMI cable. milestones.md ("shows on the venue Smart TV over HDMI"). CAP-11. kernel Constraints ("no remote override").
- **Didn't land / conflicts:** The login and broker-auth deferral is triggered only "before the ESP32 joins the hotspot", and AD-15's `127.0.0.1` binding is the only guard. Two cases defeat it:
  - If the TV has to load the dashboard over the LAN, Express has to bind the hotspot.
  - Once Mosquitto has an anonymous hotspot listener, any hotspot client can publish `controller/override/cmd` directly, skipping AD-2's log and the confirm step.
- **Fix:** Change the deferral trigger to "before any listener leaves 127.0.0.1", and require a broker ACL that lets only `stl-backend` publish `controller/override/cmd`.

### R-18 · low · The serial bridge has no fixed identity

- **Input:** stack.md Wired fallback. CAP-15 success (the fallback can be switched in within 30 s).
- **Didn't land / conflicts:** AD-5 fixes five clientIds. AD-17 adds a laptop-side bridge that republishes controller traffic and forwards demand, heartbeat and cmd to serial, but gives it no clientId or LWT. If it reuses `stl-controller` while the ESP32's Wi-Fi client reconnects, it causes the kick loop AD-5 is meant to prevent.
- **Fix:** Reserve the clientId `stl-serial-bridge`, have it publish `controller/status` for the ESP32 with its own LWT, and state that only one controller link is active at a time.

### R-19 · low · The crop size cap limits transport, not identifiability (Tier 1)

- **Input:** CAP-6 success ("no identifying data (… body numbers) is stored or shown"). kernel Open Question `[M2 · Squad B]` on crop anonymization.
- **Didn't land / conflicts:** AD-11 caps crops at ≤ 200 KB of base64, which is enough for a legible body number, and the backend accepts any crop under that size.
- **Fix:** Add to Deferred a maximum crop size in pixels, read from the JPEG header without decoding, to be set when Squad B answers its open question.

### R-20 · low · The thermal risk is only partly addressed: no load budget or soak check

- **Input:** risks.md row 1 ("Architecture should keep the dashboard stack light"). kernel Assumptions (≥15 FPS alongside Mosquitto, Next.js, Express and MySQL "through the 20-minute presentation").
- **Didn't land / conflicts:** AD-9 removes the Next.js server, which helps. Several gaps remain:
  - no resource budget
  - no lean MySQL config
  - the 10 Hz `demand` slice is pushed straight to SSE, so the dashboard re-renders 10 times a second when 1 s would do
  - no gate to validate the assumption with the full stack running
- **Fix:** Add an M2 gate to Deferred: a 20-minute full-stack soak test at ≥15 FPS before weeks 5–6. Combine `demand` SSE pushes to at most 4 Hz.

### R-21 · low · The display target isn't carried into the M1 dashboard conventions

- **Input:** kernel Constraints ("The dashboard targets Chromium, full-screen on the venue Smart TV"). CAP-11.
- **Didn't land / conflicts:** Only the demo runtime diagram mentions full-screen Chromium. With no viewport or legibility rule, the M1 views may need reworking for the TV.
- **Fix:** Add a convention that the main status view is laid out for 1920×1080 full-screen Chromium with no page scroll.

### R-22 · low · How the spine reads CAP-1's "operator" isn't recorded

- **Input:** CAP-1 success ("an operator can drive the simulated intersection … and generate breach events on demand"). users.md defines operators as dashboard users.
- **Didn't land / conflicts:** AD-3 puts the controls only in the simulator's REPL, "never in the dashboard". That is defensible because it keeps the M2 swap clean. But it reads "operator" as the person at the simulator terminal, which differs from users.md, and the instructor demo then needs a terminal on screen.
- **Fix:** Record that reading in AD-3, and add a scripted scenario that walks L1→L4 and a breach for the M1 demo.

### R-23 · low · stack.md's "Framework and runtime versions" is answered only for the Node side

- **Input:** stack.md "Open for bmad-architecture", item 4.
- **Didn't land / conflicts:** The Stack table covers the Node packages, MySQL and Mosquitto. Python, Ultralytics and the ESP32 toolchain have no versions, and Deferred doesn't list them.
- **Fix:** Add "Python, Ultralytics, ESP32 core and MQTT library versions (Squads A and B)" to Deferred.

### R-24 · low · The firmware toolchain is narrowed to PlatformIO

- **Input:** stack.md Firmware row ("C++ on ESP32, built with PlatformIO / Arduino IDE").
- **Didn't land / conflicts:** The source tree comment says `firmware/ # Squad A, PlatformIO (M2)`, although AD-17 leaves firmware internals to Squad A.
- **Fix:** Change it to "PlatformIO or Arduino IDE (Squad A's choice)".

### R-25 · low · The spine's `sources:` omits the binding companions

- **Input:** the kernel's `companions:` list, which is binding.
- **Didn't land / conflicts:** The frontmatter `sources:` lists only the kernel and the spec memlog. The spine still relies on degradation-levels.md, privacy-compliance.md and others in its text.
- **Fix:** List all ten companions in `sources:`.

## Checked and landed (no finding)

| Input item | Where it landed |
| --- | --- |
| Kernel OQ `[M1 · bmad-architecture]`: integration path and the flow of state and overrides | AD-1, AD-2, AD-7, MQTT contract v1, override lifecycle diagram |
| stack.md open item 1: integration path | AD-1, AD-2, topic table |
| stack.md open item 2: simulator plug-in and clean M2 swap | AD-3 (two role connections, `source`, stop the simulator to go live) |
| stack.md open item 3: push within 1 s | AD-8 (SSE, 250 ms budget); the CAP-7 part is deferred (see R-08) |
| stack.md open item 4: versions | Stack table, Node side (see R-23) |
| stack.md: placement of the backend directory | `backend/` at the top level |
| User decision: no login plus a confirm dialog (M1) | AD-7 step 1, AD-15 loopback binding |
| User decision: operator chooses the corridor phase, NS or EW | AD-7 modes, contract `phase` |
| User decision: classes and PCU editable without code | AD-12 (one JSON file, served at runtime, unknown ids accepted) |
| User decision: 1 s refresh | AD-8 |
| Override outranks L4; level and override shown separately | AD-7 |
| Corridors are manual only | AD-2: the backend is the only publisher of the cmd; the simulator has no corridor control |
| Simulated and live data share one contract | AD-3, AD-4 |
| Heartbeat at about 1 Hz; 3 misses, or low confidence, → L2 | AD-17, heartbeat `ok` and `confidence` |
| Privacy Tier 1: no OCR or face work; crops anonymized upstream; logs carry no crop data | AD-11, Logging convention (wording issue in R-07) |
| Local only and offline | AD-9 (no remote assets), AD-15 (loopback, runtime traffic stays local) |
| Windows and Linux | AD-6 numeric time-zone offset, AD-13 portable scripts and LF line endings, AD-15 `127.0.0.1`, dbmate binaries, setup steps |
| Single monorepo with the brief's directory names | Source tree, AD-13 |
| JSON schema shared with Squads A and B | AD-4 (generated JSON Schema) |
| No video over Wi-Fi or MQTT | AD-17 |
| M2 open questions (login, CAP-10 source, retention, override when the link drops, crop anonymization, timings, recovery, all-red) | Deferred, each with an owner |

## M1 success criteria: can each be met under the spine's rules?

| CAP | Achievable | Caveat |
| --- | --- | --- |
| CAP-1 | Yes | Phase cycling, heartbeat and demand behaviors in the simulator need owners (R-03) |
| CAP-2 | Yes | Duplicate state rows on restart (R-15); broker queue durability (R-12) |
| CAP-3 | Yes | Controller staleness can lag up to about 90 s (R-05); counts at the hour rollover (R-16) |
| CAP-4 | Yes | Hour assignment after queued replay (R-13); the DoD demo depends on track 1 (R-02) |
| CAP-5 | Yes | Refused attempts aren't logged (R-09) |
| CAP-6 | Yes | M1 uses the placeholder crop; the pixel cap for Tier 1 is deferred (R-19) |
