---
id: SPEC-smart-traffic-light
companions:
  - ../architecture-smart-traffic-light/architecture-smart-traffic-light.md
  - ../ux-smart-traffic-light/DESIGN.md
  - ../ux-smart-traffic-light/EXPERIENCE.md
  - milestones.md
  - stack.md
  - degradation-levels.md
  - hardware.md
  - kpis.md
  - privacy-compliance.md
  - risks.md
  - roadmap.md
  - users.md
  - glossary.md
sources:
  - ../../../docs/brief.md
  - ../../../docs/addendum.md
  - ../../../docs/Midterm-Application-Development.pdf
  - ../../../docs/SquadA_02_Initial_List_of_Materials.docx
  - ../../../docs/SquadA_03_Prototype_Design.docx
  - ../../../docs/Catarman Signal Diorama (Copy).html
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Catarman SMART Traffic Light

## Why

Catarman, Northern Samar has no automated traffic signals. POSO enforcers direct traffic by hand at peak hours, junctions go uncontrolled off-peak, and enforcers must take shelter during monsoon floods and typhoons, which is exactly when MDRRMO convoys need clear junctions. Commercial DPWH signals cost ₱3M–₱6M per junction and cannot be serviced locally. They are tuned for metro car traffic rather than tricycle and motorcycle mixes, and they go dark when NORSAMELCO/NGCP power trips or storm-time cell outages hit. This project builds a low-cost, edge-only signal that adapts green time to mixed-traffic demand and keeps controlling the junction through camera loss, sensor loss, flooding and brownouts without grid power or internet. It is a vision to realize under a course mandate, with two forcing dates: the Application Development & Emerging Technologies midterm (Oct 26, 2026) and the December 2026 pitch to judges from MDRRMO, DICT, EE faculty and university ICT.

## Capabilities

Tag: `[milestone · owner]`. M1 = Midterm, M2 = Final; matrix in `milestones.md`.

- **CAP-1** Simulated telemetry `[M1 · Squad C]`
  - **intent:** The dashboard and backend run end-to-end on simulated intersection telemetry while the vision node and ESP32 are absent.
  - **success:** With neither the vision node nor the ESP32 running, every M1 view (CAP-3 to CAP-6) populates and updates; an operator can drive the simulated intersection into each degradation level L1–L4 and generate breach events on demand.
- **CAP-2** Local telemetry history `[M1 · Squad C]`
  - **intent:** Vehicle counts, signal-state changes, breach events and override actions are stored on the edge laptop and stay queryable as history.
  - **success:** After a backend and database restart, previously recorded counts, breach events and override entries are still returned; recording and querying work with internet disabled.
- **CAP-3** Live intersection status `[M1 · Squad C]`
  - **intent:** An operator sees the intersection's current state: signal phase per approach (NS/EW), degradation level, per-class vehicle counts and PCU score per approach, and flood-sensor state.
  - **success:** Each state change from the telemetry source appears within 1 s, without a page reload; L1–L4 and active overrides are visually distinct.
- **CAP-4** Hourly traffic peaks `[M1 · Squad C]`
  - **intent:** An operator can see hourly vehicle throughput to spot peak congestion.
  - **success:** A bar chart shows per-hour counts whose totals match the stored records for the same hours.
- **CAP-5** MDRRMO emergency override `[M1 · Squad C]`
  - **intent:** An MDRRMO operator can manually force Flashing Amber or a continuous-green evacuation corridor on a chosen phase (NS or EW), and release control back to automatic operation.
  - **success:** Each override asks for confirmation before activating. Activating and releasing it changes the reported intersection state and writes a timestamped override log entry. It needs no login, because only the edge laptop can reach the backend (Constraints). In M1 it runs against the simulator; in M2 the ESP32 obeys it (CAP-8).
- **CAP-6** Red-light breach log `[M1 · Squad C]`
  - **intent:** An operator can review red-light breach events: timestamp, vehicle class, approach and anonymized crop.
  - **success:** Each breach event received is listed with those fields and persisted; no identifying data (OCR text, faces, body numbers) is stored or shown. M1 crops may be placeholders.
- **CAP-7** Live inference video `[M2 · Squad C, with B]`
  - **intent:** An operator sees the live camera feed with the vision node's detections overlaid.
  - **success:** During the demo, the dashboard on the venue Smart TV shows the vision node's annotated frames from the USB-tethered phone camera.
- **CAP-8** Live telemetry integration `[M2 · Squad C, with A and B]`
  - **intent:** The dashboard and backend run on live telemetry from the vision node and ESP32 instead of the simulator, and dashboard overrides reach the ESP32.
  - **success:** On the running diorama, physical phase and level changes, the phase countdown and the power source appear on the dashboard, and each CAP-5 override changes the diorama's signal LEDs.
- **CAP-9** Violation CSV export `[M2 · Squad C]`
  - **intent:** An operator can export anonymized violation records as CSV, standing in for municipal database integration.
  - **success:** The export contains every stored breach event and only Tier 1 fields (`privacy-compliance.md`).
- **CAP-10** Speed alert mockup `[M2 · Squad C, with B]`
  - **intent:** The dashboard shows a crossing-threshold speed alert as a mockup in place of calibrated speed measurement.
  - **success:** A vision-node crossing-threshold event (a vehicle crossing two virtual lines on one approach faster than a set time) raises a visible speed alert on the dashboard, labeled as an uncalibrated mockup. The simulator emits the same event.
- **CAP-11** Dashboard polish `[M2 · Squad C]`
  - **intent:** The dashboard presents a polished, modern visual design with transitions and animations, built for full-screen display (`DESIGN.md`, `EXPERIENCE.md` Motion).
  - **success:** Phase, level, override and new-breach changes animate rather than snap; the dashboard runs full-screen in Chromium on the venue Smart TV.
- **CAP-12** Mixed-traffic profiling `[M2 · Squad B]`
  - **intent:** The vision node detects, classifies and counts mixed vehicles crossing each approach's ROI stop line and computes a PCU-weighted congestion score per approach.
  - **success:** ≥85% classification accuracy across tricycles, motorcycles, passenger cars and utility vans on scale test footage; ≥15 FPS sustained on the laptop; PCU weighting honors 1 car ≈ 2 tricycles.
- **CAP-13** Red-light breach detection `[M2 · Squad B]`
  - **intent:** The vision node detects vehicles crossing a virtual stop line during red and emits an anonymized breach event.
  - **success:** Each staged red-phase breach on the diorama yields one event carrying timestamp, vehicle class, centroid and anonymized bounding-box crop; no OCR, text detection or face processing runs, and a printed body number on a toy tricycle is unreadable in the stored crop (`privacy-compliance.md`).
- **CAP-14** Dynamic green allocation `[M2 · Squads A and B]`
  - **intent:** Green phases extend or end early according to each approach's weighted PCU demand, removing "ghost red" waits at empty cross-streets.
  - **success:** On the diorama, the heavier-PCU approach receives longer green and an empty approach's green ends early, within the min/max green limits (`degradation-levels.md`).
- **CAP-15** Offline telemetry bridge `[M2 · Squads A and B]`
  - **intent:** The vision node and ESP32 exchange telemetry and commands over the local network without internet, with a wired fallback link.
  - **success:** <200 ms frame-to-LED actuation; the loop keeps working with internet severed (Airplane Mode test); the USB Serial fallback can be switched in within 30 s.
- **CAP-16** Optical occlusion handover `[M2 · Squads A and B]`
  - **intent:** When the camera is occluded (vision heartbeat lost or frame confidence low), control passes automatically to stop-line presence sensing with gap-out actuation.
  - **success:** Covering the lens moves control to Level 2 within 3 s (3 missed heartbeats); green holds while a lead vehicle is present, gaps out after 3 s of vacancy, and never exceeds max green. Uncovering it returns control to Level 1 after 5 s of healthy heartbeats, at an all-red clearance.
- **CAP-17** Autonomous ESP32 state machine `[M2 · Squad A]`
  - **intent:** The ESP32 runs signal phasing on its own, falls back to a fixed timing cycle when external sensors fail, and shows its status on the local OLED.
  - **success:** Disconnecting sensors mid-cycle drops to Level 3 without freeze or reset, and reconnecting them climbs back after 5 s; signaling continues with the laptop, broker or dashboard down; every phase change passes through an all-red clearance; a conflict-monitor fault forces Flashing Amber until the controller-box reset button is pressed, even across a reboot; the OLED shows level, phase, countdown and power source.
- **CAP-18** Flood emergency mode `[M2 · Squad A]`
  - **intent:** Sustained curb water immersion switches the intersection to Flashing Amber.
  - **success:** Immersion held past the 5 s debounce triggers Level 4 within 5–10 s of submersion; splashes shorter than the debounce do not; after 30 s dry, normal cycling resumes at an all-red clearance.
- **CAP-19** Brownout failover `[M2 · Squad A]`
  - **intent:** The signal controller keeps running uninterrupted when primary power is cut.
  - **success:** Cutting primary 5 V causes no ESP32 reboot (0 ms interruption, boot counter unchanged) and the OLED's power source switches to battery, with bus voltage before and after the diode junction shown live on a multimeter.
- **CAP-20** 4-way scale diorama `[M2 · Squads A and C]`
  - **intent:** A foam-board 4-way scale diorama with LED signal heads, vehicle approaches, a curb water sensor and stop-line presence sensing shows the system working physically.
  - **success:** After transport to the venue, the diorama runs the full December demo: L1–L4 transitions and the power-cut failover.

## Constraints

- **Architecture:** the spine (`../architecture-smart-traffic-light/architecture-smart-traffic-light.md`) binds integration, the MQTT contract v1 (locked Oct 22, 2026), repository layout and stack versions. Tickets cite its AD-1 to AD-19.
- **Stack (course mandate):** Next.js + Tailwind CSS frontend; Node.js + Express + MySQL backend. This supersedes the brief's HTML/JS dashboard, Python edge server and SQLite/CSV storage. See `stack.md`.
- The vision node stays Python + YOLOv8 nano, messaging stays local Mosquitto MQTT, and the firmware stays C++ on the ESP32.
- The runtime is local only: localhost plus a private LAN/hotspot, with no cloud services and no internet dependency. The subnet is air-gapped, so there is no remote override.
- **Access:** overrides come only from the edge laptop. The backend accepts local connections only and there is no operator login; the broker gets a password and an ACL before it listens on the hotspot (spine AD-15). A login is added only if the backend must accept network connections.
- The ESP32 is the autonomous signal master. Losing the vision node, broker, backend or dashboard lowers the degradation level but never stops signaling; the dashboard and backend stay out of the safety path.
- **Signal safety:** every phase change passes through an all-red clearance, and a conflict monitor forces Flashing Amber on a conflict fault. A conflict fault is not a degradation level, and it outranks manual overrides.
- Degradation levels, thresholds, the conflict fault and override priority follow `degradation-levels.md`.
- **Vehicle classes:** car, tricycle, motorcycle (habal-habal included), jeepney and utility van. Classes and PCU weights can be changed without code changes; values are in `kpis.md`.
- **Privacy Tier 1 (RA 10173):** store and display only timestamps, vehicle class, centroid, anonymized crops and aggregates. No OCR, text detection, face identification or registry cross-reference. Crops are kept 21 days; anonymization and retention are in `privacy-compliance.md`.
- One student laptop (Linux or Windows 10/11) hosts the vision node, broker, dashboard, backend and database.
- Hardware comes only from existing kits plus members' own laptops, phones and tools; no microcontrollers or sensors are bought, and the Oct 20, 2026 hardware freeze has passed. Total cash is capped at ₱1,000 pooled across 10 members, for diorama supplies, wiring, consumables such as batteries, small passive power parts and mounts. See `hardware.md`.
- The ESP32 is the only runtime MCU; the Arduino UNO R3 is a benchtop test harness, with no inter-MCU bus.
- Camera input is a smartphone over wired USB tethering; no ESP32-CAM, no Wi-Fi video.
- The dashboard targets Chromium, full-screen on the venue Smart TV. Its look follows `DESIGN.md` and its screens, states and behavior follow `EXPERIENCE.md` (UX companions, Signal Hardware direction).
- The code lives in a single monorepo with isolated directories; M1 is submitted as that repository.
- Squad C's 3 developers build the dashboard and backend in parallel, one `bmad-build` story per session, so stories must be buildable side by side without blocking each other.
- **Deadlines:** M1 on Oct 26, 2026; M2 in the second week of December 2026.

## Non-goals

- Midterm items 2–5 as deliverables (materials list, labeled prototype drawing, implementation testing plan, member contribution report). Squad A's items 2 and 3 serve this spec only as fact sources.
- Live vision node or ESP32 telemetry in M1.
- TODA driver or franchise identification, OCR, and municipal licensing-registry matching (Phase 2, gated on a PIA).
- ESP32-CAM or any wireless video ingestion.
- Radar or calibrated speed measurement; CAP-10 is a mockup.
- Cloud hosting, cloud video streaming, AWS/Firebase backends.
- Direct municipal database API integration; CAP-9's CSV export stands in.
- Solar charging hardware.
- On-stage fan/wind tests and live jumper-wire pulls.
- Automatic evacuation-corridor greening; corridors come only from a manual MDRRMO override.
- Phase 2 and long-term roadmap items (`roadmap.md`).

## Success signal

- **M1 (Oct 26):** From the repository, the Next.js dashboard and the Express/MySQL backend start locally on simulated telemetry. They show live status, hourly peaks, a working MDRRMO override and the breach log, and history survives a restart.
- **M2 (December pitch):** With internet off, the diorama runs on live vision and ESP32 telemetry through camera occlusion (L2), sensor disconnect (L3), flood immersion (L4) and a primary-power cut without a controller reboot. The Smart TV dashboard shows each transition live, and an MDRRMO override from the dashboard changes the diorama's LEDs.

## Assumptions

- Manual MDRRMO overrides outrank every automatic level, including L4 Flashing Amber. The decided conflict-fault rule leaves this intact, because a conflict fault is not a level (`degradation-levels.md`).
- Evacuation corridors are manual-only. The brief's MVP Scope ("reserved exclusively for manual MDRRMO dashboard override") governs over its MDRRMO goal of "automated clearing", per your rule that MVP Scope is the Final scope.
- MySQL replaces SQLite/CSV for storage, including for the offline-retention KPI; CSV survives only as an export format (CAP-9).
- One laptop sustains YOLOv8n at ≥15 FPS alongside Mosquitto, Next.js, Express and MySQL without throttling through the 20-minute presentation. The brief assumed this with a lighter stack.
- A USB-tethered phone camera (DroidCam/scrcpy) gives stable 1080p at <30 ms.
- "Second week of December 2026" is the brief's mid-December event.

## Open Questions

Tag: `[needed before · who answers]`.

- `[M2 · Squad B]` What published PCU values apply to motorcycle, jeepney and utility van (DPWH D.O. 22, 2013, or another source)? The placeholders in `kpis.md` stand until then; toy footage cannot calibrate them.
- `[M2 · Squad C]` Where does CAP-7's live video sit on the live status screen, which must not scroll? `EXPERIENCE.md` leaves it unplaced.
- `[M2 · team]` Does the venue Smart TV have a working HDMI input? A member tests it with the laptop, the cable and any USB-C adapter by mid-November, before the week-5 stress tests. If it fails, the fallback is screen mirroring (`milestones.md`).
