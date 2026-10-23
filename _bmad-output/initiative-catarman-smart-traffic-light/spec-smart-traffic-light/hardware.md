# Hardware

Squad A's materials list, prototype design (Fig. 1 diorama top view, Fig. 2 block and wiring) and 3D build guide settle the hardware below; they supersede the brief and addendum where the two differ. Squad A marks the pin numbers as an initial proposal that may change during testing. Breadboard hole-by-hole steps stay in Squad A's build guide (`docs/Catarman Signal Diorama (Copy).html`); its laptop panel's "Node MQTT → MySQL ingest (Squad A)" and "schema in Workbench" entries are superseded (`milestones.md`), and its "broker host still to confirm" is settled by the spine (Mosquitto on the edge laptop, AD-15).

## MCU roles

- **ESP32 Dev Board (DevKit V1, 30-pin, dual-core Xtensa LX6, Wi-Fi/BT):** the sole runtime master. It runs the signal state machine and Level 1–4 fail-safe logic, reads every sensor, drives the 12 signal LEDs and the OLED, and talks MQTT over Wi-Fi. The firmware runs a non-blocking loop with the watchdog on and keeps a boot counter in NVS.
- **Arduino UNO R3:** an offline benchtop harness only, used to develop water-sensor and HC-SR04 debouncing and to verify state-machine logic before porting to the ESP32. It is kept out of the runtime path, which removes I2C/UART inter-MCU sync failures.

## ESP32 pin map

| Function | GPIO | Notes |
|---|---|---|
| NS Green / Yellow / Red | 25 / 26 / 27 | Drives the North and South heads together. |
| EW Green / Yellow / Red | 14 / 12 / 13 | Drives the East and West heads together. GPIO 12 must stay low at boot: never add a pull-up; the LED and resistor to GND hold it low. |
| OLED SSD1306 SDA / SCL (I²C) | 21 / 22 | Powered from 3.3 V. |
| Water level sensor (analog) | 34 | ADC1, so it reads while Wi-Fi is on. Powered from 3.3 V. |
| HC-SR04 Trig / Echo, North stop line (NS phase) | 5 / 18 | Echo through a 1 kΩ/2 kΩ divider (5 V → 3.3 V). Powered from the 5 V bus. Read timeout ≈25 ms so a missing echo never blocks the loop. A vehicle is present below D_stopline (8 cm). |
| IR obstacle module OUT, East stop line (EW phase) | 19 | Digital, LOW when a vehicle is present. Powered from 3.3 V. Trimmer set to trigger at about one lane width (≈7 cm, suggested). Internal pull-down, so an unplugged module reads as presence that never clears (L3 detection, `degradation-levels.md`). |
| Power-source sense | 35 | 10 kΩ/10 kΩ divider from the 5 V bus: ≈4.7 V on USB (≈2.35 V at the pin), ≈4.2 V on battery (≈2.1 V). Calibrate the threshold on the real board, with hysteresis. |
| Fault-reset push button | 23 (suggested) | A kit push button to GND, with the internal pull-up, on the controller box front. The only way to clear a latched conflict fault. |

Opposing approaches share a phase, so the 12 LEDs need only 6 outputs.

## Stop-line presence sensing (Level 2)

The kits hold one HC-SR04, so it covers the North approach (NS phase) and the ESP32 kit's IR obstacle module covers the East approach (EW phase). Both aim across the painted stop line and sense only the lead vehicle: presence, not queue length (`degradation-levels.md`). South and West have no stop-line sensor; they share their phase with North and East.

## Power: Diode-OR dual-rail failover

**Problem:** a raw PP3 9 V battery on ESP32 VIN sags during Wi-Fi bursts (250–350 mA peaks, ~1–2 Ω internal resistance). The voltage drops below the AMS1117-3.3 regulator's 4.5 V dropout and causes brownout resets.

```
Main:    laptop USB 5 V --> ESP32 onboard USB diode ---------------+
                                                                   +--> 5 V bus --> ESP32 VIN, HC-SR04
Backup:  9 V PP3 --> MB102 5 V (bottom jumper OFF) --> D2 1N4007 --+         |
                                                                             +--> 10 kΩ/10 kΩ --> GPIO 35
All grounds (ESP32, sensors, MB102) tied together.
```

- **No external D1.** The ESP32's onboard USB diode is the USB leg of the Diode-OR. D2 (1N4007) passes MB102 5 V onto the bus and blocks the bus from back-feeding the MB102. This supersedes the brief's two-1N4007 circuit.
- The MB102's top jumper sits on 5 V and its bottom jumper on OFF; on 5 V the battery would feed the bus directly and bypass D2.
- The MB102's 100 µF capacitors absorb transient current spikes.
- **Pre-wiring check:** USB only gives VIN ≈4.6–4.8 V; battery only gives ≈0 V at the USB connector.
- **Optional upgrade** (bought only if needed): if the bus reads under 4.4 V on battery with Wi-Fi on, swap D2 for a 1N5819 Schottky (≈0.3 V drop) and add a 1000 µF capacitor (≥10 V) on the bus, then re-check the GPIO 35 threshold.
- Use a fresh 9 V battery for each demo run, and keep spares for the soak test.
- The ESP32's Micro-USB cable carries both main power and the laptop's serial and flashing link (the CAP-15 fallback).
- **Proof (CAP-19):** during the pitch, Squad A shows the bus voltage at the diode junction on a multimeter, the OLED shows the power source, and the NVS boot counter shows no reboot. The dashboard shows the same power source and boot count (CAP-8). Squad A's own gate is 20 USB pulls with zero reboots.

## OLED (controller box)

The 0.96" OLED on the front of the controller box shows the current level (L1–L4, or FAULT), the phase, a countdown and the power source (USB or battery). The ESP32 also publishes the countdown, power source and boot count for the dashboard (CAP-8), as optional fields in the spine's MQTT contract v1.

## Inventory (no MCUs or sensors bought)

- **UNO R3 Super Starter Kit (1):** UNO R3 with cable, prototype shield, 830-point breadboard, 65 jumpers, 10 F-M Dupont wires. LCD1602, 4-digit and 1-digit 7-segment displays. SG90 servo, 28BYJ-48 stepper with ULN2003, 3 V DC motor with fan, 5 V 1-channel relay. MB102 power module, 9 V clip with 5.5 mm barrel. Sensors: HC-SR04, water level module, DHT11, sound module, photoresistors ×2, thermistor, tilt switch. 100 mixed resistors, 74HC595, L293D, PN2222 ×2, 1N4007 ×2, 10K potentiometers. LEDs (Red, Yellow, Green, Blue and White ×5 each, RGB ×1), active and passive buzzers, push buttons ×5, membrane keypad, IR receiver with remote.
- **ESP32 Basic Starter Kit (1):** ESP32 Dev Board with Micro-USB cable, 830-point breadboard, Dupont M-M/F-F/F-M ×10 each. 0.96" SSD1306 128×64 I2C OLED, 5 V 2-channel optical relay. Sensors: HC-SR501 PIR, IR obstacle module, photoresistor module, DHT11. Resistors (220 Ω, 1 kΩ, 10 kΩ ×30), LEDs (Red, Yellow, Green ×5 each, RGB ×2), push buttons ×6, potentiometers, buzzers.
- **Unused in the prototype:** LCD1602, 7-segment displays, servo, stepper motor, relays, DHT11, PIR sensor, sound sensor, buzzers.
- **Tools:** 9 V alkaline PP3, digital multimeter with alligator clip leads, glue gun, safety goggles.
- **Members' own devices:** the edge laptop (Windows 10/11 or Linux, 8 GB RAM or more), smartphone camera with a data-capable USB cable, 2.4 GHz mobile hotspot (private network between laptop and ESP32), HDMI cable (and any USB-C adapter the laptop needs) for the venue TV, and a shoebox or small plastic box for the controller.

## Purchases and budget

The ₱1,000 cap (kernel Constraints) covers diorama supplies, wiring, consumables, small passive power parts and mounts. Squad A's estimate:

| Item | Est. ₱ |
|---|---|
| 2 × 9 V PP3 batteries | 150 |
| 1 extra jumper-wire set | 120 |
| Diorama materials: 2 foam boards, 2 black cartolina, white paint pen, barbecue sticks, hot glue sticks, clear plastic cup, ~8 toy vehicles, double-sided tape | 415 |
| Optional power upgrade (1N5819 + 1000 µF) | 0–35 |
| Phone clamp stand, if no member owns one | 0–100 |
| **Total** | **685–820** |

The brief's ≤₱350 freeze-time order (jumper wires and foam board) is ₱270 of this. Same-scale utility vans join the toy set (below); Squad A adjusts the list within the cap.

## Diorama (CAP-20)

- **Base:** 60 × 60 cm foam board (5 mm). Black cartolina roads 15 cm wide form two crossing two-lane roads; traffic keeps right. Signal and sensor wires run under the base to the controller box.
- **Stop lines:** white paint pen. The stop-line sensors aim across them, and they stay visible to the overhead camera as reference marks for Squad B.
- **Signal heads ×4:** red, yellow and green 5 mm LEDs in a housing on a barbecue-stick pole. The N–S pair and the E–W pair are wired together.
- **Stop-line sensors:** HC-SR04 at the North stop line, IR obstacle module at the East stop line.
- **Flood well:** a clear plastic cup at the West approach curb holds the water sensor and is filled with water for the flood demo. Rinse and dry the sensor after each test; its traces corrode.
- **Controller box:** in the NE corner, away from the roads and water. It holds the ESP32, breadboard, MB102, 9 V battery and D2, with the OLED and the fault-reset button on its front.
- **Camera:** a smartphone overhead on a clamp stand (Squad B), USB-tethered to the laptop and framing all four stop lines.
- **Test vehicles:** about 8 same-scale toys covering tricycles, motorcycles, cars and utility vans, so CAP-12's accuracy can be filmed for every KPI class. Squad B fine-tunes the model on them (`kpis.md`). One toy tricycle carries a printed body-number sticker for the crop-anonymization test (`privacy-compliance.md`).
- Critical terminal rails and jumpers are hot-glued against transport fatigue.

## Rejected: ESP32-CAM

1. It cannot run YOLOv8 nano multi-class inference; it can only stream video at a low framerate.
2. Over 2.4 GHz Wi-Fi it adds 200–500 ms buffering, thermal throttling and frame drops.
3. At ₱250–₱350 it would take more than 30% of the cash budget, and 7–12 day courier transit over the Matnog–Allen ferry put the Oct 20 hardware freeze at risk.

**Adopted instead:** a smartphone over wired USB tethering, giving <30 ms ingest, 30+ FPS, no Wi-Fi interference, at ₱0.
