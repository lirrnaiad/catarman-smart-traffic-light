# Milestones

## M1: Midterm prototype

- **Due:** Oct 26, 2026. Course: Application Development & Emerging Technologies, midterm item 1. Submitted via the repository.
- **Scope:** web dashboard plus backend only (CAP-1 to CAP-6), running on simulated telemetry. The vision node, ESP32 and diorama are not required.
- **Course wording:** "Develop initial prototype using NextJS and Tailwind CSS for Frontend; while NodeJS, ExpressJS and MySQL workbench for Backend … based on your assigned project concept … you can enhance your project."
- **Out of this spec:** midterm items 2–5 are hardcopy deliverables. They are an initial materials list (sensors, actuators, microcontrollers beyond the UNO R3/R4), an initial labeled prototype design (3D model or drawing), an implementation testing plan, and the project leader's member role and contribution report with photos.
- M1 falls 4 days after spec creation (2026-10-22), so M1 slices must be thin.

## M2: Final submission

- **Due:** second week of December 2026 (the brief's mid-December event, at the end of an 8-week sprint).
- **Scope:** the brief's MVP Scope in full, plus a polished dashboard with modern visuals and transitions/animations. That means CAP-7 to CAP-20, with CAP-1 to CAP-6 now also running on live telemetry through CAP-8.
- **Pitch format:** 20 minutes in total, a 10-minute presentation then 10 minutes of Q&A. The judges are the MDRRMO Head, an EE Professor, a DICT Representative and the University ICT Director. The dashboard shows on the venue Smart TV over HDMI.
- **Planned stress tests (weeks 5–6):** Airplane Mode internet sever, camera lens occlusion, gutter flood water immersion.
- **Excluded from the stage:** handheld fan or wind simulation (erratic vibration), live jumper-wire yanking (breadboard rail stability).

## Capability matrix

| CAP | Capability | Milestone | Owner |
|---|---|---|---|
| CAP-1 | Simulated telemetry | M1 | C |
| CAP-2 | Local telemetry history | M1 | C |
| CAP-3 | Live intersection status | M1 | C |
| CAP-4 | Hourly traffic peaks | M1 | C |
| CAP-5 | MDRRMO emergency override | M1 | C |
| CAP-6 | Red-light breach log | M1 | C |
| CAP-7 | Live inference video | M2 | C (with B) |
| CAP-8 | Live telemetry integration | M2 | C (with A, B) |
| CAP-9 | Violation CSV export | M2 | C |
| CAP-10 | Speed alert mockup | M2 | C |
| CAP-11 | Dashboard polish | M2 | C |
| CAP-12 | Mixed-traffic profiling | M2 | B |
| CAP-13 | Red-light breach detection | M2 | B |
| CAP-14 | Dynamic green allocation | M2 | A, B |
| CAP-15 | Offline telemetry bridge | M2 | A, B |
| CAP-16 | Optical occlusion handover | M2 | A, B |
| CAP-17 | Autonomous ESP32 state machine | M2 | A |
| CAP-18 | Flood emergency mode | M2 | A |
| CAP-19 | Brownout failover | M2 | A |
| CAP-20 | 4-way scale diorama | M2 | A, C |

## Team

10 fourth-year IT undergraduates in 3 squads:

- **Squad A (3):** ESP32 firmware, sensors, power circuit, diorama (with C).
- **Squad B (4):** Python YOLOv8 vision node.
- **Squad C (3), our squad:** dashboard and backend. The three build in parallel with `bmad-build`, one story per session. Squad C also co-builds the diorama.

## Brief timeline (M2 track)

1. **Hardware freeze, Oct 20, 2026 (passed):** kit audit plus one consolidated order of ≤₱350 for jumper wires and foam board.
2. **Week 1:** initialize the GitHub monorepo and lock the JSON MQTT schema between Squads A, B and C.
3. **Weeks 1–2:** ESP32 default cycles, 5 s water debounce and ultrasonic gap-out (A, using the UNO as a harness); YOLOv8n stop-line counting with PCU weighting (B); dashboard scaffold with camera view, hourly chart and override (C).
4. **Weeks 3–4:** diorama build (A, C).
5. **Weeks 5–6:** fail-safe integration and stress tests (all squads).
6. **Weeks 7–8:** pitch rehearsals against the four judge personas.
