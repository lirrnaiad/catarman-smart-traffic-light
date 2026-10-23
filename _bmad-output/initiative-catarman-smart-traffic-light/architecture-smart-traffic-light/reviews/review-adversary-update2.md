---
review: adversary
lens: "Construct two units one level down that each obey every AD to the letter yet still build incompatibly: clashing shared-data shapes, two owners of one entity, conflicting state-mutation paths"
target: ../architecture-smart-traffic-light.md
scope: "Update run 2 (memlog entries after 'Update run 2 (2026-10-22)') and the seams those changes open with the rest of the spine"
inputs:
  - ../architecture-smart-traffic-light.md
  - ../.memlog.md
  - ../../spec-smart-traffic-light/{spec-smart-traffic-light,degradation-levels,privacy-compliance,stack,milestones,kpis,hardware}.md
  - ./review-adversary.md (first-run findings, not re-raised)
units: "M1: S0, backend core (BC), dashboard shell (DS), simulator core (SC), W2a = CAP-2+CAP-4, W2b = CAP-3+CAP-5, W2c = CAP-6. M2: C8 = CAP-8 (countdown, power, boot count, hotspot), C9 = CAP-9 export, C10 = CAP-10 speed alert, RP = AD-19 retention purge (CAP-2, M2). Outside Squad C: FW = Squad A firmware, VN = Squad B vision node, BR = serial bridge (CAP-15, Squads A and B)"
date: 2026-10-22
---

# Adversary review: architecture spine, update run 2

## Verdict

**Safe for M1, not yet safe for the M2 integration.** At the payload level, the update's additions are well pinned:

- `remainingS`, `power` and `bootCount` are additive and optional.
- The new-topic rule in AD-4 is clear.
- The persist-dedup column list rules out a row per second.
- `speedAlert` has an owner in every layer and a clear "never stored" path.
- The broker ACL's write set matches AD-18.

The holes sit at three seams the update opened:

1. **Two publishers on one role.** The serial bridge (CAP-15) and the simulator's CAP-10 stand-in each put a second publisher on a role. As written, the link rules and the simulator's start guard can't tell the two apart, so overrides get refused, or simulated vision data reaches the real ESP32.
2. **"`mode` is what is in effect now" (AD-7 rule 6).** The simulator and the firmware can each read this literally in two ways, during a transition and during a conflict fault. One of those readings produces exactly the new auto-release encoding `{mode: NONE, commandId: <corridor>}`, so the dashboard and the state history can't tell "corridor arriving" from "corridor ended by link loss".
3. **Ownership of M2 work.** The hotspot `infra/` files, the simulator's M2 features, per-table repositories and the dashboard mount points each have either two plausible owners or none. These need settling **before the M1 tickets are cut**, because they decide what S0, SC and BC build now.

Nothing here blocks the Oct 26 midterm. The 3 highs must close before the week-5 integration.

Counts: **critical 0 · high 3 · medium 12 · low 11**, plus 7 rules that can't be enforced as written.

| # | Sev | Hole | Units in conflict |
| --- | --- | --- | --- |
| U2-01 | high | Under the serial bridge, a late LWT or a graceful `online: false` clobbers a live controller link, and the link state machine is undefined, so overrides return 409 for the rest of the demo | BC `services/link.ts` ↔ BR ↔ FW (esp-mqtt auto-reconnect) ↔ SC start guard |
| U2-02 | high | The CAP-10 "simulator stands in" fallback means running the simulator next to live roles, and its vision link then drives the real ESP32 | SC / C10 ↔ FW ↔ VN |
| U2-03 | high | `override.mode` during a transition collides with the auto-release encoding; `phase` on `NONE` is unpinned | SC ↔ FW ↔ W2b panel ↔ W2a state history |
| U2-04 | medium | A conflict fault during an active `CORRIDOR` or `FLASHING_AMBER` override: whether the override is reported, ended or resumed is undefined | SC ↔ FW ↔ W2b / C8 UI |
| U2-05 | medium | The countdown ticks on retained or stale state, because the Staleness rule says "keep the last value" | C8 countdown ↔ DS `useLiveness` ↔ W2b `services/state.ts` |
| U2-06 | medium | The state slice's write policy (dedup or every message) is unset, so countdown resync and power changes can be swallowed | W2b `services/state.ts` ↔ C8 |
| U2-07 | medium | Crop limits written into zod drop the whole breach, against AD-11's "never loses the event" | S0 breach schema ↔ W2c handler |
| U2-08 | medium | The SOF reader and the JPEG flavor (progressive placeholder, naive byte scan) can disagree | SC placeholder / VN encoder ↔ W2c SOF reader |
| U2-09 | medium | `elapsedMs` and `thresholdMs` are integers on one side and floats on the other | VN ↔ S0 MQTT schema ↔ `SpeedAlertItem` ↔ the backend's dev SSE parse |
| U2-10 | medium | One repository file per table, but several stories query each table; `retention.ts` breaks the naming rule; the job-to-repository edge is forbidden | W2a ↔ W2b ↔ W2c ↔ C9 ↔ RP |
| U2-11 | medium | Hotspot infra and `MQTT_PASSWORD`: S0 is the only creator of `infra/`, yet the hotspot is CAP-8 work, so both stories or neither build it | S0 ↔ C8 ↔ BC / SC `config.ts` |
| U2-12 | medium | The simulator's M2 features have no owner and no extension point for state fields or REPL commands | SC ↔ C8 ↔ C10 |
| U2-13 | medium | The ACL lets every user read `stl/#`, so the ESP32 may subscribe to `vision/#` and receive 200 KB breaches | FW ↔ W2c / VN payloads ↔ AD-15 ACL |
| U2-14 | medium | QoS and retain never reach Squads A and B (only payload schemas are generated); paho's default QoS 0 breaks offline retention | S0 `contracts:schema` ↔ VN ↔ FW ↔ BR |
| U2-15 | medium | Foreign keys are unspecified, so S0's migration can break CAP-2 persist, the AD-19 purge order or `reset-db` | S0 ↔ W2a ↔ RP ↔ BC |
| U2-16 | low | `LiveProvider`'s listener set and where the transient speed alert mounts | DS ↔ C10 |
| U2-17 | low | M2 dashboard mount points (the header is the shell's); M1 stories may pre-build M2 fields | W2b ↔ C8 ↔ DS |
| U2-18 | low | `remainingS` in the simulator's fixed 10 s L1/L2 green; rounding; the yellow into a corridor | SC ↔ FW ↔ C8 |
| U2-19 | low | `bootCount` under the serial bridge and in the simulator's "reboot" | BR ↔ FW ↔ SC ↔ BC |
| U2-20 | low | An auto-released corridor never reaches the override log | W2b ↔ W2a |
| U2-21 | low | Ack `reason`: enum or free string | S0 ↔ FW ↔ DS `visuals.ts` |
| U2-22 | low | The CAP-9 export route collides with `breaches.ts`, "JSON under /api" and `Page<T>`; the Tier 1 columns are unfixed | C9 ↔ W2c ↔ REST convention |
| U2-23 | low | Purge vs cursors and caching: a cursor can reference a purged row; Chromium's disk cache can keep crops past 21 days | RP ↔ W2c |
| U2-24 | low | ACL file mechanics: `topic` vs `pattern`, a hard-coded `iid`, silent drops, `--force` clearing from the wrong link, one password for two sim users | S0 / C8 ↔ SC ↔ BC |
| U2-25 | low | After S0, contract edits have no owner path | S0 ↔ every later story |
| U2-26 | low | The `occurredAt` rule is implemented three times, and services can't share a helper | W2a ↔ W2c ↔ C10 |

---

## High

### U2-01 · high · Under the serial bridge, a late LWT or a graceful `online: false` clobbers a live controller link

- **Units:**
  - BC owns `controller-status.link.ts`, `controller-state.link.ts`, `services/link.ts` and `jobs/link-watchdog.ts`.
  - BR is the laptop-side serial bridge (AD-17).
  - FW is the ESP32. esp-mqtt reconnects on its own by default.
  - SC's start guard (AD-3).
- **BC's literal reading:** AD-5 says `controller/status` "updates `link`". Retained copies never count as liveness, and STALE comes after 5 s without a fresh state. Nothing says whether a fresh state lifts a link that the last *live* status set `OFFLINE`. A natural `link.ts` treats status as authoritative: `online: false` means `OFFLINE` until the next `online: true`, and freshness only switches between `ONLINE` and `STALE`.
- **BR's and FW's literal reading:**
  - AD-5: every controller link sets a retained LWT and publishes a retained `online: false` before a graceful disconnect. "The serial bridge publishes `controller/status` on the ESP32's behalf."
  - AD-5 also says only one controller link is active at a time, but nothing sequences a switch.
  - **Wi-Fi to serial:** if the bridge connects within the 7.5 s after the ESP32's Wi-Fi died (1.5 × the 5 s keepalive), the broker fires `stl-controller`'s will *after* the bridge's `online: true`.
  - **Serial back to Wi-Fi:** esp-mqtt reconnects by itself as soon as Wi-Fi returns, so for a while two controller links publish. When the operator then stops the bridge, its graceful retained `online: false` lands after the ESP32's `online: true`.
- **Clash:**
  - In both orders, the last word on `controller/status` is `online: false` while fresh states flow.
  - With BC's reading, `link.controller` stays `OFFLINE`, and every `POST /api/overrides` returns `409 CONTROLLER_OFFLINE` until the live link happens to reconnect. That breaks the CAP-5 and CAP-8 demo during the CAP-15 stress test.
  - The retained `online: false` also defeats SC's start guard ("retained status shows `live` with `online: true` **and** a state arrives"). A simulator started during the rehearsal passes the guard and becomes a second controller.
  - The guard can also count a *retained* `controller/state` as "arrives", since AD-3 doesn't say non-retained. A crashed ESP32 whose last retained state is still on the broker then blocks the simulator.
- **Fix:**
  - **AD-5, Client identity and liveness**, add:
    > `services/link.ts` derives `link.<role>` only from fresh, non-retained messages. It is `ONLINE` while a `controller/state` (vision: `vision/heartbeat`) arrived within 5 s (vision: 3 s), and `STALE` after that. It is `OFFLINE` when a non-retained `status` with `online: false` arrived and no fresh message has arrived since. `status` supplies `source` and `bootCount`. It never holds a link `OFFLINE` while fresh messages are arriving.
  - **AD-17, Serial fallback**, add:
    > Switching controller links is break-before-make. The old link publishes `online: false` and disconnects before the new one connects, and the ESP32 keeps its esp-mqtt client stopped while it is in serial mode. Each controller link republishes its retained `online: true` once more, 10 s after connecting, which is past the previous link's 7.5 s will delay.
  - **AD-3, start guard**, replace with:
    > The simulator refuses to start the controller role if a non-retained `controller/state` arrives within 5 s, whatever the retained status says.

### U2-02 · high · The CAP-10 "simulator stands in" fallback means running the simulator next to live roles, and its vision link then drives the real ESP32

- **Units:** SC, or C10's simulator behavior (`emit a speed alert`); FW; VN.
- **C10's literal reading:**
  - AD-17: "Squad B adds it only after CAP-12 and CAP-13 meet their KPIs; until then the simulator's event stands in."
  - `milestones.md`: "If time runs out, the simulator's event stands in."
  - The only way to emit that event is the simulator's REPL, and the simulator always starts both roles (AD-3).
- **AD-3's literal reading:**
  - The simulator refuses to start only when a live **controller** is online.
  - `--force` clears the retained statuses and starts anyway.
  - "M2 go-live means stopping the simulator."
- **Clash:** at the December demo, with Squad B's speed alert not done, there are only two options.
  - **Don't run the simulator.** Then CAP-10 doesn't show, which contradicts AD-17 and the milestone fallback.
  - **Run it with `--force`.** That:
    - clears the live ESP32's retained status;
    - starts a second controller (`stl-sim-controller`), whose state now interleaves with the ESP32's;
    - starts a second vision publisher.

  `vision/heartbeat` and `vision/demand` carry no `source`. The ESP32 consumes both, so the simulator's PCU drives the diorama's green allocation (CAP-14). Its 1 Hz heartbeats also keep the ESP32 in L1 when the lens is covered, which defeats the CAP-16 occlusion demo.

  The same leak happens in weeks 1 to 4 if Squad B tests the vision node against the simulated controller. The simulator's vision role starts as well, and the guard never checks the vision role. "Stop the vision role" then publishes a retained `vision/status` `online: false` over the live node's status.
- **Fix (AD-3, plus one sentence in AD-17):**
  > `npm run sim -- --roles controller|vision|both` (default `both`). The start guard runs per role. The controller role is guarded as in U2-01. The vision role refuses if a non-retained `vision/heartbeat` arrives within 3 s. `--force` bypasses only the guard, and clears only the statuses of the roles it starts.
  >
  > AD-17, Speed alert: the M2 stand-in is `npm run sim -- --emit speed-alert`, a one-shot link (`stl-sim-vision`) that publishes one `vision/speed-alert` and disconnects. It sets no will and publishes no status, heartbeat or demand, so it is exempt from AD-5's status rule. It is the only simulator mode allowed while a live role is online.

### U2-03 · high · `override.mode` during a transition collides with the new auto-release encoding

- **Units:** SC's controller role, FW, W2b's override panel (`components/override/`), and W2a's state history (`signal_state_change`, `/log/states/`).
- **SC's literal reading:** AD-7 rule 4 says "`APPLIED` means the controller accepted the command and it is in effect **or transitioning**". So SC reports `{mode: "CORRIDOR", phase: "NS", commandId: X}` as soon as it accepts X, while EW runs out through yellow and all-red.
- **FW's literal reading:** rule 6 says "`state.override.mode` is what is in effect **now**". Squad A, writing safety firmware, reports the corridor only once NS green is lit. During the roughly 5 s transition it reports `{mode: "NONE", commandId: X}`, because "`commandId` always carries the id of the last command the controller applied".
  - The release has the mirror-image problem. While a released corridor's green runs out, is it `{CORRIDOR, NS, R}` or `{NONE, R}`, where R is the `NONE` command?
  - The spine also never says whether `phase` is absent when `mode` is `NONE`. A firmware that just flips `mode` leaves `"phase": "NS"`. W2a then persists `override_mode = NONE, override_phase = NS`.
- **Clash:**
  - `{mode: NONE, commandId: X}`, with X a `CORRIDOR` command, is now the rule-6 encoding for "corridor ended by link loss" (AD-18). W2b, built and demonstrated against SC in M1, can reasonably show "Corridor ended: controller link lost" when it sees that pair. Against FW in M2, that notice flashes at the start of **every** corridor.
  - W2a's dedup sees a real column change and writes a phantom "release" row before each corridor. The MDRRMO audit trail (1-year retention) then shows releases that never happened.
  - Neither side breaks an AD.
- **Fix (AD-7 rule 6; mirror it in the contract comment):**
  > From the moment the controller applies a command, `state.override` reports that command: `commandId` is its id and `mode` is its mode. This holds during the yellow and all-red that lead into it, and a release reports `{mode: "NONE", commandId: R}` at once while the old green runs out. `phase` is present if and only if `mode` is `CORRIDOR`. There is one exception: a command that ends without a release (the AD-18 corridor timeout, or a conflict fault, see U2-04) reports `mode: "NONE"` with that command's own `commandId`. So `{NONE, X}` with X not a `NONE` command always means "X ended on its own".

  S0 models `override` as a discriminated union on `mode`.

---

## Medium

### U2-04 · medium · A conflict fault during an active override: reported, ended or resumed?

- **Units:** SC (simulated conflict fault and REPL reset), FW, W2b's live view and panel.
- **The spine says:**
  - A fault "outranks overrides", forces `FLASHING_AMBER`, rejects `CORRIDOR` and accepts `FLASHING_AMBER` and `NONE`.
  - After the reset, "the cycle then resumes at an all-red clearance" (AD-3).
  - The spine is silent on an override that was **already** in effect when the fault hit.
- **SC's reading:** a fault cancels everything. SC reports `{NONE, X}` for an active corridor X, and after the reset resumes automatic cycling, even if a `FLASHING_AMBER` override had been accepted during the fault.
- **FW's reading:** the corridor is outranked, not cancelled. FW keeps reporting `{CORRIDOR, NS, X}` with `fault: true`, and resumes the corridor after the reset. It also keeps an accepted `FLASHING_AMBER`, because "`FLASHING_AMBER` holds until a release arrives" (AD-18).
- **Clash:**
  - With FW, the dashboard shows FAULT and "Corridor NS active" at the same time while the LEDs flash amber.
  - After the reset, the corridor the operator believes is gone comes back on FW but not on SC.
  - A `FLASHING_AMBER` accepted during the fault survives the reset on FW and silently vanishes on SC.
  - Every CAP-5 behavior demonstrated against SC in M1 then diverges on the diorama.
- **Fix (AD-7, Conflict fault):**
  > A fault ends a `CORRIDOR` in effect, which is reported per rule 6 as `{mode: "NONE", commandId: X}`. The corridor does not resume after the reset. A `FLASHING_AMBER` override that was in effect, or was accepted during the fault, stays in effect through the reset. After the reset the cycle resumes at an all-red clearance only when no override is in effect.

### U2-05 · medium · The countdown ticks on retained or stale state

- **Units:**
  - C8's countdown component.
  - DS's `useLiveness` and the Staleness convention.
  - W2b's `services/state.ts`, which builds the `state` slice, `receivedAt` included.
- **W2b's reading:** the topic table says `controller/state` "updates the `state` slice", and only liveness ignores retained copies. At backend start, the retained state, which may be hours old if the controller is gone, becomes the slice with `receivedAt` set to now.
- **C8's reading:** the Countdown convention says "counts down locally from `state.remainingS`, starting at the state's `receivedAt`". The Staleness convention says "a stale view keeps its last value and marks it stale; it never blanks it."
- **Clash:**
  - After a backend restart with the controller offline, the dashboard runs a fresh "up to 12 s" countdown, marked stale, from data that may be hours old. It reaches 0, and then nothing is defined: it may go negative or freeze at 0.
  - The same happens when the link drops mid-interval.
  - When the countdown is late by up to one 2 s republish, or a QoS 0 transition is lost, the local count also reaches 0 and then shows 0 or a negative value. Neither convention covers it.
- **Fix (Countdown convention):**
  > The countdown shows only while `useLiveness('controller')` is `LIVE`. When the controller is stale it hides: a timer isn't a value, so keep-last-value doesn't apply. It shows `max(0, remainingS − ⌊(now − receivedAt) / 1000⌋)`.

### U2-06 · medium · The state slice's write policy (dedup or every message) is unset, so countdown resync and power changes can be swallowed

- **Units:** W2b's `services/state.ts` (M1) and C8's countdown and power display (M2).
- **W2b's reading:**
  - AD-8 lets the writer throttle and says nothing about dedup. The controller republishes an identical state every 2 s.
  - W2b, in M1, writes `setSlice` only when the state differs. It reuses the natural comparator, the persisted columns (AD-5), because that is the code its sibling W2a just wrote.
  - The leading-edge throttle "holds further changes for 250 ms" without saying whether the last held change is sent.
- **C8's reading:** "resyncs on every `state`", and `power` is a real change (AD-5 exempts only `remainingS`).
- **Clash:**
  - The dashboard never sees the 2 s resyncs.
  - A `USB` → `BATTERY` switch shows up only at the next phase change, up to 20 s later, or never during a corridor, an L4 or a fault. The CAP-19 proof ("the dashboard shows the same power source") fails while the OLED shows it at once.
  - A change that arrives inside the 250 ms hold may never be sent at all.
- **Fix:**
  - **AD-8 SSE table, `state` row:**
    > `services/state.ts` calls `setSlice('state', …)` for every `controller/state` it receives. It never compares with the previous value.
  - **AD-8, Throttling:**
    > Leading-edge with a trailing flush: send at once, hold changes for 250 ms, then send the latest held value when the hold ends.

### U2-07 · medium · Crop limits written into zod drop the whole breach

- **Units:** S0 (`contracts/src/mqtt/vision-breach.ts`) and W2c (`vision-breach.persist.ts`).
- **S0's reading:** the Structural Seed says "crop optional, at most 204,800 base64 characters", with `crop.mime: "image/jpeg"`. S0 encodes exactly that: `crop: z.object({mime: z.literal('image/jpeg'), data: z.string().max(204800)}).optional()`.
- **W2c's reading:** AD-4 says the receiver parses with the contract schema and that an invalid message "is logged and dropped". AD-11 says an oversized or missing crop is stored without a crop: "a crop problem never loses the event".
- **Clash:**
  - With S0's schema, a breach whose crop is 204,801 characters long, or `image/png`, fails `safeParse` as a whole. AD-4 then drops the event before W2c's crop logic runs.
  - That breaks AD-11's promise and the 100% offline-retention KPI for violation logs.
  - W2c can't fix it without editing S0's file or parsing twice.
- **Fix (AD-11, Transport):**
  > The `vision/breach` schema types `crop` as an optional `{mime: string, data: string}`, with no literal, length or format check. Every crop check (mime `image/jpeg`, at most 204,800 characters, base64 that decodes, an SOF found, a long side of at most 64 px) runs in `vision-breach.persist.ts`. A failed check drops only the crop and logs a warning. The limits appear in the JSON Schema `description`, not as constraints.

### U2-08 · medium · The SOF reader and the JPEG flavor can disagree

- **Units:**
  - SC owns `simulator/assets/placeholder-crop.jpg`.
  - VN encodes the crops.
  - W2c writes the SOF reader that AD-11 now requires.
- **W2c's reading:** "reads width and height from the JPEG's SOF header". W2c looks for `FF C0`, the baseline SOF0, often with `buffer.indexOf`.
- **SC's and VN's reading:** "base64 JPEG". The placeholder comes from whatever tool SC used, and many exporters write progressive JPEG (`FF C2`). VN might use PIL with `progressive=True` or `optimize`. An EXIF APP1 segment can also carry a thumbnail with its own SOF, or bytes that look like `FF C0`.
- **Clash:**
  - Progressive JPEG means "no readable SOF header". Every M1 breach is then stored with `cropUrl: null`, and the CAP-6 demo shows no crops. All three units comply.
  - A naive byte scan can read a thumbnail's 160 px and drop a good crop, or read random bytes as dimensions.
- **Fix (AD-11, Pixel cap):**
  > The backend walks the marker segments from SOI and reads the first SOF marker of any kind (`C0`–`C3`, `C5`–`C7`, `C9`–`CB`, `CD`–`CF`). Crops and the simulator's placeholder are baseline JPEGs with no EXIF.

### U2-09 · medium · `elapsedMs` and `thresholdMs` are integers on one side and floats on the other

- **Units:** VN, which publishes; S0 (`contracts/src/mqtt/vision-speed-alert.ts` and `contracts/src/api/speed-alerts.ts`); C10 (`services/speed-alerts.ts`).
- **The readings:**
  - The MQTT example shows `640` and `800`, but the type isn't stated.
  - `SpeedAlertItem` says `elapsedMs: int`.
  - VN computes `(t2 - t1) * 1000` in Python, which gives `640.37`.
  - S0 might write the MQTT field as `z.number()` and the DTO as `z.number().int()`, as the spine shows.
- **Clash:**
  - If the MQTT schema is `int`, every Python alert is invalid and dropped silently (AD-4).
  - If it is `number`, C10 relays `640.37`, and the dev and test outbound parse (AD-4) throws on `SpeedAlertItem`.
  - Either way, CAP-10 never shows in integration. Nobody broke an AD.
- **Fix (contract comment for `vision/speed-alert`):**
  > `elapsedMs` and `thresholdMs` are integer milliseconds. `thresholdMs` is at least 1, and `0 ≤ elapsedMs < thresholdMs`. The vision node rounds.

  The MQTT and DTO schemas use the same `int` constraints.

### U2-10 · medium · One repository file per table, but several stories query each table

- **Units:**
  - W2a writes `vehicle_count` and `signal_state_change`. If CAP-4 is ticketed apart from CAP-2, which the spine allows ("the grouping is not binding"), it needs its own `vehicle_count` query.
  - W2c owns `breach_event` and `breach_crop`.
  - C9's export reads `breach_event`.
  - RP deletes from four tables.
- **The rule:** AD-14 says a repository is `backend/src/db/repositories/<table>.ts`. Single-owner files mean the first story to touch a table owns its file.
- **Clash:**
  - CAP-4's hourly query and C9's export query must go into a file another story owns, which AD-14 forbids, or into a second file with the same table name, which is impossible.
  - AD-19 names `repositories/retention.ts`, which isn't a table.
  - AD-19's job calls that repository directly, but the dependency diagram allows only `jobs → services → repos`, and "anything not drawn is forbidden".
  - Each story resolves this differently, and two of the resolutions collide on file names.
- **Fix:**
  - **AD-14 table, Repository row:**
    > `backend/src/db/repositories/<table>.<concern>.ts`, one owner per file. Several stories may read one table, each from its own file. Only the CAP that ingests a table inserts into or updates it. `retention.purge.ts` is AD-19's only deleting file.
  - **AD-19:**
    > The job calls `services/retention.ts`.

### U2-11 · medium · Hotspot infra and `MQTT_PASSWORD`: both stories build them, or neither does

- **Units:**
  - S0: AD-14 says S0 "is the only story that creates … `infra/`".
  - C8: the capability map lists "the broker runs in hotspot mode" under CAP-8, in M2.
  - BC and SC each own `src/config.ts`.
- **S0's reading:** the Source tree lists `hotspot.conf`, `acl` and `passwd`, so S0 creates them now, plus `broker.mjs --hotspot`.
- **C8's reading:** the hotspot is M2 work, so C8 creates them in M2. But only S0 may create anything in `infra/`, and S0's files can't be edited.
- **BC's and SC's reading:** AD-15 is "Hotspot mode (M2)", so their M1 `config.ts` doesn't read `MQTT_PASSWORD`. In M2, C8 would have to edit two `config.ts` files owned by other stories.
- **Clash:** the work is either duplicated or nobody may do it. Nobody owns how `passwd` is generated either. Separately, the simulator's two links both read one `MQTT_PASSWORD`, so the `passwd` file must give `stl-sim-controller` and `stl-sim-vision` the same password, and nothing says so.
- **Fix (AD-14, S0 scope; AD-15):**
  > S0 also creates `infra/mosquitto/hotspot.conf`, `infra/mosquitto/acl`, the `--hotspot` flag in `broker.mjs` and `infra/scripts/passwd.mjs`, which writes `passwd` from prompts. BC and SC read `MQTT_PASSWORD` (default empty) from M1 on, and both simulator users share it. No M2 story edits `infra/`.

### U2-12 · medium · The simulator's M2 features have no owner and no extension point

- **Units:** SC ("all of CAP-1 (AD-3)"), C8 and C10.
- **SC's reading:** AD-3 includes "From M2 (CAP-8), it reports `remainingS`, `power` and `bootCount`", plus the M2 REPL controls. SC owns all of AD-3, so it either builds them in M1, which loads a 4-day story, or leaves them because they are M2.
- **C8's and C10's reading:** they add `simulator/src/behaviors/<name>.ts` and one line in `behaviors/index.ts`, the only simulator extension point.
- **Clash:**
  - Adding `remainingS` and `power` changes the payload that `controller-role.ts`, an SC file, builds and publishes.
  - `bootCount` changes SC's connect and LWT setup.
  - "Cut power", "reboot" and "speed alert" are REPL commands in `repl.ts`, also SC's.
  - A behavior file can't do any of this without SC hooks that AD-14 never names. Either SC builds everything, or C8 and C10 edit SC's files.
- **Fix (AD-14 table, plus AD-3):**
  > The simulator core builds two hooks in M1. Through `behaviors/index.ts`, a behavior may add fields to the controller's `state` and `status` payloads (`decorateState`, `decorateStatus`), and may register REPL commands. C8 adds `behaviors/countdown.ts`, `behaviors/power.ts` and `behaviors/reboot.ts`; C10 adds `behaviors/speed-alert.ts`. SC builds none of AD-3's "From M2" items.

### U2-13 · medium · The ESP32 may subscribe to `vision/#` and receive 200 KB breaches

- **Units:** FW, with W2c and VN as the producers of `vision/breach`, and the AD-15 ACL.
- **FW's reading:**
  - AD-18 says the controller "consumes only `vision/heartbeat`, `vision/demand` and `controller/override/cmd`". "Consumes" isn't "subscribes", so FW subscribes to `stl/int-01/vision/#` and filters in code. That is a common esp-mqtt pattern.
  - The ACL explicitly allows "every user may read `stl/#`".
- **AD-5's reading:** "Every payload the ESP32 publishes **or receives** is ≤ 512 bytes."
- **Clash:** each breach, up to about 200 KB, reaches the ESP32 in roughly 200 esp-mqtt data chunks over Wi-Fi, on the MCU in the safety path. That costs CPU and airtime in the middle of the <200 ms frame-to-LED path. Nothing stops it, and AD-5's receive limit can't be enforced as written.
- **Fix (AD-15, ACL):**
  > Controller users read only `vision/heartbeat`, `vision/demand` and `controller/override/cmd`. `stl-sim-controller` also reads `controller/status` and `controller/state`, for its start guard, and `stl-sim-vision` reads `vision/heartbeat`. `stl-backend` reads `stl/#`. The ESP32 subscribes to exact topics, never wildcards.

  This also makes AD-18 enforceable by the broker.

### U2-14 · medium · QoS and retain never reach Squads A and B

- **Units:** S0's `npm run contracts:schema`, VN (paho), FW (esp-mqtt) and BR.
- **The rule:** AD-5 says QoS and retain "come only from the topic table in `contracts/src/mqtt/topics.ts`. No QoS or retain literal appears anywhere else." But the A/B artifact is `contracts/schema/*.json`: payload schemas only, made with `z.toJSONSchema`. Python and C++ never see `topics.ts`.
- **VN's reading:** paho's `publish()` defaults to `qos=0, retain=False`. Nothing in VN's artifact says otherwise.
- **FW's reading:** the same for `retain` on `controller/state` and `controller/status`, unless someone transcribes the table from the spine's prose.
- **Clash:**
  - `vision/counts` and `vision/breach` published at QoS 0 are not queued for the backend's `clean: false` session, because delivery QoS is the lower of publish and subscribe QoS. That breaks the offline-retention KPI that AD-5 says this carries.
  - An unretained `controller/status` defeats SC's start guard.
  - A speed alert published at QoS 1 can be redelivered and shown twice.
- **Fix (AD-4):**
  > `npm run contracts:schema` also writes `contracts/schema/topics.json` from `topics.ts`. For each topic it lists the pattern, QoS, retain flag, publisher role and payload schema file. Squads A and B take QoS and retain only from that file.

### U2-15 · medium · Foreign keys are unspecified

- **Units:** S0's initial migration, W2a (`controller-state.persist.ts`), RP (purge) and BC (`test/reset-db.ts`).
- **S0's reading:** the ERD draws `breach_event ||--o| breach_crop`. A careful S0 adds foreign keys for integrity, for example `breach_crop.breach_event_id → breach_event.id` (RESTRICT by default) and `signal_state_change.override_command_id → override_command.command_id`.
- **The clashes:**
  - **W2a:** the persist handler inserts `override_command_id` from the controller's state. In dev, someone recreates `stl` while the simulator keeps running. Its retained state still carries a `commandId` that the fresh `override_command` table doesn't have, so every insert fails the foreign key and is swallowed (handlers catch per message). The state history then goes silent until the next override.
  - **RP:** `override_command` is purged by `requested_at` and `signal_state_change` by `received_at`. A state row received after its command was requested still references a command row that is already gone, so the purge's `DELETE` on `override_command` fails.
  - **BC:** `reset-db.ts` using `TRUNCATE` fails on any table referenced by a foreign key, even an empty one (MySQL error 1701).
- **Fix (AD-10, Data model):**
  > The only foreign key is `breach_crop.breach_event_id → breach_event.id ON DELETE CASCADE`. `signal_state_change.override_command_id` is a plain `CHAR(36)`. `test/reset-db.ts` deletes child tables first.

---

## Low

### U2-16 · low · `LiveProvider`'s listener set and where the speed alert mounts

- **The clash:**
  - DS (M1) can register `addEventListener` for the six M1 event names it uses rather than for every key of `streamSchemas`. Then `speedAlert` frames, which S0 now defines, are silently ignored, and C10 must edit DS's `LiveProvider`.
  - "A transient alert" says nothing about where it shows. Mounting it in the root layout (DS's file) has no extension point. Mounting it on `/` means alerts vanish while the operator is on `/breaches/`.
- **Fix:**
  - **AD-8:**
    > `LiveProvider` registers one listener per key of `streamSchemas`.
  - **Speed alert convention:**
    > It shows on `/` only, from a component in `components/speed-alert/` mounted with one line in the page.

### U2-17 · low · M2 dashboard mount points; M1 stories may pre-build M2 fields

- **The clash:**
  - The `state` slice carries `remainingS` and `power` from S0 on, so W2b (M1) may render a countdown and a power badge "because the data is there". C8 (M2) then builds them again: both build.
  - The `link` slice's `bootCount` most naturally shows in the header, which the shell owns and which has no extension point.
- **Fix (Countdown convention and AD-14):**
  > M1 stories don't render `remainingS`, `power`, `bootCount` or `speedAlert`. C8 adds `components/controller/countdown.tsx`, `power-source.tsx` and `boot-count.tsx`, mounted on `/` with one line each. The header stays as the shell built it.

### U2-18 · low · `remainingS` semantics in the simulator, rounding, and the yellow into a corridor

- **The simulator's two readings:**
  - The contract: in L1 and L2 green, `remainingS` is the time to max green (20 s).
  - AD-3: the simulator's L1 and L2 green is a fixed 10 s.
  - SC can report `20 − elapsed`, which shows "up to 20 s" and then turns yellow at 10 s, or `10 − elapsed`, which breaks the letter of the contract.
- **Rounding:** "Whole seconds" doesn't say floor or ceiling. FW using `millis()/1000` floors, so a 3 s yellow is published as `2` a few ms in. SC may round up.
- **Corridor transition:** "absent when … `CORRIDOR`" leaves the yellow and all-red that lead into a corridor ambiguous.
- **Fix (contract comment):**
  > `remainingS` is the ceiling of the milliseconds left, divided by 1000, at publish time. In an L1 or L2 green it is the time until the latest moment this green can end: max green on the ESP32, the fixed 10 s on the simulator. It is present for every yellow and all-red, including those leading into or out of an override.

### U2-19 · low · `bootCount` under the serial bridge and in the simulator's "reboot"

- **Serial bridge:** in serial mode, BR publishes `controller/status` "on the ESP32's behalf", but it can't know `bootCount` unless the ESP32 sends it over serial (framing is deferred). The CAP-19 dashboard proof then reads `null` during the fallback.
- **Simulator reboot:** "reboot the controller role (`bootCount` + 1)" doesn't say whether SC:
  - drops its link, gracefully or not;
  - forgets the override, since `commandId` is "absent only before the first command since boot";
  - keeps a latched fault, which survives a reboot on the ESP32;
  - persists the counter across simulator runs.

  Each choice changes what W2b, BC and C8 see.
- **Fix:**
  - **AD-17:**
    > The ESP32 sends its `bootCount` to the bridge on connect, and the bridge's `status` carries it.
  - **AD-3:**
    > A simulated reboot drops the link without a graceful `online: false`, reconnects with `bootCount + 1`, forgets the override and keeps a latched fault. `bootCount` starts at 0 for each simulator process.

### U2-20 · low · An auto-released corridor never reaches the override log

- **The clash:**
  - CAP-5's success criterion: "Activating and releasing it … writes a timestamped override log entry."
  - The AD-18 auto-release changes no `override_command` row, because X stays `APPLIED`. Only W2a's state history records it.
  - W2b may think its `/log/overrides/` must show the release. It has no row to show and no rule to synthesize one.
- **Fix (AD-7):**
  > The override log records commands. A command that ends on its own appears only in the state history, as a `{NONE, X}` row (U2-03).

### U2-21 · low · Ack `reason`: enum or free string

- **The clash:**
  - The conventions list the rejection reasons `CONTROLLER_OFFLINE` and `CONFLICT_FAULT`, while `OverrideCommand.reason` is `string | null`.
  - If S0 types the ack's `reason` as `z.enum(['CONFLICT_FAULT'])`, a FW ack with any other code (for example `INVALID_PHASE` from a defensive parser) is dropped, and the command becomes `TIMEOUT` instead of `REJECTED`.
  - If S0 types it as a string, `visuals.ts` has no label for the new code.
- **Fix:**
  > Ack `reason` matches `^[A-Z][A-Z0-9_]{0,31}$`. Known codes get labels in `visuals.ts`, and unknown codes show raw.

### U2-22 · low · The CAP-9 export route

- **Path collision:** `GET /api/breaches/export` naturally lives in W2c's `routes/breaches.ts`, which C9 can't edit. A new route file is registered alphabetically, so the order against any `/api/breaches/:id` route decides which handler matches.
- **Conventions:** the REST convention ("JSON under `/api`", "a list is `Page<T>`") forbids a CSV body and an unpaged list.
- **Tier 1 columns:** `approach` and the publisher `id` are not on the Tier 1 list in `privacy-compliance.md`, but CAP-6 shows `approach`.
- **Fix (pin now, in Deferred):**
  > `GET /api/exports/breaches.csv`, in `routes/exports.ts`, is the one non-JSON, unpaged route. Its columns are `occurredAt`, `receivedAt`, `approach`, `vehicleClass`, `centroidX` and `centroidY`. An exported CSV is outside AD-19, which the operator accepts.

### U2-23 · low · Purge vs list cursors and caching

- **Cursors:** the cursor is opaque. W2c could encode the last item's `event_id` and look up its sort key, which is a row reference. After RP deletes that row, page 2 returns 400 ("undecodable cursor") or nothing.
- **Cache:** the crop route has no cache rule. Express sets an `ETag`, so Chromium keeps the crop bytes in its disk cache, on the laptop, beyond the 21 days.
- **Order:** the list orders by `received_at` (AD-6), while the purge deletes by `occurred_at`. That is harmless, but worth a sentence.
- **Fix:**
  > A cursor encodes the last item's sort-key values, never a row reference. The crop route sends `Cache-Control: no-store`.

### U2-24 · low · ACL file mechanics

- **`topic` vs `pattern`:** in a Mosquitto `acl_file`, `topic` lines before the first `user` line apply only to **anonymous** clients. "Every user may read `stl/#`" must therefore be a `pattern read stl/#` line, or one line per user. With hotspot `allow_anonymous false`, a top-of-file `topic read stl/#` grants nothing.
- **Hard-coded `iid`:** an ACL written with `stl/int-01/…` silently breaks for any other `INTERSECTION_ID`.
- **Silent drops:** the broker drops denied publishes without telling the publisher. At QoS 1 the publisher still gets a PUBACK.
- **`--force`:** if SC clears both retained statuses from one link, the clear of the other role's status is silently denied.
- **Fix (AD-15):**
  > The ACL uses `pattern` lines and `stl/+/…` paths. Each simulator link clears only its own role's status. `docs/setup.md` includes a `mosquitto_sub -u … -t …` check per user.

### U2-25 · low · After S0, contract edits have no owner path

- **The clash:**
  - AD-4 allows optional fields and new topics after the lock, but every `contracts/` file is S0's, and AD-14 offers no edit path for them.
  - The fixes in this review (U2-03, U2-09, U2-19) and any M2 field have nowhere to land.
- **Fix (AD-4, mirroring AD-13's dependency rule):**
  > After S0, a contract edit lands on `main` as a one-commit chore. It regenerates `contracts/schema/` and names the squads that signed off.

### U2-26 · low · The `occurredAt` rule is implemented three times

- **The clash:**
  - AD-6's rule (`ts`, otherwise `receivedAt`, with the 24 h fallback and a warning) now has three implementers: `services/counts.ts`, `services/breaches.ts` and `services/speed-alerts.ts`.
  - The dependency diagram forbids service-to-service imports other than `getLink()`, so they can't share a helper.
  - Each story writes its own version. One uses `>=`, one leaves out the warning, and one takes the absolute difference.
- **Fix (dependency rules):**
  > `src/services/occurred-at.ts`, owned by BC, joins `config.ts` and `errors.ts` as an import every backend module may use.

---

## Rules that can't be enforced as written

1. **AD-5, "Only one controller link is active at a time."** Nothing enforces it:
   - The broker and the ACL can't.
   - The simulator's guard runs only at simulator start.
   - esp-mqtt reconnects while the serial bridge runs.

   U2-01's break-before-make rule and U2-02's per-role guard make it procedural and checkable. A backend warning when two `source` values interleave within 5 s would make it observable.
2. **AD-5, "No QoS or retain literal appears anywhere else."** This is unenforceable for Python and C++, which never see `topics.ts` (U2-14).
3. **AD-19, Backups.** There is no script and no check. The Deferred section says "take a `mysqldump` before going to the venue" without the flag. Add a root `db:backup` script that always passes `--ignore-table=stl.breach_crop`.
4. **AD-11, "already anonymized … scaled to at most 64 px … then blurred."** The backend can check only size. Blur is verified only by CAP-13's human acceptance test. Say so: the backend gate is a size gate, not an anonymization check.
5. **AD-15, "The ESP32 and the vision node keep theirs in their own config, outside git."** Nothing backs it. S0's `.gitignore` should name the files, for example `firmware/include/secrets.h` and `edge_vision/.env`.
6. **AD-17, "Squad B adds it only after CAP-12 and CAP-13 meet their KPIs."** This is governance, not architecture, and its fallback is unbuildable as written (U2-02).
7. **The firmware-side timing rules** have no shared check:
   - the 1 s ack;
   - the at-least-every-2-s republish;
   - "a change in `remainingS` alone is not a change";
   - the 60 s corridor hold;
   - the ≤ 512 B limit;
   - retain on `status` and `state`.

   A small `npm run contracts:probe` (in `infra/scripts/`, owned by S0) could subscribe to `stl/#` and report cadence, size, QoS and retain violations per topic. It would give Squads A and B a self-test and the week-5 integration a gate.

## Checked: no hole found

| Seam | Why it holds |
| --- | --- |
| Additive v1 fields against old validators (S0 ↔ VN, FW) | `z.object` plus no `additionalProperties: false`, so older Python and C++ validators accept the new optional fields. AD-4's new-topic rule bumps no existing `v`. |
| Persist dedup against `remainingS` and `power` (W2a ↔ SC, FW) | The comparison columns are fixed by the ERD and named in AD-5. No row per second, and no new columns. |
| Auto-release against the resolve handlers (W2b ↔ FW) | A `{NONE, X}` state hits a row X that is already `APPLIED`, so nothing happens. If X was in `TIMEOUT` because the ack was lost before the drop, it correctly becomes `APPLIED`. |
| 512 B budget with the new fields | The worst-case `controller/state` (all long enum values, a corridor, `remainingS`, `power`, `ts`) is about 260 B. |
| ACL write set against AD-18 and the topic table | `stl-backend` writes only `cmd`. The controller and vision users' write sets match the Publisher column. The serial bridge is covered as a controller user. |
| `speedAlert` across layers (VN ↔ C10 ↔ DS) | QoS 0, not retained, never persisted, no REST. It has a sole SSE writer, an AD-6 time rule, and no upsert needed. |
| AD-19 against AD-11 reads (RP ↔ W2c) | There is one deleter. `vehicle_count` is never deleted. "A purged crop lists as `cropUrl: null` and 404s" matches AD-11's bad-crop semantics, so a `LEFT JOIN` list needs no change. |
| Fault reset ownership (DS ↔ BC ↔ W2b) | No mode, route or topic clears it, and the dashboard has no reset control. Nothing can build a second reset path. |

## Minimal patch set, in priority order

1. **AD-5, AD-17 and AD-3, two publishers on one role:** derive the link from fresh messages; switch serial links break-before-make, with a 10 s status re-assert; a per-role guard on non-retained messages; `--roles`; and a one-shot `--emit speed-alert` (U2-01, U2-02).
2. **AD-7, rule 6 and the conflict fault:** the override is reported from apply through its transition; `phase` is present only with `CORRIDOR`; `{NONE, X}` means "ended on its own"; a fault ends a corridor, and a `FLASHING_AMBER` override survives the reset (U2-03, U2-04, U2-20).
3. **AD-14 ownership, before the M1 tickets are cut:**
   - S0 creates the hotspot `infra/` files, and BC and SC read `MQTT_PASSWORD` (U2-11).
   - The simulator gets hooks for state and status fields and for REPL commands (U2-12).
   - Repositories are named `<table>.<concern>.ts`, and the purge gets a service (U2-10).
   - Contract edits land as chores (U2-25).
   - The `occurredAt` helper is importable everywhere (U2-26).
4. **AD-8 and the Countdown convention:** `state.ts` writes on every message; the throttle flushes on the trailing edge; the countdown shows only while `LIVE` and clamps at 0 (U2-05, U2-06).
5. **AD-11, crops:** limits leave the zod schema; the SOF reader walks markers and accepts any SOFn; crops are baseline (U2-07, U2-08).
6. **AD-4 and AD-15, toward Squads A and B:** generate `topics.json`; the ACL limits controller reads and uses `pattern` and `stl/+/`; the speed-alert fields are integers (U2-13, U2-14, U2-24, U2-09).
7. **AD-10:** a single cascading foreign key (U2-15). Then the lows.
