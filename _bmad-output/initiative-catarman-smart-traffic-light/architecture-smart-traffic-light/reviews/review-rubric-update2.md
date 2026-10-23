---
review: rubric
run: update 2 (2026-10-22)
target: ../architecture-smart-traffic-light.md
inputs:
  - ../.memlog.md (entries after "Update run 2")
  - ../../spec-smart-traffic-light/spec-smart-traffic-light.md
  - ../../spec-smart-traffic-light/{degradation-levels,stack,privacy-compliance,kpis,hardware,milestones,risks,users,glossary,roadmap}.md
  - ./review-rubric.md, ./review-adversary.md (prior gate, for regressions)
date: 2026-10-22
mode: read-only (spine not edited)
---

# Rubric review, update 2: architecture spine vs. the good-spine checklist

## Verdict

**Sound to ticket M1, but fix one M2 seam before Squads B and C integrate.** Update 2 folds in every "Pending spine update" from `stack.md`. AD-1 to AD-18 keep their numbers, AD-19 is new, and `lint_spine.py` reports 0 findings. The contract examples match the AD text on `remainingS`, `power`, `bootCount`, `vision/speed-alert` and `override.commandId`, and the SSE table matches AD-8. The privacy periods in AD-19 match `privacy-compliance.md`.

The one high finding is that CAP-10's "the simulator's event stands in" has no safe mechanism. The spine also has no rule against a second vision link. Either gap can put a simulated heartbeat beside the live one, so the CAP-16 occlusion demo fails and the counts history fills with duplicates. The mediums are:

- a leftover contradiction between AD-4 and AD-11 over crops;
- an AD-15 listener rule that nothing in the setup enforces for MySQL;
- an AD-5 sentence that can make the M1 state-slice writer break the M2 countdown;
- the new topic recorded as decided against AD-4's own sign-off rule.

**Counts:** critical 0 · high 1 · medium 4 · low 9.

## Findings

### Critical

None.

### High

#### RU-01 · high · CAP-10's M2 simulator stand-in has no safe path, and nothing limits the bus to one vision link

- **Checklist:** 1 (misses a divergence point), 4 (CAP-10 coverage), 7 (AD-17 vs. AD-3 and AD-5)
- **Location:**
  - AD-17, Speed alert ("until then the simulator's event stands in").
  - AD-3: "M2 go-live means stopping the simulator"; the start check looks only at a live *controller*; `--force` "clears the retained statuses and starts anyway".
  - AD-5: "Only one controller link is active at a time", and the closed clientId list.
  - AD-15 ACL: vision users, `stl-sim-vision` included, write `vision/#`.
  - Spec CAP-10 ("The simulator emits the same event"); `milestones.md`, CAP-10 order.
- **Problem:** In M2 the simulator is stopped, yet the spec's CAP-10 fallback is the simulator's event. The only way to produce that event today is to run the simulator. Its vision role publishes these beside `stl-vision`:
  - a retained `vision/status` (`source: "sim"`), with an LWT that marks vision `online: false` when the simulator exits;
  - 1 Hz `vision/heartbeat` and `vision/demand`;
  - `vision/counts` and `vision/breach`.

  The consequences:
  - (a) The ESP32 consumes both heartbeat streams. Covering the lens never produces 3 missed heartbeats, so the CAP-16 L2 handover, the centerpiece of the M2 demo, fails. Simulated `demand` also feeds CAP-14 green allocation.
  - (b) Both roles' counts and breaches persist under different UUIDs, which corrupts CAP-2 and CAP-4 history.
  - (c) The `link` slice flips between sim and live.
  - (d) If the operator uses `--force` because the controller check refuses to start, it clears the live retained statuses and starts a second controller, which breaks AD-5.

  The same collision happens whenever an M2 developer runs `npm run sim` while the vision node is up. The start check never looks at vision, and the ACL allows it.
- **Fix:**
  1. Add to AD-5: "Only one vision link is active at a time: `stl-vision` or `stl-sim-vision`."
  2. Extend the AD-3 start check to vision: refuse if `vision/status` shows `source: "live"`, `online: true` and a *non-retained* heartbeat arrives within 3 s. `--force` must not override a live role that a non-retained message proves is running.
  3. Give CAP-10 a stand-in mode. `npm run sim -- --speed-alert-only` connects with a new clientId, `stl-sim-speed-alert` (add it to AD-5's list and to the AD-15 ACL with write access to `vision/speed-alert` only). It publishes nothing else and sets no status or LWT. Alternatively, state in AD-17 that the fallback is shown only in a simulator-only run, never beside the live diorama.

### Medium

#### RU-02 · medium · AD-4's drop rule still contradicts AD-11's "a crop problem never loses the event", and "oversized" now has two meanings

- **Checklist:** 2, 7
- **Location:**
  - AD-4: "The receiver parses every inbound MQTT message … An invalid message is logged and dropped."
  - AD-11: Optional crop (≤ 204,800 base64 chars), Pixel cap (SOF long side > 64 px), Bad crops.
  - Contract `vision/breach` example (`crop.mime: "image/jpeg"`).
- **Problem:** S0 writes the breach schema and CAP-6 writes the handler. The natural encoding of the contract, which the generated JSON Schema for Squad B also needs, is `crop.data` with `.max(204800)` and `crop.mime` as a literal. With that schema, a breach whose crop is too long or isn't a JPEG fails the parse, and AD-4 drops the whole event, which AD-11 forbids. Update 2 added a second "oversized" test, the SOF long side, that only the handler can run. So "oversized" is now judged in two places by two owners, under opposite outcomes: dropped vs. stored without a crop. The prior gate's A-14 fix adopted the wording but not the mechanism.
- **Fix:** Name the mechanism in AD-4 and AD-11. `contracts/` exports `visionBreach`, with the strict crop shape, for publishers and JSON Schema. It also exports `visionBreachIngest = visionBreach.extend({ crop: z.unknown().optional() })` for the backend. The CAP-6 handler validates `crop` with the strict crop schema plus the SOF check. On any failure it stores the breach with `cropUrl: null` and logs a `[mqtt]` warning. Add one sentence: "AD-4's drop rule applies to the envelope; a bad `crop` never fails the envelope."

#### RU-03 · medium · Nothing implements "only the broker leaves 127.0.0.1" for MySQL or `next dev`

- **Checklist:** 2, 5 (security and deployment envelope)
- **Location:**
  - AD-15: Hotspot mode ("the broker is the only listener that leaves `127.0.0.1`"), Hosts, Installs.
  - Local setup step 3 (`infra/mysql/create-user.sql`, user `stl`/`stl`).
  - AD-14: S0 writes `infra/` and `docs/setup.md`.
  - Spec access constraint and `privacy-compliance.md`, Access.
- **Problem:** In hotspot mode the laptop joins a shared network, but S0's artifacts are never told to implement the rule:
  - Native MySQL 8.4 and 9.x default to `bind_address=*`, and the X protocol port 33060 to `mysqlx_bind_address=*`. The Windows configurator can open 3306 in the firewall, while Ubuntu's package binds `127.0.0.1`.
  - `create-user.sql` may create `'stl'@'%'` or `'stl'@'localhost'`; the spine doesn't say. Its password, `stl`, is in the repo.

  On some laptops, any hotspot client could then read breach rows and crops, or write rows. That defeats the access rule this update tightened for Express and the broker. `next dev` also listens on `0.0.0.0` by default; this affects dev only. The outcome depends on OS and on whoever writes `create-user.sql`.
- **Fix:** Add to AD-15: "MySQL accepts local connections only. `create-user.sql` creates `'stl'@'localhost'` and `'stl'@'127.0.0.1'`, never `'%'`. `docs/setup.md` sets `bind-address=127.0.0.1` and `mysqlx-bind-address=127.0.0.1` on native installs. The dashboard `dev` script runs `next dev -H 127.0.0.1`." Add a pre-hotspot check to `setup.md`: `ss -ltn` or `netstat -an` lists only 1883 on a non-loopback address.

#### RU-04 · medium · "A change in `remainingS` alone is not a change" can be misread on the SSE side, which breaks the M2 countdown

- **Checklist:** 1, 7 (AD-5 vs. the Countdown convention)
- **Location:**
  - AD-5: republish at least every 2 s; "A change in `remainingS` alone is not a change".
  - AD-8: slices, writer throttling.
  - SSE table, `state` row.
  - Countdown convention: "starting at the state's `receivedAt`", "resyncs on every `state`".
- **Problem:** AD-5's sentence is about the controller's publish trigger. The M1 CAP-3 developer of `services/state.ts`, reading the same AD, can reasonably do either of these:
  - write the slice only when the persisted columns change, the same comparison the persist handler makes;
  - keep the first `receivedAt` of an unchanged state.

  Both fit AD-8 as written, and either way the M2 countdown never resyncs. A retained `controller/state` delivered at backend start also gets `receivedAt = now` with a stale `remainingS`. Countdown behavior while the controller is `STALE` isn't stated.
- **Fix:**
  - SSE table, `state` row: "`services/state.ts` writes the slice on every non-retained `controller/state`, periodic republishes included. `receivedAt` is that message's receive time. A retained copy updates the slice with `remainingS` removed."
  - AD-5: append "(this governs the controller's publish trigger only)".
  - Countdown convention: "Hidden while `useLiveness('controller')` is `STALE`."

#### RU-05 · medium · `vision/speed-alert` is recorded as decided, against AD-4's own sign-off rule and the spec

- **Checklist:** 2, 7
- **Location:**
  - Structural Seed: "Additive changes, 2026-10-22, by user decision".
  - Seed header summary: "a new topic is additive", with no sign-off.
  - AD-4: a new topic "needs sign-off … from the squads whose role publishes or subscribes to it".
  - `stack.md`, Pending spine updates: "a contract change under AD-4 that Squad B signs off".
  - Memlog line 103 is tagged `(decision)`, not `(decision by user)`.
- **Problem:** The rule AD-4 gains in this update requires Squad B's sign-off for exactly this topic, and the seed skips it in the same update. The spec says Squad B signs off. The memlog records no user waiver, although the run's own rule was "ask on any spec/spine conflict". The seed's "by user decision" attribution is unsupported. Build risk in M1 is low, since S0 only encodes the schema, but the spine contradicts its own rule from day one and sets a precedent.
- **Fix:** Pick one.
  - (a) Mark the topic "proposed; pending Squad B sign-off (AD-4)" in the seed and the topic table. S0 still encodes it, and a Squad B change becomes a pre-M2 contract change.
  - (b) Ask the user. If they waive the sign-off, log it as `(decision by user)` and say "Squad B sign-off waived by user decision" in the seed.

  Either way, align the seed's summary sentence with AD-4.

### Low

#### RU-06 · low · AD-19's job would reach the repository directly, which the dependency diagram forbids

- **Location:** AD-19, One job; the dependency diagram (`jobs → services → repos`); AD-16 (`start(ctx)`, where `ctx` injects services); AD-14, Repository row (`<table>.ts`).
- **Problem:** AD-19 names only `jobs/retention-purge.ts` and `db/repositories/retention.ts`. A job may import services only, so the owner either breaks the diagram or invents a service. "The periods live only in it" could mean the job or the repository. `retention.ts` isn't a table name under the extension row.
- **Fix:** "`jobs/retention-purge.ts` calls `services/retention.ts`, which holds the periods as constants and calls `db/repositories/retention.ts`. That file is the one cross-table repository, an exception to `<table>.ts`."

#### RU-07 · low · AD-19 leaves four interactions open

- (a) **FK cascade:** the ERD doesn't say whether `breach_crop.breach_event_id` has `ON DELETE CASCADE`. S0's immutable M1 migration settles this silently, and the purge order depends on it. **Fix:** state "FK `ON DELETE CASCADE`" in the Data model, or "the purge deletes crops before their events".
- (b) **Wrong trigger:** "When: in M2, before the December demo. M1 data is younger than 21 days." By December, M1 data is about 7 weeks old. The real trigger is the first real crop from the vision node (CAP-13 integration, weeks 5–6). **Fix:** "Lands before `edge_vision` stores its first crop."
- (c) **Broker store:** while the backend is down, QoS 1 `vision/breach` messages, crops included, queue in `infra/mosquitto/data/`, unlimited under `max_queued_messages 0`. If the `stl-backend` session never resumes, crops stay there outside AD-19. **Fix:** "The broker store is covered by the backup rule; delete `infra/mosquitto/data/` when retiring a laptop."
- (d) **Seed timestamps:** different stories write `backend/db/seed/*.sql` and may use absolute dates. Absolute dates give an empty "today" chart at the December demo, and the boot purge then deletes the seeded crops. **Fix:** "Seed rows use timestamps relative to `UTC_TIMESTAMP(3)`."

#### RU-08 · low · The corridor link-drop rule is undefined in USB-serial fallback

- **Location:** AD-18 ("the controller sees only its own broker connection"; the CORRIDOR 60 s rule); AD-17, serial bridge; Deferred, Serial bridge framing.
- **Problem:** In CAP-15 fallback the ESP32 has no broker connection while the bridge still carries commands over serial. Read literally, a corridor ends 60 s after the switch. Firmware (Squad A) and the bridge author may read "link" differently.
- **Fix:** In AD-18, write "the controller's command link: its MQTT connection, or the serial link while the bridge is in use".

#### RU-09 · low · `hotspot.conf`'s "plus the persistence options above" is ambiguous about `max_queued_messages 0`

- **Location:** AD-15, Hotspot mode vs. Broker config. `compose.conf` says "otherwise identical", but `hotspot.conf` doesn't.
- **Problem:** `max_queued_messages` is a queue option, not a persistence option. If it's left out, the broker falls back to its default of 1000 per client. That happens in M2, exactly where the offline-retention KPI is stress-tested.
- **Fix:** "`hotspot.conf` is `mosquitto.conf` with `listener 1883` on all interfaces, `allow_anonymous false`, `password_file` and `acl_file`. Every other line is identical."

#### RU-10 · low · Hotspot provisioning and venue operations are only partly specified

- **Location:** AD-15, Credentials; Local setup (M1 only); Deferred: Broker address on the hotspot, and CI, backups and observability.
- **Problem:**
  - (a) The simulator has two usernames but reads one `MQTT_PASSWORD`, so `passwd` must give both the same password. This isn't stated.
  - (b) No step generates `infra/mosquitto/passwd`, hands credentials to Squads A and B, or opens 1883 in the Windows firewall, and no M2 owner is named.
  - (c) `.env` now holds `MQTT_PASSWORD`, and M1 is submitted as the repository, but the spine never says `backend/.env` and `simulator/.env` are gitignored. Meanwhile `.env.test` and the dashboard `.env.*` files are apparently committed.
  - (d) There is no venue runbook covering start order and recovery if the backend or broker dies mid-pitch.
- **Fix:**
  - AD-15: "`.env` is gitignored in every workspace. `.env.example`, `backend/.env.test` and the dashboard `.env.development` and `.env.production` are committed. Both simulator users share `MQTT_PASSWORD`."
  - Deferred: "Hotspot setup and venue runbook (M2, Squad C): `passwd` generation, credential hand-off, firewall rule, start order and restart steps, in `docs/setup.md` before week 5."

#### RU-11 · low · Simulator details the update left open

- (a) **`remainingS` in the simulator's L1 and L2:** AD-3 allows a fixed 10 s green there, but the contract defines L1/L2 `remainingS` as time to max green (20 s). The simulator would show "up to 18 s" while the green ends at 10 s, and a developer may instead report time to the simulator's own end. Rounding is also open. **Fix:** "The simulator reports time to max green, like the firmware. `remainingS` is the ceiling of the remaining seconds."
- (b) **Start check and retained state:** the start check accepts "a `controller/state` arrives within 5 s", but `controller/state` is retained, so a stale copy satisfies it instantly. That contradicts AD-5's "retained never counts as liveness". The topic table also omits the simulator as a `controller/state` subscriber. **Fix:** write "a non-retained `controller/state`", and add the simulator to that row's subscribers.
- (c) **No owner for the M2 simulator fields:** `remainingS`, `power` and `bootCount` need the core-owned `controller-role.ts` timing engine, but no capability-map row lists `simulator/` under CAP-8 or CAP-19. **Fix:** add the simulator controller role to CAP-8's and CAP-19's "Lives in", with the owning M2 story.
- (d) **Fault across a simulated reboot:** AD-7 says the fault survives a reboot, but AD-3's REPL reboot doesn't say so. **Fix:** "A REPL reboot keeps a latched fault."

#### RU-12 · low · What a speed alert shows, and where it mounts, is unstated

- **Location:** Speed alert convention; Privacy convention (the Tier 1 list); capability map, CAP-10 ("a dashboard alert component").
- **Problem:** Tier 1 doesn't list `elapsedMs` or `thresholdMs`, and the convention forbids "a speed" but not those fields. One developer will show "640 ms < 800 ms" and another a generic label. The mount point is also open: every route means a root layout that the shell owns, and `/` means CAP-3's page.
- **Fix:**
  - Speed alert convention: "Shows approach, class, time and 'faster than threshold'. It may show `elapsedMs` and `thresholdMs` as times, never as a speed. It mounts on `/` only, from `components/speed-alert/`, with one line in the page."
  - Privacy convention: "Speed-alert fields are displayed transiently only."

#### RU-13 · low · Small internal inconsistencies

- (a) AD-5 says the backend persists "when one of the `signal_state_change` columns differs", but `id` and `received_at` are columns too. **Fix:** enumerate the compared columns: level, signal_ns, signal_ew, flood, fault, override_mode, override_phase, override_command_id.
- (b) The Enums convention says UPPER_SNAKE, but `status.source` is `"sim" | "live"`, and `visuals.ts` must cover "every enum family above". **Fix:** add a `Source` family and mark it lowercase as a contract v1 exception.
- (c) The Public ids convention has the vision node mint UUIDs with `crypto.randomUUID()`, which doesn't exist in Python. **Fix:** "UUID v4 (`crypto.randomUUID()` in Node, `uuid.uuid4()` in Python)".
- (d) AD-6 mentions "the controller's `ts`", but no controller payload carries one. **Fix:** "Controller payloads carry no `ts`."
- (e) The backend ownership row lists `state-changes.ts` and `counts.ts` with the owner "CAP-2, CAP-4", and no repository is assigned. If the non-binding split separates CAP-2 from CAP-4, both stories need `repositories/vehicle-count.ts`, and they need the same Manila-hour bucketing so the slice and the chart match. **Fix:** split the row. Assign each `repositories/<table>.ts` to the CAP that writes the table. The hourly query lives behind `services/counts.ts` (CAP-2), and the CAP-4 route reuses it.
- (f) AD-15 says "never over the network", but screen mirroring (Miracast) uses a wireless link. **Fix:** "never by loading the dashboard on another device".

#### RU-14 · low · The spec has drifted from the updated spine; the spec owner fixes this, not the spine

- The spec kernel Constraints, the glossary ("Spine") and the `stack.md` intro say "AD-1 to AD-18". They should say AD-1 to AD-19.
- `stack.md`, "Pending spine updates": every item has now been folded in, so the section is stale.
- `privacy-compliance.md` says "the crop pixel cap the backend checks (spine Deferred, AD-11)". The cap is no longer in Deferred.
- `hardware.md`, OLED: "as optional contract fields (`stack.md`)" should point to the spine's MQTT contract v1.
- **Fix:** run a spec update to repoint these references. The spine needs no change.

## Checklist summary

| # | Checklist item | Result |
| --- | --- | --- |
| 1 | Fixes the real divergence points and misses none | **Partial.** Missing: a one-vision-link rule (RU-01), the crop-schema mechanism (RU-02), and when the state slice is written (RU-04). The M1 seams are otherwise well fixed. |
| 2 | Every AD's Rule is enforceable and prevents its divergence | **Partial.** AD-15's listener rule isn't implemented for MySQL (RU-03). AD-4 is contradicted by the seed (RU-05). AD-11 conflicts with AD-4 (RU-02). AD-19 conflicts with the dependency diagram (RU-06). |
| 3 | Nothing under Deferred lets two units diverge | **Pass.** Each item has one owner or is settled before its consumer builds. "Broker address on the hotspot" has owners and a deadline. RU-08 moves one definition out of "Serial bridge framing" into AD-18. |
| 4 | Covers CAP-1 to CAP-20 | **Pass with gaps.** All 20 CAPs are mapped. The CAP-10 fallback is unsafe (RU-01), and the CAP-8 and CAP-19 simulator parts have no owner (RU-11c). |
| 5 | Every owned dimension is decided, deferred or open, including the operational envelope | **Partial.** Environments, retention (AD-19) and access are decided. Gaps: MySQL exposure (RU-03), hotspot provisioning and venue runbook (RU-10), retention edges (RU-07). |
| 6 | AD-1 to AD-18 keep their numbers; new ADs are AD-19+ | **Pass.** Headings run AD-1 to AD-19 in order, and lint is clean. |
| 7 | Internal consistency | **Mostly consistent.** Contract examples vs. AD text, the SSE table vs. AD-8, the M1 ownership tables vs. AD-14, and the Privacy convention vs. AD-19 all agree. Exceptions: RU-02, RU-05, RU-06, RU-11b and RU-13. |

## Checked and sound (no finding)

- **AD-7 rule 6, the contract comments and the sequence diagram agree:**
  - A `commandId` on `NONE` lets the periodic state resolve a release.
  - A corridor that ends on link loss shows as `mode: "NONE"` with the corridor's id, the same in AD-7, AD-18, the contract comment and `degradation-levels.md`.
  - No reset path exists for the fault, matching the spec.
- **AD-5 additive fields:**
  - `remainingS` and `power` are live only, so the ERD needs no change and dedup is unaffected.
  - The worst-case `controller/state` is about 230 B, within the 512 B limit.
  - `bootCount` rides the LWT.
  - QoS 0 `speed-alert` isn't queued for offline sessions (the broker default is `queue_qos0_messages false`), so "never stored" holds at the broker too.
- **AD-6** includes `vision/speed-alert`, and `SpeedAlertItem` carries `occurredAt` and `receivedAt`.
- **AD-8 and the SSE table:**
  - There are 7 events with one writer each, and `speedAlert` is an occurrence.
  - The `link` example JSON matches the table, `bootCount` included.
  - Binds lists CAP-10.
  - The `Power` enum is in the family list that `visuals.ts` covers.
- **AD-15:**
  - The ACL matches AD-2 and AD-18: only `stl-backend` writes `controller/override/cmd`.
  - It matches the AD-5 clientIds and the topic publishers.
  - Express on `127.0.0.1` plus HDMI or mirroring matches the spec's access constraint and `milestones.md`.
  - The options it uses are valid on Mosquitto 2.0 and 2.1.
- **AD-19 vs. the Privacy convention and `privacy-compliance.md`:**
  - The periods match: crops 21 d; breach rows, state changes and the override log 1 y; counts kept.
  - Reads after a crop purge are defined.
  - The backup rule is linked from Deferred.
- **AD-11 vs. the privacy rules:** anonymization (≤ 64 px, then blur, no text detection) matches `privacy-compliance.md`. The simulator placeholder is ≤ 64 px, and the CAP-6 handler owns the check.
- **AD-3 vs. `degradation-levels.md`:** the timings, recovery hold, L4 exit, latched fault and its REPL stand-in, and the link-drop rule all match.
- **AD-12:** model labels equal class ids, and jeepney stays in the file, matching `kpis.md`.
- **AD-17:** the speed alert matches spec CAP-10 and the CAP-10 order in `milestones.md`, with no speed unit.
- **Countdown convention:** "up to N s" for L1 and L2 green and an exact count otherwise, matching `stack.md`.
- **The update is complete:** every `stack.md` "Pending spine update" is folded in, and every item pruned from Deferred is now decided in an AD or convention.
