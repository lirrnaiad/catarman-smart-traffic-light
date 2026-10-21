# Stack

| Layer | Choice | Source |
|---|---|---|
| Dashboard frontend | Next.js + Tailwind CSS | Course mandate (supersedes brief's HTML5/Tailwind/JS) |
| Backend | Node.js + Express | Course mandate (supersedes brief's Python edge server) |
| Database | MySQL; MySQL Workbench for design and admin | Course mandate (supersedes brief's SQLite/flat CSV) |
| Vision node | Python, Ultralytics YOLOv8 nano, on the edge laptop | Brief |
| Camera ingest | Smartphone 1080p over wired USB tethering (DroidCam / scrcpy over USB) | Brief, addendum |
| Messaging | Local Mosquitto MQTT over LAN/hotspot; JSON message schema shared by Squads A, B and C | Brief |
| Wired fallback | USB Serial bridge between laptop and ESP32, ready within 30 s if MQTT fails | Brief |
| Firmware | C++ on ESP32, built with PlatformIO / Arduino IDE | Brief |
| Hosting | localhost plus a private local Wi-Fi subnet; no cloud | Brief |
| Edge host | One student laptop, desktop Linux or Windows 10/11 | Brief |
| Display | Chromium-based browser, full-screen on the venue Smart TV | Brief |
| Repository | Single monorepo with isolated directories. Brief layout: `/firmware`, `/edge_vision`, `/dashboard`, `/docs`. Backend placement is open (architecture). | Brief, course |

## Open for bmad-architecture

- The integration path between the Python vision node, Mosquitto, Express and MySQL, covering how telemetry reaches storage and the dashboard and how overrides reach the ESP32.
- How the simulator (CAP-1) plugs in so the M2 live source (CAP-8) replaces it cleanly.
- Real-time transport from backend to dashboard; it must deliver each change within 1 s (CAP-3). Also how video frames are delivered for CAP-7.
- Framework and runtime versions.
