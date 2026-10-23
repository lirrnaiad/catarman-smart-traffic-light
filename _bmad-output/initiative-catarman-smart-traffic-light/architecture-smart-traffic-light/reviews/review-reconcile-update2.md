---
review: reconcile (update run 2)
target: ../architecture-smart-traffic-light.md
inputs:
  - ../../spec-smart-traffic-light/stack.md (Pending spine updates)
  - ../../spec-smart-traffic-light/degradation-levels.md
  - ../../spec-smart-traffic-light/privacy-compliance.md
  - ../../spec-smart-traffic-light/hardware.md
  - ../../spec-smart-traffic-light/kpis.md
  - ../../spec-smart-traffic-light/spec-smart-traffic-light.md
  - ../../spec-smart-traffic-light/milestones.md
  - ../../spec-smart-traffic-light/.memlog.md (update run 3)
  - ../.memlog.md (entries after "Update run 2")
date: 2026-10-22
mode: read-only (no spine or spec edits)
---

# Reconcile review, update run 2: spine vs. spec decisions of 2026-10-22

## Verdict

**The update mostly landed.** All six "Pending spine updates" bullets in `stack.md` reached the spine:

- the contract fields
- the CAP-10 topic
- login and broker auth
- the 64 px cap
- retention
- the link-drop rule and the fault reset

The timing table, recovery rule, latched fault, the anonymization method, the text-detection ban, the model-label rule, cited PCU and the HDMI mirroring fallback also landed. The spine's Deferred list no longer claims that any of these are undecided.

**What remains:**

- **One high gap.** The spec's CAP-10 fallback ("the simulator's event stands in") cannot run at the M2 demo under AD-3 and AD-5. The only way to run it, `--force`, would put a second controller and a second vision publisher next to the live ESP32.
- **Four medium findings:**
  - The speed-alert topic skipped the Squad B sign-off that the spec, and the spine's own AD-4, require.
  - The purge job is scheduled after real crops can already be older than 21 days.
  - What a conflict fault does to an override that is already active is undefined.
  - The 60 s corridor rule doesn't say how it applies under the USB Serial fallback.
- **Thirteen low findings**, mostly wording, ownership and edge-case precision.

None of this blocks M1 (CAP-1 to CAP-6).

**Counts:** critical 0 · high 1 · medium 4 · low 13. Six spec-side follow-ups are listed separately; they are not spine findings.

## Coverage check: what landed

| Spec input | Spine location | Status |
| --- | --- | --- |
| stack.md: `remainingS`, `power` in `controller/state`; `bootCount` in `controller/status`; "up to N s" in L1/L2 | Structural Seed contract (lines 597, 605–614); AD-5 (185, 196); SSE `link`/`state` rows (695–696); Countdown convention (531) | Landed |
| stack.md: CAP-10 topic | Topic table (592), payload (640–642), AD-4 (166), AD-6 (205), AD-8 (248), AD-17 (464), `SpeedAlertItem`, Speed alert convention | Landed; sign-off conflict (RC2-02) |
| stack.md: no login, Express on 127.0.0.1, broker password + ACL | AD-15 (412–423) | Landed |
| stack.md / privacy: 64 px cap | AD-11 (302–305, 310), contract comment (638) | Landed |
| stack.md / privacy: retention table, daily job | AD-19 | Landed; timing (RC2-03) |
| stack.md / degradation: link drop, fault reset | AD-18 (475–478), AD-7 rule 6 + Fault reset (226, 232), AD-3 (137–138) | Landed; gaps RC2-04, RC2-05 |
| degradation: timing table, recovery, flood, 3 missed heartbeats | AD-3 (132–136), AD-17 (460) | Landed |
| degradation: unplugged-sensor detection | Deferred, Firmware internals (951) | Correctly left to Squad A |
| privacy: anonymization method, text-detection ban | AD-11 (302), Privacy convention (535) | Landed |
| privacy: Access | AD-15 | Landed |
| hardware: OLED/dashboard fields, reset button, GPIO 35 | contract comments (597, 614), AD-7 Fault reset, CAP-8/CAP-19 map rows | Landed |
| kpis: classes, PCU cited not calibrated, model labels | AD-12 (319–330) | Landed |
| kernel CAP-5/8/10/13/16/17/19, Access, Privacy | AD-7, AD-15, AD-17, AD-11, capability map | Landed (RC2-L02 for one dropped word) |
| milestones: CAP-10 order, HDMI → mirroring | AD-17 (464), AD-15 (414) | Landed; mechanism gap (RC2-01) |

## Findings

### High

#### RC2-01 · high · The CAP-10 "simulator stands in" fallback has no legal way to run beside live roles

- **Spine location:** AD-17 Speed alert (line 464); AD-3 start guard and go-live (lines 151–152); AD-5 client identity (lines 182–183); AD-18 (line 479).
- **Spec source:**
  - `milestones.md`, M2: "**CAP-10 order:** Squad B adds the crossing-threshold event only after CAP-12 and CAP-13 meet their KPIs. If time runs out, the simulator's event stands in."
  - Kernel CAP-10 success: "The simulator emits the same event."
- **What's wrong:**
  - AD-17 copies the fallback ("until then the simulator's event stands in"). AD-3, though, makes the simulator all-or-nothing: it always opens both the controller and vision links, and "M2 go-live means stopping the simulator."
  - With the ESP32 live, the start guard refuses to run. `--force` "clears the retained statuses and starts anyway", which causes three problems:
    - It wipes the live `controller/status`.
    - It starts `stl-sim-controller` beside `stl-controller`, which violates "Only one controller link is active at a time."
    - It starts `stl-sim-vision`, which publishes `vision/heartbeat` and `vision/demand` that the ESP32 consumes (AD-18). Simulated demand would then drive the diorama's real green times in L1, and on exit the simulator's vision LWT would mark vision offline.
  - In hotspot mode the ACL lets `stl-sim-vision` write all of `vision/#`, so the broker does not stop any of this.
  - So if Squad B runs out of time, the spec's fallback either can't be shown, or someone uses `--force` and corrupts the live demo's safety-relevant inputs.
- **Suggested fix:** in AD-3, add an alerts-only simulator mode, for example `npm run sim -- --only speed-alert`:
  - It opens one link with a new clientId (for example `stl-sim-alerts`, added to AD-5's list), with no LWT and no `status`.
  - It publishes only `vision/speed-alert` from the REPL.
  - It bypasses the live-controller guard, because it touches no controller or heartbeat topic.
  - In AD-15's ACL, `stl-sim-alerts` writes only `vision/speed-alert`.

  Alternatively, state that the stand-in applies only in dev and rehearsal, and that at the demo CAP-10 is shown in a separate pre-go-live simulator segment. That narrows what the spec promises, so ask the user.

### Medium

#### RC2-02 · medium · `vision/speed-alert` was locked without the Squad B sign-off that the spec and AD-4 require

- **Spine location:** Structural Seed "Additive changes, 2026-10-22, by user decision … recorded as decided, like the lock" (line 579); the summary at line 577; AD-4 new-topic rule (line 166); memlog line 103, which is tagged `(decision)`, not `(decision by user)`.
- **Spec source:**
  - `stack.md`, Pending spine updates: "**CAP-10 topic:** a new vision topic for the crossing-threshold speed alert. This is a contract change under AD-4 that **Squad B signs off**; Squad A is unaffected."
  - Spec memlog, run 3: "Needs a new topic, a contract change under AD-4 that Squad B signs off."
- **What's wrong:**
  - The user decided that CAP-10 exists and where its event comes from. The payload shape (`id`, `approach`, `vehicleClass`, `elapsedMs`, `thresholdMs`, no unit), QoS 0 and no persistence were the architect's design, yet line 579 labels them "by user decision".
  - AD-4 itself (line 166) requires sign-off from the publishing squad, which is Squad B. The spine contradicts both the spec's explicit "Squad B signs off" and its own rule.
  - The run's own rule was "ask on any spec/spine conflict", and this conflict was not asked.
  - Line 577's summary of AD-4 ("a new topic is additive") also drops the sign-off clause.
- **Suggested fix:**
  - Mark `vision/speed-alert` as "v1 proposed; Squad B confirms the payload before building it (after CAP-12 and CAP-13 meet their KPIs). Until then the simulator and dashboard build to this shape."
  - Restrict the "by user decision" attribution to `remainingS`, `power` and `bootCount`.
  - Make line 577 repeat AD-4's sign-off clause for new topics.
  - Or, if the user waives Squad B sign-off, record that waiver as `(decision by user)`.

#### RC2-03 · medium · The purge job is due "before the December demo", but real crops pass 21 days earlier

- **Spine location:** AD-19 "**When:** in M2, before the December demo. M1 data is younger than 21 days." (line 501)
- **Spec source:**
  - `privacy-compliance.md`: Retention sits under "## Tier 1: both milestones (binding)", with the row "Anonymized breach crops | 21 days".
  - "A daily backend job deletes expired rows by their stored timestamps."
- **What's wrong:**
  - The M1 rationale holds, since simulator placeholder crops are not personal data. But real crops start when `edge_vision` first publishes `vision/breach` to a persisting backend: CAP-13 work in weeks 1–4, integration in weeks 5–6.
  - A crop stored in mid-November is past 21 days before a purge that lands only "before the December demo". The binding Tier 1 period would be broken during M2 development, on the same laptop and database that go to the venue.
- **Suggested fix:** change the trigger to "before the first real vision-node crop is stored, at the latest when CAP-13 first runs against the backend". Also say that until then, `edge_vision` runs only against `stl_test` or a database that is dropped afterwards. AD-19 is one small job and one repository, so it could even ride with CAP-6 in M1 at low cost.

#### RC2-04 · medium · A conflict fault that starts while an override is active is undefined in the contract

- **Spine location:** AD-7 rule 6 ("`state.override.mode` is what is in effect now", line 226), Conflict fault (line 231), Fault reset (line 232); AD-3 (line 137).
- **Spec source:**
  - Kernel Constraints, Signal safety: "A conflict fault is not a degradation level, and it outranks manual overrides."
  - `degradation-levels.md`: "while a conflict fault is active, the controller rejects `CORRIDOR` with reason `CONFLICT_FAULT` and accepts `FLASHING_AMBER` and release." and "After a reset, the cycle resumes at an all-red clearance."
- **What's wrong:**
  - The spine settles *new* commands during a fault, but not a `CORRIDOR` that is already active when the fault trips. The fault forces Flashing Amber, so the corridor is no longer in effect.
  - Neither source says whether the controller ends the corridor and reports `mode: "NONE"` with the corridor's `commandId` (as link loss does), or keeps reporting `CORRIDOR` while the lamps flash.
  - It also isn't settled whether the corridor resumes after the reset button.
  - The firmware and the simulator could encode this differently. The dashboard's *active* indicator reads only `state.override` (rule 7), so it could show "corridor active" over flashing lamps. That is the misleading display AD-7 exists to prevent.
- **Suggested fix:** add one line to AD-7, after confirming with the user and Squad A: "A conflict fault ends an active `CORRIDOR`: the state reports `mode: "NONE"` with the corridor's `commandId`, and it does not resume after reset. An active `FLASHING_AMBER` override stays in effect." Mirror it in AD-3.

#### RC2-05 · medium · The 60 s corridor rule doesn't define "link" under the USB Serial fallback

- **Spine location:** AD-18 "Override when the link drops … the controller sees only its own broker connection … `CORRIDOR` holds for 60 s after the broker connection is lost" (lines 475–477); AD-17 Serial fallback (lines 457–459).
- **Spec source:**
  - `degradation-levels.md`: "the ESP32 sees only its own broker connection (spine AD-18) … A corridor holds for 60 s after the broker connection is lost".
  - Kernel CAP-15: "the USB Serial fallback can be switched in within 30 s".
  - `stack.md`: "USB Serial bridge … ready within 30 s if MQTT fails".
- **What's wrong:**
  - The fallback exists for exactly the case where the ESP32's broker connection is gone. While commands and heartbeats arrive over serial, the ESP32 still has no broker connection.
  - Read literally, AD-18 ends an MDRRMO evacuation corridor 60 s into a fallback that is working.
  - AD-17 makes the bridge transparent to the backend, but nothing says what the ESP32 counts as "link up" for the corridor timer. That is a cross-unit rule between Squads A and B (the bridge framing) and the AD-7 display.
- **Suggested fix:** in AD-18, define the link as "the controller's command path: its broker connection, or the serial bridge when the fallback is active". The 60 s timer runs only while neither is up. The spec says "broker connection", so confirm with the user and Squad A before changing the wording, and add the point to the Squad A note.

### Low

#### RC2-L01 · The capability map leaves AD-7 off CAP-17

- **Spine location:** Capability map row "CAP-14, CAP-16, CAP-17, CAP-18 Controller behavior … AD-5, AD-17, AD-18" (line 927).
- **Spec source:** Kernel CAP-17: "a conflict-monitor fault forces Flashing Amber until the controller-box reset button is pressed, even across a reboot".
- **Wrong:** the latched fault, the reset-button-only rule and `CONFLICT_FAULT` rejections live in AD-7, but the row doesn't cite it.
- **Fix:** add AD-7 to that row.

#### RC2-L02 · The Privacy convention drops "database/registry cross-referencing"

- **Spine location:** Privacy convention (line 535).
- **Spec source:**
  - `privacy-compliance.md` Forbidden: "… body-number or plate reading, and database cross-referencing."
  - Kernel Privacy: "No OCR, text detection, face identification or registry cross-reference."
- **Wrong:** OCR, text detection, faces and body numbers are listed; cross-referencing is not.
- **Fix:** append "No component joins vehicle data with any external registry or database."

#### RC2-L03 · "Never over the network" is ambiguous for Miracast, and the mirroring fallback has an untested radio interaction

- **Spine location:** AD-15 "The venue TV gets the dashboard over HDMI or by screen mirroring from the laptop, never over the network." (line 414)
- **Spec source:** `milestones.md`: "If HDMI fails, mirror the laptop screen (Miracast, built into Windows, works offline) rather than opening the dashboard in the TV's browser, so the backend stays local-only."
- **Wrong:**
  - Miracast is itself a wireless (Wi-Fi Direct) link, so "never over the network" reads as excluding it. The intended rule is "never by the TV loading the dashboard from Express".
  - Miracast is built into Windows, but the edge laptop may be Linux.
  - Wi-Fi Direct shares the laptop radio with the 2.4 GHz hotspot that carries the ESP32 link and heartbeats.
- **Fix:** reword to "never by the TV's browser loading the dashboard over the network". Add a Deferred line: the mid-November HDMI check also tests mirroring with the hotspot up and the ESP32 connected, and confirms the laptop's OS supports it.

#### RC2-L04 · Stale Deferred wording: the serial bridge doesn't find the broker over the hotspot

- **Spine location:** Deferred "Broker address on the hotspot … how the ESP32 and the serial bridge find the laptop's broker" (line 948).
- **Spec source:** `stack.md` Wired fallback, "USB Serial bridge between laptop and ESP32", which is laptop-side per spine AD-17.
- **Wrong:** the bridge runs on the laptop and connects on `127.0.0.1` (AD-15 Hosts). Only the ESP32 needs to discover the broker.
- **Fix:** drop "and the serial bridge".

#### RC2-L05 · AD-3's simulated reboot and recovery don't mirror two decided behaviors

- **Spine location:** AD-3 (lines 135, 137, 148).
- **Spec source:**
  - Kernel CAP-17: "… until the controller-box reset button is pressed, **even across a reboot**".
  - `degradation-levels.md` Recovery: "climbs back to the highest level its healthy inputs support" (L3 → L1 directly).
- **Wrong:**
  - The REPL "reboot the controller role (`bootCount` + 1)" doesn't say that a latched fault survives it, or that the controller link disconnects and reconnects. The FAULT-after-reboot path and the LWT path for the dashboard therefore can't be exercised.
  - "Climbs back once the cause has been clear" doesn't say the target is the highest supported level.
- **Fix:** add "a simulated reboot keeps a latched fault, drops and reconnects the controller link, and republishes `status` with the new `bootCount`". Add "climbs to the highest level its healthy inputs support".

#### RC2-L06 · `repositories/retention.ts` breaks the extension-point naming rule

- **Spine location:** AD-19 One job (line 498) vs. AD-14 extension table "Repository | `backend/src/db/repositories/<table>.ts`" (line 386).
- **Spec source:** `privacy-compliance.md` "A daily backend job deletes expired rows" (one job).
- **Wrong:** `retention.ts` is named by concern and spans four tables. A builder following AD-14 would put each `DELETE` in its table's repository, which other CAPs own, and that breaks single ownership.
- **Fix:** add a row or a note to the extension table: "Cross-table purge: `repositories/retention.ts`, owned by the retention story (AD-19)".

#### RC2-L07 · A corridor that ends on link loss leaves no trace in the override log

- **Spine location:** AD-7 rule 6 (line 226); AD-19 override log retention.
- **Spec source:**
  - Kernel CAP-5: "Activating and releasing it … writes a timestamped override log entry."
  - `privacy-compliance.md`: override log kept 1 year for "MDRRMO audits".
- **Wrong:**
  - The automatic release after 60 s produces no `override_command` row. Its command stays `APPLIED` with no end time, and the release shows only as a `signal_state_change` row.
  - This is not an operator release, so CAP-5 isn't violated, but an audit reading `/log/overrides/` sees a corridor that never ended.
- **Fix:** state in AD-7 that an automatic release is recorded only in `signal_state_change` (`override_mode` `NONE`, same `override_command_id`), and that `/log/overrides/` links or annotates it from there. Or accept the gap explicitly.

#### RC2-L08 · The countdown runs from a retained or stale `state`

- **Spine location:** Countdown convention (line 531); AD-5 "A message delivered with the retain flag set never counts as liveness" (line 187); Staleness convention (line 533).
- **Spec source:** `stack.md`: "yellow, all-red and L3 counts are exact".
- **Wrong:**
  - After a backend restart, the retained `controller/state` arrives with a fresh `receivedAt` but a `remainingS` up to 2 s old. If the controller is dead, the value is arbitrarily old.
  - The dashboard counts down from it, and per Staleness keeps showing it, so an "exact" count is wrong.
- **Fix:** add "the countdown shows only while `useLiveness('controller')` is `LIVE`". Or have `services/state.ts` drop `remainingS` from a retained delivery.

#### RC2-L09 · The `optional (M2)` fields don't oblige the controller in M2

- **Spine location:** contract comments "remainingS (optional, M2)", "power (optional, M2)", "bootCount … optional (M2)" (lines 597, 612–614).
- **Spec source:**
  - Kernel CAP-8 success: "the phase countdown and the power source appear on the dashboard".
  - `hardware.md`: "The ESP32 also publishes the countdown, power source and boot count for the dashboard (CAP-8)".
- **Wrong:** "optional" is a schema-level allowance that lets the M1 simulator omit the fields. Squad A could read it as nice-to-have, and CAP-8 would then fail.
- **Fix:** add "Optional in the schema. From M2 the controller always sends `power` and `bootCount`, and sends `remainingS` whenever an interval is timed."

#### RC2-L10 · AD-11 crop limits: a stale byte cap and an unstated SOF parser

- **Spine location:** AD-11 Optional crop and Pixel cap (lines 303–304); AD-13 dependency ownership (lines 345–348).
- **Spec source:** `privacy-compliance.md` "scales the crop so its long side is at most 64 px".
- **Wrong:**
  - A 64 px JPEG is a few KB, so the 204,800-character cap (sized for a ~150 KB JPEG) no longer limits anything meaningful.
  - The SOF check is M1 work in CAP-6, and the spine doesn't say it is hand-parsed. A builder reaching for an image library would hit AD-13's lockfile-chore rule four days before M1.
- **Fix:** say "parse the SOF0/SOF2 marker directly; no image library". Optionally lower the base64 cap (for example 16,384 characters) so a non-compliant payload is dropped before parsing.

#### RC2-L11 · Broker persistence can hold crops outside AD-19

- **Spine location:** AD-15 broker config, `persistence true`, `infra/mosquitto/data/`, `max_queued_messages 0` (line 419); AD-5 backend `clean: false` (line 191); AD-19 Backups (line 500).
- **Spec source:** `privacy-compliance.md` Retention: "Anonymized breach crops | 21 days".
- **Wrong:** `vision/breach` messages (with crops) queued for the backend's persistent session are written to the broker's data directory. AD-19's backup rule covers only `mysqldump`.
- **Fix:** add to AD-19 Backups: "`infra/mosquitto/data/` is never backed up or copied off the laptop".

#### RC2-L12 · The serial bridge's `bootCount` and credentials aren't stated

- **Spine location:** AD-5 "The serial bridge publishes `controller/status` on the ESP32's behalf" (line 189); AD-15 Credentials (line 422).
- **Spec source:**
  - `hardware.md`: "The dashboard shows the same power source and boot count (CAP-8)".
  - `stack.md`: "The ESP32 and the vision node then connect with credentials."
- **Wrong:**
  - Under the fallback, `status` comes from the bridge, but nothing says it carries the ESP32's `bootCount`, read over serial. Without it, the CAP-19 dashboard proof breaks on the fallback.
  - AD-15 names where the ESP32 and the vision node keep their passwords, but not the bridge.
- **Fix:** add "including the ESP32's `bootCount`" to AD-5, and "the serial bridge keeps its password in its own config, outside git" to AD-15.

#### RC2-L13 · The CAP-7 vision-node stream's bind address is only implied

- **Spine location:** AD-17 Video (line 456); AD-15 Hotspot mode, "the broker is the only listener that leaves `127.0.0.1`" (line 420).
- **Spec source:**
  - `privacy-compliance.md` Access: "Overrides and data come only from the edge laptop".
  - Kernel Access constraint.
- **Wrong:** raw annotated video is the most identifying data in the system. AD-17's "an HTTP stream served by the vision node" doesn't say it binds `127.0.0.1`, and the rule exists only by inference from AD-15.
- **Fix:** add to AD-17 Video: "a vision-node stream binds `127.0.0.1`, like Express".

## Spec-side follow-ups (outside the spine; for the next `bmad-spec` update)

These are stale references in the spec package, now that the spine has been updated:

1. Kernel Constraints, Architecture: "Tickets cite its AD-1 to AD-18". The glossary's "Spine" entry and the `stack.md` intro say the same. AD-19 now exists, so change these to "AD-1 to AD-19", or to "its ADs".
2. `stack.md` "Pending spine updates": every bullet has landed. Move them under "Settled by the architecture spine".
3. `privacy-compliance.md`: "64 px is also the crop pixel cap the backend checks (spine Deferred, AD-11)". The spine's Deferred entry is gone, so cite AD-11 only.
4. `hardware.md` OLED: "as optional contract fields (`stack.md`)". These now live in spine MQTT contract v1, so point there.
5. `privacy-compliance.md` Tier 1 example "(e.g. `TRICYCLE`, `MOTORCYCLE`)" conflicts with the lower snake_case class ids in `kpis.md` and spine AD-12.
6. `stack.md` CAP-10 bullet "Squad B signs off". Align it with however RC2-02 is resolved.
