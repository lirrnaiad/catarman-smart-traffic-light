# KPIs

| KPI | Target | CAP |
|---|---|---|
| Edge decision latency | <200 ms from frame ingest through YOLOv8 detection and MQTT to ESP32 LED actuation | CAP-15 |
| Vision throughput | ≥15 FPS sustained, YOLOv8 nano on the laptop | CAP-12 |
| Mixed-traffic classification accuracy | ≥85% across tricycles, motorcycles, passenger cars and utility vans on scale test footage | CAP-12 |
| Occlusion handover | <3 s (3 missed vision heartbeats) to hand stop-bar arbitration to the HC-SR04 | CAP-16 |
| Flood trigger | 5–10 s of sustained immersion before Flashing Amber (5 s debounce); splashes ignored | CAP-18 |
| Power failover | 0 ms, zero reboot when switching primary DC to battery | CAP-19 |
| Signal uptime | 100% through NORSAMELCO distribution trips, NGCP brownouts and storm cell drops | CAP-17, CAP-19 |
| Offline telemetry retention | 100% of hourly counts and anonymized violation logs retained locally during network drops (now MySQL; was SQLite/CSV) | CAP-2 |
| Privacy | 100% RA 10173 compliance: anonymized breach capture, no PII or OCR | CAP-6, CAP-9, CAP-13 |
| Production-node BOM | <₱15,000 per node, against ₱3M–₱6M for a DPWH turnkey junction (pitch claim) | none |
| Enforcer safety | No POSO enforcer needed in flooded roadways | outcome |

## Vehicle classes and PCU weights

Classes and weights can be changed without code changes, so Squad B's calibrated values drop in later.

| Class | PCU | Basis |
|---|---|---|
| car | 1.0 | Reference unit |
| tricycle | 0.5 | Brief: 1 car ≈ 2 tricycles |
| motorcycle (includes habal-habal) | 0.25 | Placeholder; Squad B calibrates |
| jeepney | 1.5 | Placeholder; Squad B calibrates |
| utility van | 1.0 | Placeholder; Squad B calibrates |

- Pedicab is dropped.
- The accuracy KPI still covers tricycle, motorcycle, car and utility van.
