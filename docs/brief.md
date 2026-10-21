---
title: "Project Brief: Catarman LGU Climate-Resilient SMART Traffic Light"
status: "draft"
created: "2026-10-08"
updated: "2026-10-08"
---

# Project Brief: Catarman LGU Climate-Resilient SMART Traffic Light

## Executive Summary
The Catarman LGU Climate-Resilient SMART Traffic Light is an edge-native, grid-independent traffic management system engineered to automate intersection signaling across weather-vulnerable, power-unstable provincial capitals. Combining edge computer vision with localized embedded microcontrollers, the system dynamically calculates signal phase timing based on real-time vehicle density—specifically weighted for Philippine provincial traffic profiles like tricycles and motorcycles—without external cloud or continuous utility grid dependencies.

Municipalities across Northern Samar endure a chronic triple-disruption bottleneck: monsoon-driven street flooding, cellular network blackouts, and frequent unscheduled power outages driven by NORSAMELCO cooperative distribution faults and NGCP transmission line trips. Standard traffic control systems fail under these conditions—either freezing when internet links break, causing gridlock during brownouts, or neglecting local mixed-traffic patterns. Designed specifically for the operational demands of the Municipality of Catarman, the Public Order and Safety Office (POSO), and the Municipal Disaster Risk Reduction and Management Office (MDRRMO), this solution executes all computer vision inference, state-machine transitions, and emergency routing locally. Featuring an automatic camera-to-ultrasonic sensor handover, immediate flood-level hazard response, and dual-rail battery failover architecture, the system guarantees zero-latency, fail-safe traffic control even when provincial power and communication grids completely collapse.

---

## Problem Statement

### 1. The Baseline Reality: Zero Automated Infrastructure
In the Municipality of Catarman, Northern Samar, there is no automated traffic light infrastructure in place. Rather than replacing outdated or rigid timer systems, intersection management currently alternates between two extremes:
* **Overextended Manual Enforcement:** A small detachment of municipal POSO traffic enforcers manually directing flow at high-density choke points (such as the Catarman Public Market, Jacinto Street, and UEP access corridors) during peak morning and late-afternoon hours.
* **Unregulated "Free-for-All":** Outside peak enforcement hours, during midday lulls, and throughout the night, intersections operate with zero traffic control, leaving right-of-way negotiation entirely to the discretion and due diligence of individual motorists.

### 2. The Core Failure Mode: Weather Abandonment & Disaster Paralysis
The complete reliance on manual manpower creates a critical failure point during extreme weather:
* **Enforcer Evacuation During Severe Weather:** When monsoon rains and typhoon winds hit, human enforcers cannot safely stand in open roadways or knee-deep gutter flooding. They are forced to take shelter, leaving critical intersections completely unmanned and unregulated at the exact moment road conditions are most hazardous.
* **Disaster Response & Evacuation Gridlock:** Without automated signaling, flash flooding along low-lying streets triggers immediate bottlenecks as vehicles attempt evasive maneuvers. Emergency vehicles and disaster relief convoys dispatched by the MDRRMO are obstructed by uncoordinated traffic jams at unmanaged junctions.

### 3. Why Catarman Remained Un-Signaled: The Utility & Budget Barrier
* **The High Capital & Maintenance Barrier:** Commercial turnkey traffic signal installations contracted through DPWH typically cost ₱3,000,000 to ₱6,000,000 per junction. For a provincial municipality, spending millions on closed, proprietary foreign systems that local municipal technicians cannot service or reprogram is fiscally unfeasible.
* **Grid & Connectivity Fragility:** Even if the LGU invested in standard traffic lights, frequent distribution faults from NORSAMELCO and transmission line trips from the NGCP grid would routinely leave them without power. Coupled with severe telecom drops during storms, conventional grid-tied, cloud-connected traffic controllers would fail or sit dark for days at a time.
* **Heterogeneous Mixed Traffic:** Un-signaled junctions in Catarman are dominated by tricycles, motorcycles/habal-habal, pedicabs, and utility vans. Standard traffic controllers imported from metropolitan settings are not tuned to accommodate or arbitrate dense clusters of two- and three-wheelers.

### 4. The Leapfrog Opportunity
Because Catarman lacks legacy traffic light equipment, the municipality does not need to transition through 1980s-style fixed timers. It has the opportunity to leapfrog directly to edge-autonomous, climate-resilient micro-signaling—deploying low-cost, open-architecture systems that require zero cloud dependency, survive grid outages, and automatically safeguard traffic flow when weather forces human enforcers off the street.

---

## Proposed Solution

### 1. Core Concept & Architectural Approach
The system operates on a decoupled, hierarchical edge computing model:
* **Edge Vision & Traffic Profiling (Local Compute Layer):** A lightweight computer vision pipeline (YOLOv8 nano executed on a local edge node) continuously processes video streams from overhead high-definition cameras (ingested via direct wired USB tethering from a smartphone to bypass venue Wi-Fi contention). Instead of treating all vehicles as standard passenger cars, the model detects, classifies, and weights provincial mixed-traffic profiles—assigning dynamic Passenger Car Unit (PCU) values to tricycles, motorcycles, jeepneys, and private cars to compute true roadway congestion (1 Car ≈ 2 Tricycles).
* **Autonomous Master Controller (Embedded IoT Layer):** A dedicated ESP32 master microcontroller acts as the autonomous physical signal orchestrator, communicating with the vision layer via a local MQTT broker over LAN. The microcontroller executes a deterministic finite state machine that dynamically expands or truncates green-phase durations according to real-time directional demand (with an isolated Arduino UNO R3 designated as a benchtop hardware test harness).
* **Secondary Queue & Environmental Telemetry Layer:** Physical sensors integrated into the intersection curb provide hardware-level verification. An HC-SR04 ultrasonic sensor provides stop-bar vehicle presence detection and gap-out actuation at the stop line, while a curb-level water immersion module continuously tracks street flood levels.
* **Dual-Rail Auxiliary Power System (Diode-OR Failover):** Hardware-level Diode-OR power multiplexing combining primary 5V DC/USB power with an auxiliary 9V battery stepped down through an MB102 Power Supply Module via dual 1N4007 rectifier diodes, guaranteeing true 0 ms, zero-reboot failover during utility grid cuts.

### 2. Multi-Layered Graceful Degradation Hierarchy
Level 1 (Vision-Driven Adaptive) -> Level 2 (Stop-Bar Ultrasonic Presence Fallback) -> Level 3 (Deterministic Timer) -> Level 4 (Emergency Caution / Flashing Amber)

1. **Level 1 (Full Edge-AI Adaptive):** The camera feed delivers vehicle classification and count telemetry to optimize green light cycles dynamically.
2. **Level 2 (Optical Occlusion Fallback — Stop-Bar Presence Actuation):** If heavy rainfall, darkness, or lens debris obstructs the camera (heartbeat signal lost or low frame confidence), the ESP32 automatically shifts to hardware-actuated stop-bar presence and gap-out control via the curb HC-SR04 ultrasonic sensor, holding green while lead vehicles are detected and gapping out after 3 seconds of vacancy.
3. **Level 3 (Total Sensor Fault Isolation):** If external sensors become disconnected or unreadable, the internal firmware falls back instantly to a hardcoded deterministic timing cycle without freezing or crashing.
4. **Level 4 (MDRRMO Climate & Flood Mode):** When the curb sensor detects continuous flood immersion exceeding 5 seconds of debounced submersion, the controller immediately overrides standard phasing into Flashing Amber caution mode (continuous green evacuation corridors along designated routes are reserved exclusively for manual MDRRMO dashboard override).

### 3. Behavioral Compliance & Algorithmic Legitimacy Engine
* **Eliminating the "Ghost Red" Excuse:** Impatient drivers routinely run red lights when forced to idle at an empty cross-street, triggering social contagion non-compliance. By terminating green phases early on empty lanes and prioritizing active queues within seconds, the system provides algorithmic responsiveness that removes the psychological justification for jumping lights.
* **Automated Red-Light Crossing Snapshot Log:** Squad B's vision model monitors virtual Region of Interest (ROI) stop lines during red phases. Breaching vehicles trigger an automated snapshot event capturing the vehicle centroid, vehicle class, timestamp, and anonymized breach bounding box crop.
* **TODA Administrative Accountability & Privacy Roadmap:** In Catarman, franchised tricycles have prominent municipal body numbers. For the MVP academic demonstration, the system records anonymized violation telemetry (timestamps, vehicle class, and breach crops) in strict compliance with RA 10173 (Data Privacy Act of 2012). Direct municipal licensing registry linkage and automated TODA franchise violation auditing are established as a Phase 2 institutionalization roadmap, conditional upon a formal LGU Privacy Impact Assessment (PIA) per NPC Circular 16-01 and Sangguniang Bayan ordinance authorization.
* **Visual Countdown Predictability:** Integrating pedestrian/countdown displays eliminates driver ambiguity regarding upcoming phase shifts.

---

## Target Users

### Primary User Segment: Municipal Operations (POSO & MDRRMO)
* **Public Order and Safety Office (POSO):**
  * *Context:* Field enforcers stationed across Catarman commercial corridors (Public Market, Jacinto St., UEP corridors).
  * *Pain Points:* High hazard from heat and storm flooding; verbal confrontations during roadside apprehensions; zero automated data on peak traffic bottlenecks.
  * *Goals:* Automated physical intersection control, zero storm standing hours, and objective digital audit logs.
* **Municipal Disaster Risk Reduction and Management Office (MDRRMO):**
  * *Context:* Emergency dispatchers coordinating disaster response convoys and ambulances during monsoons and typhoons.
  * *Pain Points:* Convoys delayed by unmanaged gridlock at flooded junctions; lack of real-time street flood telemetry.
  * *Goals:* Instant automated clearing of designated evacuation corridors and real-time street-level flood hazard detection.

### Secondary User Segment: Motorists & Municipal Technicians
* **TODA Operators & Provincial Motorists:**
  * *Context:* Daily-wage transport operators whose income depends on turnaround time.
  * *Pain Points:* Excessive idling at empty cross-streets burning expensive fuel; chaotic un-signaled gridlock.
  * *Goals:* Responsive green lights that clear queues quickly and predictable countdown timers.
* **Municipal IT & Engineering Technicians:**
  * *Context:* Local government staff managing municipal digital assets.
  * *Pain Points:* Inability to service proprietary, multi-million-peso commercial DPWH controllers requiring Manila technicians.
  * *Goals:* Modular, open-source microcontroller architecture that can be repaired and reconfigured in-house.

---

## Goals & Success Metrics

### 1. Business & Municipal Objectives
* **Municipal Cost Reduction:** Deliver a functional prototype with a production-scale node bill of materials under ₱15,000, slashing the cost barrier compared to commercial DPWH turnkey installations (₱3M–₱6M per junction).
* **Zero-Downtime Utility Continuity:** Ensure 100% operational signal uptime during recurring NORSAMELCO distribution trips, NGCP transmission line brownouts, and severe weather cellular network drops.
* **Enforcer Safety:** Eliminate the requirement for POSO traffic enforcers to physically stand in flooded roadways during tropical downpours.
* **Actionable Municipal Traffic Intelligence:** Provide Catarman LGU with automated hourly throughput counts, peak congestion logs, and TODA violation audit records.

### 2. Key Performance Indicators (KPIs)
* **Edge Decision Latency:** < 200 ms inference-to-actuation latency between frame ingestion (via wired USB phone tethering), YOLOv8 detection, local MQTT arbitration, and ESP32 physical relay/LED actuation.
* **Power Grid Failover Interruption:** 0 ms / zero-reboot interruption during switchover between primary DC power and auxiliary battery reserves via hardware Diode-OR multiplexing.
* **Optical Occlusion Handover Time:** < 3 seconds (3 missing vision heartbeats) to transfer stop-bar presence and gap-out arbitration to the HC-SR04 ultrasonic sensor upon lens obstruction.
* **Flood Mode Trigger & Debounce Latency:** Exactly 5 to 10 seconds of sustained water sensor immersion before triggering MDRRMO Emergency Flashing Amber, preventing splash false positives.
* **Provincial Mixed-Traffic Detection Accuracy:** >= 85% classification accuracy across heterogeneous vehicle classes (tricycles, motorcycles, passenger cars, utility vans) on scale test footage.
* **Offline Telemetry Retention:** 100% retention of hourly vehicular counts and anonymized violation logs stored locally in edge SQLite/CSV storage during network drops.
* **Privacy Compliance:** 100% compliance with RA 10173 (Data Privacy Act of 2012) via anonymized breach event capture without PII/OCR processing.

---

## MVP Scope

### 1. Core Features (Must Have for December Pitch)
* **Edge Mixed-Traffic Profiling (Squad B):** Laptop-based YOLOv8 nano pipeline ingesting 1080p camera feed via direct wired USB tethering from a smartphone (bypassing venue Wi-Fi contention) to detect, count, and classify mixed vehicles across defined ROI stop lines.
* **Dynamic Green-Phase Allocation (Squad A & B):** Algorithmic green-phase extension and early truncation based on weighted PCU congestion scores.
* **Local Offline-First Telemetry Bridge (Squad A & B):** Local Mosquitto MQTT broker running over local LAN/hotspot, linking the Python computer vision node directly to the ESP32 master controller with < 200 ms latency.
* **Deterministic Embedded State Machine (Squad A):** Dedicated ESP32 firmware running autonomous timed signal phases, curb water sensor debouncing, and ultrasonic gap-out actuation with 0.96" OLED local status telemetry (utilizing an isolated Arduino UNO R3 strictly as an offline benchtop sensor test harness).
* **Optical Occlusion Handover (Squad A & B):** Automated fail-safe arbitration transferring control to HC-SR04 stop-bar vehicle presence and 3-second gap-out actuation if camera frames become occluded.
* **Catarman Gutter Flood Emergency Trigger (Squad A):** Curb-mounted water level sensor module with a 5-second software debounce overriding regular phasing into Flashing Amber caution mode upon submersion (continuous green disaster corridors reserved for manual dashboard override).
* **Brownout Dual-Rail Battery Failover Circuit (Squad A):** Hardware Diode-OR power multiplexing using two 1N4007 diodes and an MB102 Breadboard Power Supply Module with buffered filter capacitors, switching seamlessly between primary 5V DC and auxiliary 9V battery to validate zero-reboot execution during utility cuts.
* **Automated Red-Light Crossing Snapshot Log (Squad B & C):** Virtual stop-bar breach detection capturing timestamped frame snapshots of red-light violators with anonymized vehicle bounding-box crops in compliance with RA 10173.
* **Local Command Dashboard (Squad C):** Browser UI served locally, rendering live video inference frames, real-time intersection status, manual MDRRMO emergency override toggles, and hourly traffic peak bar charts.
* **Physical 4-Way Scale Diorama (Squad A & C):** Demonstration model constructed from local foam board, featuring mounted LED signal heads, vehicle approaches, curb water sensor, and stop-line ultrasonic transducers.

### 2. Out of Scope for MVP (Strictly Descoping for December Pitch)
* **Automated TODA Driver/Franchise Identification & OCR Database Matching:** Replaced by anonymized breach event crops and CSV exports pending municipal Privacy Impact Assessment.
* **ESP32-CAM or Wireless Video Ingestion Hardware:** Rejected in favor of zero-latency wired USB smartphone tethering to avoid courier delays, thermal throttling, and Wi-Fi congestion.
* **Radar-Calibrated Speed Measurement:** Replaced by a crossing-threshold speed alert mockup on the dashboard.
* **Cloud-Hosted Video Streaming & AWS/Firebase Backend:** All processing is restricted to localhost and local LAN to avoid school Wi-Fi throttling.
* **Mechanical Wind/Fan Testing:** Live handheld fan simulation during stage pitches is removed to avoid erratic mechanical vibrations.
* **Live Hardware Wire Yanking:** Physically pulling live jumper wires on stage is cut to protect breadboard rail stability.
* **Direct Municipal Database API Integration:** Simulated via local CSV violation exports.
* **Solar Panel Charging Hardware:** Physical photovoltaic charging cells replaced by dual-rail DC power switching.

---

## Post-MVP Vision

### 1. Phase 2 Features (Post-Event Municipal Hardening)
* **Industrial Hardware Transition & IP68 Weatherproofing:** Migrate from benchtop development boards to DIN-rail industrial ESP32 controllers (e.g., Norvi or KinCony PLCs) in NEMA 4X / IP66-rated pole-mounted enclosures, using IP67 waterproof ultrasonic sensors (JSN-SR04T) and industrial stainless-steel float switches.
* **220V AC Solid-State Relay (SSR) Integration:** Implement optically isolated high-voltage switching modules driving standard 220V AC, 50W municipal LED signal heads.
* **Calibrated Homography Velocity Estimation:** Implement camera perspective homography matrices to deliver reliable speed warning triggers along school approaches.
* **Automated TODA Franchise Audit Registry:** Build an automated batch-export bridge connecting violation snapshot logs directly to the Catarman Municipal Licensing Office (contingent upon a formal LGU Privacy Impact Assessment under NPC Circular 16-01 and Sangguniang Bayan ordinance).
* **Solar-Battery Islanding (Off-Grid Kit):** Integrate a 100W photovoltaic panel and 12V LiFePO4 battery pack with MPPT charge controller for multi-day off-grid operation during storms.

### 2. Long-Term Vision (1–2 Year Horizon)
* **Decentralized Arterial "Green Wave" Synchronization:** Deploy lightweight ESP-NOW or LoRaWAN mesh communication between adjacent intersections along primary thoroughfares (Jacinto St. and UEP road) without cellular coverage or fiber trenching.
* **MDRRMO River Basin Telemetry Integration:** Interconnect municipal traffic nodes with the Catarman River Flood Early Warning System (FEWS) to automatically lock high-ground evacuation routes during river swelling.

---

## Technical Considerations

### 1. Platform Requirements
* **Target Platforms:** Dual-tier edge architecture combining an embedded hardware runtime on a dedicated ESP32 Dev Board (with the kit Arduino UNO R3 utilized strictly as an offline benchtop test harness) with an edge compute host (student laptop running desktop Linux or Windows 10/11).
* **Browser/Display Support:** Web dashboard accessible via Chromium-based browsers running full-screen on the venue Smart TV.
* **Performance Requirements:** Sub-200 ms inference-to-actuation telemetry loop; >= 15 FPS sustained video inference using YOLOv8 nano; continuous offline operation.

### 2. Technology Preferences
* **Frontend:** Lightweight web dashboard built with HTML5, Tailwind CSS, and JavaScript, rendering real-time camera inference feeds and peak bar charts.
* **Backend:** Python edge server coordinating the computer vision stream with an embedded C++ firmware state machine compiled via PlatformIO / Arduino IDE on the ESP32.
* **Database & Storage:** Local SQLite database or flat CSV storage logging hourly vehicular counts and anonymized red-light breach event crops.
* **Hosting & Infrastructure:** 100% locally hosted on localhost and a private local Wi-Fi subnet; local Mosquitto MQTT broker managing message routing; smartphone video stream ingested via wired USB tethering.

### 3. Architecture Considerations
* **Repository Structure:** Single monorepo structured with isolated directories (`/firmware`, `/edge_vision`, `/dashboard`, `/docs`).
* **Integration Requirements:** Asynchronous pub/sub messaging via MQTT with direct USB Serial bridge as an instant wired fallback.
* **Security & Compliance:** Air-gapped local subnet preventing remote override; two-tier privacy framework where MVP computer vision processing retains only non-identifying vehicle class centroids, aggregate counts, and anonymized violation frame crops in compliance with RA 10173, while Phase 2 individual franchise tracking is gated behind an NPC-compliant Privacy Impact Assessment.

---

## Constraints & Assumptions

### 1. Constraints
* **Total Expenditure Ceiling:** Strict financial cap of <= ₱1,000 pooled across all 10 members, reserving funds exclusively for diorama craft supplies and incidental wiring.
* **Zero Procurement for Core Electronics:** Built exclusively from existing starter kit hardware (ESP32 Dev Board, Arduino UNO R3 kits, sensors, LEDs) and personal student laptops/smartphones.
* **Samar Courier Transit Latency:** 7-to-12-day courier transit time across the Matnog–Allen ferry crossing, mandating an absolute **Hardware Freeze Date** of October 20, 2026.
* **Timeline:** Mid-December 2026 event deadline (8-week engineering sprint).
* **Team Structure:** 10 fourth-year IT undergraduates divided into 3 functional squads (Squad A: 3, Squad B: 4, Squad C: 3).

### 2. Key Assumptions
* **Edge Laptop Processing Capability:** Student laptop capable of running YOLOv8 nano inference at >= 15 FPS alongside local Mosquitto MQTT and web dashboard servers without thermal throttling during the 20-minute presentation.
* **Smartphone Camera Utility:** Smartphone connected via wired USB tethering (e.g., DroidCam / scrcpy over USB) provides rock-solid 1080p feed stability at < 30 ms latency, eliminating 2.4 GHz venue RF congestion.
* **Judging Panel Priorities:** Judges (MDRRMO Head, EE Professor, DICT Representative, University ICT Director) prioritize local climate survivability and fail-safe degradation over theoretical cloud features.

---

## Risks & Open Questions

### 1. Key Risks
* **Edge Compute Thermal & Latency Degradation:** Sustained YOLOv8 nano inference on a student laptop may induce thermal throttling, dropping framerates below 10 FPS.
* **Venue RF Congestion:** Event venues create 2.4 GHz interference, risking dropped MQTT packets between the laptop and ESP32. *(Mitigation: Camera feed isolated to wired USB tethering; hardwired USB Serial fallback ready for MQTT within 30 seconds).*
* **Breadboard Jumper Wire Fatigue:** Diorama transportation risks loose jumper connections. *(Mitigation: Hot-glue stabilization on critical terminal rails).*
* **Battery Voltage Droop & Brownout Reset:** ESP32 Wi-Fi bursts draw peak currents that droop unbuffered 9V batteries. *(Mitigation: Dual-rail Diode-OR circuit utilizing MB102 Breadboard Power Supply Module with onboard 100 µF filter capacitors and 1N4007 diodes to buffer transient current spikes, verified live with multimeter).*

### 2. Open Questions & Research
* **Venue Display Cable:** Verification of direct HDMI cable access from laptop to the Smart TV display.
* **Scale Markers:** Selection of uniform scale toy vehicles representing tricycles, motorcycles, and passenger cars for consistent YOLO detection.
* **RA 10173 Privacy Alignment:** Resolved via Two-Tier Architecture: MVP operates as an anonymized academic proof-of-concept without PII/OCR, while Phase 2 institutionalization requires Catarman LGU DPO clearance and a formal Privacy Impact Assessment (PIA).

---

## Appendices

### A. Technical Addendum
* Detailed kit inventories, Diode-OR power schematics, ESP32 pin mappings, NEMA TS2 traffic engineering comparisons, and rejected hardware alternatives are maintained in the companion document: [Project Addendum](addendum.md).

### B. Stakeholder Input
* **POSO:** Enforcers abandon posts during severe downpours for personal safety, leaving intersections unregulated.
* **MDRRMO:** Unmanaged traffic gridlock at flooded junctions obstructs emergency evacuation convoys.
* **TODA Federation:** Compliance improves when signals eliminate empty "ghost red" idle delays and provide countdown clocks.

### C. References
* Republic Act 10173 (Data Privacy Act of 2012)
* National Privacy Commission (NPC) Circular 16-01 & Advisory 2020-04
* NEMA TS2 Traffic Controller Assembly Standards
* DPWH Highway Safety Design Standards Manual
* Ultralytics YOLOv8 Documentation
* Espressif ESP32 Technical Reference Manual

---

## Next Steps

### 1. Immediate Actions
1. **Audit & Hardware Freeze (October 20, 2026):** Catalog all team starter kits and execute one consolidated order (<= ₱350) for extra jumper wires and diorama foam board supplies.
2. **Repository & Interface Contracts (Week 1):** Initialize GitHub monorepo and lock JSON MQTT schema between Squads A, B, and C.
3. **Firmware State Machine MVP (Squad A — Weeks 1–2):** Program ESP32 default cycles, 5-second water sensor debounce, and ultrasonic gap-out actuation (using Uno R3 as offline benchtop harness).
4. **YOLOv8 Edge Vision Pipeline (Squad B — Weeks 1–2):** Configure YOLOv8 nano for mixed-vehicle stop-line counting and PCU weighting.
5. **Local Dashboard UI (Squad C — Weeks 1–2):** Scaffold offline dashboard for camera views, hourly peak charts, and emergency override.
6. **Physical Scale Diorama Build (Squad A & C — Weeks 3–4):** Build 4-way foam-board diorama with mounted LEDs and sensors.
7. **Fail-Safe Integration & Stress Testing (All Squads — Weeks 5–6):** Test Airplane Mode sever, camera lens occlusion, and gutter flood water immersion.
8. **Live Stage Pitch Rehearsals (Weeks 7–8):** Rehearse the 10-minute presentation and 10-minute Q&A against the four judge personas.

### 2. PM Handoff
This Project Brief provides the complete context for the Catarman LGU Climate-Resilient SMART Traffic Light. Please start in 'PRD Generation Mode', review the brief thoroughly to work with the user to create the PRD section by section as the template indicates, asking for any necessary clarification or suggesting improvements.
