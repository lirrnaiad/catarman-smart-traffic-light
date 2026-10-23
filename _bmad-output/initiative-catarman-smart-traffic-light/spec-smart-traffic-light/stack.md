# Stack

Layer choices only. Library and tool versions live in the architecture spine's Stack section (`../architecture-smart-traffic-light/architecture-smart-traffic-light.md`), and how the layers connect lives in its AD-1 to AD-19. This file does not repeat them.

| Layer | Choice | Source |
|---|---|---|
| Dashboard frontend | Next.js + Tailwind CSS, a static client of the backend (spine AD-9) | Course mandate (supersedes brief's HTML5/Tailwind/JS) |
| Backend | Node.js + Express: the sole gateway and the only MQTT-to-MySQL ingest (spine AD-2) | Course mandate (supersedes brief's Python edge server); user decision |
| Database | MySQL Community Server; schema changes land only as migrations (spine AD-10). MySQL Workbench is the design and admin tool and holds the EER model, kept by Squad A's data & QA member | Course mandate (supersedes brief's SQLite/flat CSV); user decision |
| Vision node | Python, Ultralytics YOLOv8 nano, on the edge laptop | Brief |
| Camera ingest | Smartphone 1080p over wired USB tethering (DroidCam / scrcpy over USB) | Brief, addendum, Squad A |
| Messaging | Local Mosquitto MQTT over LAN/hotspot. MQTT contract v1, in the spine, was locked Oct 22, 2026 | Brief, user decision |
| ESP32 MQTT client | esp-mqtt from the Arduino-ESP32 core, which runs in its own task. Not PubSubClient, which is unmaintained (`risks.md`) | User decision |
| Wired fallback | USB Serial bridge between laptop and ESP32, ready within 30 s if MQTT fails; transparent to the backend (spine AD-17) | Brief |
| Firmware | C++ on ESP32, built with PlatformIO or Arduino IDE | Brief |
| Hosting | localhost plus a private 2.4 GHz hotspot subnet; no cloud | Brief, Squad A |
| Access control | No operator login. Express accepts local connections only; Mosquitto gets a password and an ACL before it listens on the hotspot (spine AD-15) | User decision |
| Edge host | One student laptop, desktop Linux or Windows 10/11, 8 GB RAM or more | Brief, Squad A |
| Display | Chromium-based browser, full-screen on the venue Smart TV | Brief |
| Repository | Single monorepo with isolated top-level directories (spine AD-13 and Source tree) | Brief, course |

## Settled by the architecture spine

These were open for `bmad-architecture`; the spine now answers them.

- **Integration path** between the vision node, Mosquitto, Express and MySQL, and the override route to the ESP32: AD-1, AD-2, AD-7 and MQTT contract v1.
- **Simulator plug-in** and the clean M2 swap to live telemetry: AD-3.
- **Real-time transport** from backend to dashboard within 1 s: AD-8. Video for CAP-7: AD-17, with the source chosen in M2.
- **Versions:** the spine's Stack section. Squads A and B pin Python, Ultralytics, Arduino-ESP32 core and esp-mqtt versions in their own directories.

## Settled in the spine on Oct 22, 2026

The spine's update of Oct 22, 2026 folded in these spec decisions. AD-1 to AD-18 kept their numbers; AD-19 is new.

- **Contract fields (additive, no `v` bump):** optional `remainingS` (one number: seconds left in the interval now running), `power` and `bootCount` (AD-4, contract v1). In L1 and L2 the dashboard shows green as "up to N s"; yellow, all-red and L3 counts are exact.
- **CAP-10 topic:** `vision/speed-alert`, never stored. Squad B's sign-off was waived by user decision; Squad B is told, not asked. The simulator's `--speed-alerts` mode is the demo stand-in (AD-3, AD-17).
- **Login and broker auth:** no operator login; Express and MySQL stay local-only; Mosquitto gets a password and an ACL before it listens on the hotspot (AD-15).
- **Crop pixel cap:** 64 px on the long side, checked by the backend (AD-11).
- **Retention and purge:** one daily job (AD-19), landing before the first real camera crop is stored.
- **Override on link drop and conflict-fault reset:** AD-7 and AD-18 (`degradation-levels.md`).
