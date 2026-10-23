# KPIs

| KPI | Target | CAP |
|---|---|---|
| Edge decision latency | <200 ms from frame ingest through YOLOv8 detection and MQTT to ESP32 LED actuation | CAP-15 |
| Vision throughput | ≥15 FPS sustained, YOLOv8 nano on the laptop | CAP-12 |
| Mixed-traffic classification accuracy | ≥85% across tricycles, motorcycles, passenger cars and utility vans on scale test footage | CAP-12 |
| Occlusion handover | <3 s (3 missed vision heartbeats) to hand stop-bar arbitration to the stop-line presence sensors (HC-SR04 North, IR module East); back to L1 after 5 s healthy | CAP-16 |
| Flood trigger | 5–10 s of sustained immersion before Flashing Amber (5 s debounce); splashes ignored; exits after 30 s dry | CAP-18 |
| Power failover | 0 ms, zero reboot when switching primary USB power to battery | CAP-19 |
| Signal uptime | 100% through NORSAMELCO distribution trips, NGCP brownouts and storm cell drops | CAP-17, CAP-19 |
| Offline telemetry retention | 100% of hourly counts and anonymized violation logs retained locally during network drops (now MySQL; was SQLite/CSV). Planned purges follow `privacy-compliance.md` | CAP-2 |
| Privacy | 100% RA 10173 compliance: anonymized breach capture with no PII, OCR or text detection; a printed body number stays unreadable in the stored crop | CAP-6, CAP-9, CAP-13 |
| Production-node BOM | <₱15,000 per node, against ₱3M–₱6M for a DPWH turnkey junction (pitch claim) | none |
| Enforcer safety | No POSO enforcer needed in flooded roadways | outcome |

## Vehicle classes and PCU weights

Classes and weights can be changed without code changes, so Squad B's cited values drop in later. Toy footage cannot calibrate PCU, so the weights are cited from published sources, not calibrated.

| Class | PCU | Basis |
|---|---|---|
| car | 1.0 | Reference unit |
| tricycle | 0.5 | Brief: 1 car ≈ 2 tricycles. UP NCTS (TSSP 2024) measured 0.535 on Metro Manila local roads. DPWH D.O. 22 (2013) reportedly prescribes 2.5, which that study calls an overestimate. |
| motorcycle (includes habal-habal) | 0.25 | Placeholder; Squad B cites a published value |
| jeepney | 1.5 | Placeholder; Squad B cites a published value |
| utility van | 1.0 | Placeholder; Squad B cites a published value |

- Pedicab is dropped.
- The accuracy KPI still covers tricycle, motorcycle, car and utility van, and the diorama's toy set includes all four (`hardware.md`).
- **Model labels:** stock YOLOv8n has no tricycle, jeepney or van class, so Squad B fine-tunes it on the diorama toys, with label names equal to the class ids. The demo model detects car, tricycle, motorcycle and utility van. Jeepney stays in the class file, but the demo model doesn't emit it, since there is no jeepney toy.
