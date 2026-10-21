# Risks

| Risk | Effect | Mitigation |
|---|---|---|
| Laptop thermal throttling under sustained YOLOv8n, now alongside Next.js, Express and MySQL | Framerate drops below 10 FPS; latency KPI missed | None in sources beyond the single-laptop assumption. Architecture should keep the dashboard stack light. |
| Venue 2.4 GHz RF congestion | Dropped MQTT packets between laptop and ESP32 | Camera on wired USB tethering; hardwired USB Serial fallback for MQTT ready within 30 s |
| Breadboard jumper fatigue in transport | Loose connections at the venue | Hot glue on critical terminal rails |
| Battery droop from ESP32 Wi-Fi bursts | Brownout reset on battery | Diode-OR with MB102 100 µF caps and 1N4007s, verified live with a multimeter (`hardware.md`) |
| M1 lands 4 days after spec creation | Midterm prototype incomplete | M1 limited to CAP-1 to CAP-6 on simulated telemetry; stories sliced thin for 3 parallel developers |
