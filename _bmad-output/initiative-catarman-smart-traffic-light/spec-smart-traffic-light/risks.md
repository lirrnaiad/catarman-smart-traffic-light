# Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Laptop thermal throttling under sustained YOLOv8n, now alongside Next.js, Express and MySQL | Framerate drops below 10 FPS; latency KPI missed | The dashboard is a static export with no Next.js server process (spine AD-9). A 20-minute full-stack soak test runs before weeks 5–6 (spine Deferred). |
| Venue 2.4 GHz RF congestion | Dropped MQTT packets between laptop and ESP32 | Camera on wired USB tethering; hardwired USB Serial fallback for MQTT ready within 30 s |
| Breadboard jumper fatigue in transport | Loose connections at the venue | Hot glue on critical terminal rails; harness wires taped into bundles with both ends labeled |
| Battery droop from ESP32 Wi-Fi bursts | Brownout reset on battery | Diode-OR through the ESP32's onboard USB diode and D2 (1N4007) from the MB102, whose 100 µF caps absorb spikes; a fresh 9 V per demo run. If the bus reads under 4.4 V on battery, upgrade to 1N5819 + 1000 µF. Squad A's own estimate for the battery leg is ≈4.2 V, already under that trigger. Verified live with a multimeter (`hardware.md`). |
| PubSubClient, the common ESP32 MQTT library, is unmaintained as of 2026 | Firmware MQTT client gets no fixes | **Mitigated.** Firmware uses esp-mqtt from the Arduino-ESP32 core (`stack.md`). The contract stays within PubSubClient-class limits (QoS 0 publish, ≤512 bytes), so any client works (spine AD-5). |
| Strong sunlight blinds the IR obstacle module | East stop-line presence fails, so L2 loses the EW phase | Test under the presentation room lights |
| Water sensor traces corrode | False or missed flood readings in the L4 demo | Rinse and dry the sensor after each flood test |
| Stock YOLOv8n has no tricycle, jeepney or van class | CAP-12's 85% accuracy is missed on the toy set | Squad B fine-tunes on photos of the diorama toys under the overhead camera (`kpis.md`) |
| A judge cites DPWH's tricycle PCU (reportedly 2.5) against our 0.5 | The PCU weighting looks arbitrary | Cite the UP NCTS 2024 measurement (0.535) and the brief's 1 car ≈ 2 tricycles (`kpis.md`) |
| The venue TV's HDMI input doesn't work | The dashboard isn't visible to the judges | Site check by mid-November; screen-mirroring fallback that keeps the backend local-only (`milestones.md`) |
| M1 lands 4 days after spec creation | Midterm prototype incomplete | M1 limited to CAP-1 to CAP-6 on simulated telemetry; stories sliced thin for 3 parallel developers |
