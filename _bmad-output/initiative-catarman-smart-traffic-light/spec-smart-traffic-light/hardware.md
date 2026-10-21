# Hardware

## MCU roles

- **ESP32 Dev Board (30-pin, dual-core Xtensa LX6, Wi-Fi/BT):** the sole runtime master. All sensors, MQTT networking, the OLED and the 4-way signal LEDs wire directly to it.
- **Arduino UNO R3:** an offline benchtop harness only, used to develop water-sensor and HC-SR04 debouncing and to verify state-machine logic before porting to the ESP32. It is kept out of the runtime path, which removes I2C/UART inter-MCU sync failures.

## ESP32 pin map

| Function | GPIO |
|---|---|
| NS Green / Yellow / Red | 25 / 26 / 27 |
| EW Green / Yellow / Red | 14 / 12 / 13 |
| OLED SSD1306 SDA / SCL (I2C) | 21 / 22 |
| Curb water sensor (analog, ADC1) | 34 |
| HC-SR04 Trigger | 5 |
| HC-SR04 Echo (through a 1 kΩ/2 kΩ divider to protect 3.3 V logic) | 18 |

Only one HC-SR04 is mapped (see the kernel open question on Level 2 coverage).

## Power: Diode-OR dual-rail failover

**Problem:** a raw PP3 9 V battery on ESP32 VIN sags during Wi-Fi bursts (250–350 mA peaks, ~1–2 Ω internal resistance). The voltage drops below the AMS1117-3.3 regulator's 4.5 V dropout and causes brownout resets.

```
Primary:   USB 5V adapter / laptop USB ---->|-- 1N4007 (D1) --+
                                                              +--> Common 5V bus (ESP32 5V/VIN, LEDs)
Secondary: 9V battery -> MB102 regulated 5V ->|-- 1N4007 (D2) --+
                         (onboard 100 µF caps)
```

- D1 conducts while primary USB is present (~5.0 V). When primary is cut, D2 forwards current from the regulated secondary rail, with no mechanical bounce and <1 µs electrical handover.
- The MB102's 100 µF capacitors absorb transient current spikes.
- During the pitch, Squad A shows the voltage before and after the diode junction on a multimeter.

## Inventory (zero procurement; existing kits only)

- **UNO R3 Super Starter Kit (1):** UNO R3 with cable, prototype shield, 830-point breadboard, 65 jumpers, 10 F-M Dupont wires. LCD1602, 4-digit and 1-digit 7-segment displays. SG90 servo, 28BYJ-48 stepper with ULN2003, 3 V DC motor with fan, 5 V 1-channel relay. MB102 power module, 9 V clip with 5.5 mm barrel. Sensors: HC-SR04, water level module, DHT11, sound module, photoresistors ×2, thermistor, tilt switch. 100 mixed resistors, 74HC595, L293D, PN2222 ×2, 1N4007 ×2, 10K potentiometers. LEDs (Red, Yellow, Green, Blue and White ×5 each, RGB ×1), active and passive buzzers, push buttons ×5, membrane keypad, IR receiver with remote.
- **ESP32 Basic Starter Kit (1):** ESP32 Dev Board with Micro-USB cable, 830-point breadboard, Dupont M-M/F-F/F-M ×10 each. 0.96" SSD1306 128×64 I2C OLED, 5 V 2-channel optical relay. Sensors: HC-SR501 PIR, IR obstacle module, photoresistor module, DHT11. Resistors (220 Ω, 1 kΩ, 10 kΩ ×30), LEDs (Red, Yellow, Green ×5 each, RGB ×2), push buttons ×6, potentiometers, buzzers.
- **Tools:** 9 V alkaline PP3, alligator clip leads, digital multimeter, safety goggles.
- **Personal devices:** student laptops (edge host), smartphones (camera).

## Diorama (CAP-20)

Built from local foam board, with mounted LED signal heads, vehicle approaches, a curb water sensor and stop-line ultrasonic sensing. Critical terminal rails are hot-glued against transport fatigue.

## Rejected: ESP32-CAM

1. It cannot run YOLOv8 nano multi-class inference; it can only stream video at a low framerate.
2. Over 2.4 GHz Wi-Fi it adds 200–500 ms buffering, thermal throttling and frame drops.
3. At ₱250–₱350 it would take more than 30% of the cash budget, and 7–12 day courier transit over the Matnog–Allen ferry put the Oct 20 hardware freeze at risk.

**Adopted instead:** a smartphone over wired USB tethering, giving <30 ms ingest, 30+ FPS, no Wi-Fi interference, at ₱0.
