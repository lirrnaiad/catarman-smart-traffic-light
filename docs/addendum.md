# Addendum: Catarman LGU Climate-Resilient SMART Traffic Light

This document preserves technical specifications, hardware component inventories, circuit designs, domain literature context, and regulatory compliance paths that inform downstream implementation (PRD, System Architecture, Firmware Design, and LGU Policy Whitepaper) while keeping the main Project Brief lean.

---

## 1. Physical Component Inventory & Kit Allocation

### 1.1 Team Available Hardware Inventory
The project is implemented exclusively from existing student hardware kits with zero additional electronic component procurement:

* **Super Starter Kit for UNO R3 (1 Kit):**
  * Microcontroller: Arduino UNO R3 with USB programming cable
  * Prototyping: Prototype Expansion Shield, 830 tie-point breadboard, 65 jumper wire bundle, 10 F-M Dupont wires
  * Displays: LCD1602 module, 4-digit 7-segment display, 1-digit 7-segment display
  * Actuators: SG90 micro-servo motor, 28BYJ-48 stepper motor with ULN2003 driver, 3V DC toy motor with fan blade, 5V single-channel relay module
  * Power: MB102 Breadboard Power Supply Module (dual 3.3V/5V rails with DC barrel input), 9V battery clip with 5.5mm DC barrel plug
  * Sensors: HC-SR04 ultrasonic sensor, water level detection sensor module, DHT11 temperature/humidity module, sound sensor module, photoresistors (2 pcs), thermistor, tilt switch
  * Semiconductors & Passives: 100 mixed resistors, 74HC595 8-bit shift register, L293D dual H-bridge motor driver, PN2222 NPN transistors (2 pcs), 1N4007 rectifier diodes (2 pcs), 10K potentiometers
  * Indicators & Inputs: 5mm LEDs (Red 5, Yellow 5, Green 5, Blue 5, White 5, RGB 1), active buzzer, passive buzzer, push buttons (5 pcs), membrane keypad matrix, IR receiver & remote
* **ESP32 Basic Starter Kit (1 Kit):**
  * Microcontroller: ESP32 Development Board (30-pin, Dual-Core Xtensa LX6, onboard Wi-Fi/Bluetooth) with Micro-USB cable
  * Prototyping: 830 tie-point breadboard, 10 M-M Dupont cables, 10 F-F Dupont cables, 10 F-M Dupont cables
  * Display: 0.96-inch monochrome I2C OLED display (SSD1306, 128x64)
  * Actuation & Power: 5V 2-channel optical relay module
  * Sensors: HC-SR501 PIR motion sensor, obstacle avoidance infrared module, photoresistor module, DHT11 module
  * Passives & Indicators: 5mm LEDs (Red 5, Yellow 5, Green 5, RGB 2), resistors (220Ω, 1kΩ, 10kΩ x30), push buttons (6 pcs), potentiometers, buzzers
* **Auxiliary Tools & Equipment:**
  * 9V alkaline PP3 battery, alligator test clip leads, digital multimeter, safety goggles.

---

## 2. Electrical Power Architecture: Diode-OR Failover

### 2.1 Problem Analysis of Raw 9V Battery Failover
Directly wiring an alkaline 9V transistor battery (PP3) to the `VIN` pin of an ESP32 induces severe voltage sag during Wi-Fi transmission bursts (peak current draw of 250–350 mA). High internal battery resistance (~1–2 Ω) causes battery terminal voltage to momentarily drop below the 4.5V dropout limit of onboard linear regulators (AMS1117-3.3), triggering brownout resets.

### 2.2 Implemented Diode-OR Power Multiplexer Schematic
To guarantee true 0 ms uninterrupted failover without controller resets, the team utilizes the kit's MB102 Power Supply Module and two 1N4007 rectifier diodes configured as a Diode-OR circuit:

```
Primary Rail:
  USB 5V Adapter (or Laptop USB) ----->|--- [1N4007 Diode 1] ---+
                                                                 |---> Common 5V Bus
Secondary Rail:                                                  |     (Powers ESP32 5V/VIN & LEDs)
  9V Battery ---> [MB102 Regulated 5V] --->|--- [1N4007 Diode 2] ---+
                  (Onboard 100uF Caps)
```

* **Transient Absorption:** The MB102 module features dual onboard electrolytic smoothing capacitors (100 µF) that supply instantaneous current transients, preventing battery voltage dips.
* **Switchover Dynamics:** Diode 1 conducts as long as primary USB power is connected (~5.0V). When primary power is severed during live stage demonstrations, Diode 2 instantly forwards current from the regulated secondary rail with zero mechanical bounce and `< 1 µs` electrical handover time.
* **Multimeter Verification:** Squad A measures voltage before and after the diode junction to demonstrate rail stability live during the presentation.

---

## 3. Microcontroller Architecture: Single-Master Allocation

### 3.1 Architectural Split
* **Runtime Single-Master (ESP32):** The diorama runtime state machine runs 100% on the ESP32. All sensor inputs, MQTT networking, OLED display rendering, and 4-way signal LED actuation are wired directly to the ESP32.
* **Benchtop Test Harness (Arduino UNO R3):** The Arduino UNO R3 is deliberately isolated from the diorama runtime path. Squad A uses the Uno as an offline testing harness to develop sensor debouncing algorithms (water sensor and HC-SR04) and verify state machine logic before committing firmware to the ESP32. This eliminates inter-MCU bus communication (I2C/UART) and associated synchronization failures.

### 3.2 ESP32 GPIO Pin Budget for 4-Way Scale Diorama
In a standard symmetrical 4-way intersection, opposing approaches share the same phase:
* **Phase 1 (North-South Approach):**
  * NS Green: GPIO 25
  * NS Yellow: GPIO 26
  * NS Red: GPIO 27
* **Phase 2 (East-West Approach):**
  * EW Green: GPIO 14
  * EW Yellow: GPIO 12
  * EW Red: GPIO 13
* **Sensor & Bus Allocations:**
  * I2C OLED (SSD1306): GPIO 21 (SDA), GPIO 22 (SCL)
  * Curb Water Sensor: GPIO 34 (Analog ADC1)
  * HC-SR04 Ultrasonic Sensor: GPIO 5 (Trigger), GPIO 18 (Echo via 1kΩ/2kΩ voltage divider to protect 3.3V logic)

---

## 4. Traffic Engineering Context: Level 2 Sensor Fallback

### 4.1 Comparison with Industry Standards (NEMA TS2 & HCM)
* **Advance vs. Stop-Bar Detection:** In professional traffic engineering (NEMA TS2 and Highway Capacity Manual standards), intersection detection is split into Advance Detection (50–100m upstream for speed/platoon measurement) and Stop-Bar Detection (at the crosswalk for immediate right-of-way demand).
* **Physical Acoustic Shadowing:** An ultrasonic sensor at curb level cannot detect vehicles stacked behind the lead vehicle due to acoustic obstruction. Framing Level 2 as "queue length measurement" is scientifically invalid.

### 4.2 Actuated Stop-Bar Control Logic
Under Level 2 (Optical Occlusion Fallback), the ESP32 firmware executes standard **Actuated Stop-Bar Presence & Gap-Out**:
1. **Demand Call:** When a vehicle arrives at a red light, echo distance drops ($D < D_{\text{stopline}}$), placing an active phase service call.
2. **Passage Time Extension:** While vehicle presence is continuously sensed, green time is extended up to a pre-configured maximum threshold ($T_{\text{max\_green}}$).
3. **Green Gap-Out:** If the stop bar clears for $> 3.0\text{ seconds}$ continuous duration, the controller terminates green early ("gaps out") and cycles to the opposing phase, preventing empty idle delays.

---

## 5. Data Privacy & Regulatory Strategy (RA 10173 & NPC Circular 16-01)

### 5.1 Tension Analysis
* Capturing municipal body numbers to sanction franchised tricycle operators constitutes automated processing of Personally Identifiable Information (PII) under Philippine Republic Act 10173 (Data Privacy Act of 2012).
* Automated enforcement requires strict adherence to National Privacy Commission (NPC) Advisory 2020-04 (Guidelines on the Use of CCTV Systems) and NPC Circular 16-01 (Security of Personal Data in Government Agencies).

### 5.2 Two-Tier Regulatory Implementation
* **Tier 1 (MVP Academic Proof-of-Concept):**
  * Privacy-by-Design architecture.
  * System records only non-identifying telemetry: breach event timestamp, detected vehicle class centroid (e.g., `TRICYCLE`, `MOTORCYCLE`), and anonymized bounding-box frame crop.
  * No optical character recognition (OCR), no driver face identification, and no database cross-referencing.
  * Stores aggregated statistical metrics (hourly violation counts, red-light running frequencies per intersection approach).
* **Tier 2 (Phase 2 Municipal Institutionalization):**
  * Formal technical roadmap provided to Catarman LGU.
  * Prerequisites for production deployment:
    1. Execution of an LGU-led Privacy Impact Assessment (PIA) approved by the Catarman Data Protection Officer (DPO).
    2. Sangguniang Bayan municipal ordinance authorizing automated traffic violation auditing and establishing public data subject notices.
    3. Encryption at rest for violation audit logs with strict role-based access control (RBAC).

---

## 6. Design Decisions & Rejected Hardware Alternatives

### 6.1 ESP32-CAM Module Rejection
* **Decision:** Reject the procurement of an ESP32-CAM module.
* **Rationale:**
  1. *Compute Incapacity:* An ESP32-CAM cannot execute YOLOv8 nano multi-class vehicle inference; it can only act as a low-framerate video streamer.
  2. *Low Video Quality & High Lag:* Over 2.4 GHz Wi-Fi, ESP32-CAM feeds suffer from 200–500 ms buffering delay, severe thermal throttling, and frequent frame drops.
  3. *Budget & Transit Risk:* Costing ₱250–₱350, it would consume > 30% of the team's pooled cash budget, and 7–12 day shipping across the Matnog–Allen ferry risks missing the October 20 hardware freeze.
* **Adopted Solution:** Personal student smartphone streaming 1080p video over wired **USB Tethering** directly into the laptop, providing `< 30 ms` ingestion latency, 30+ FPS stability, zero Wi-Fi interference, and ₱0 expenditure.
