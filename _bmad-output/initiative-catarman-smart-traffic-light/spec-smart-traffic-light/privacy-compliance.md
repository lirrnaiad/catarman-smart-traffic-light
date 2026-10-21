# Privacy Compliance (RA 10173)

Capturing tricycle municipal body numbers to sanction franchised operators is automated PII processing under RA 10173, the Data Privacy Act of 2012. It also falls under NPC Advisory 2020-04 (CCTV systems) and NPC Circular 16-01 (personal data security in government agencies).

## Tier 1: both milestones (binding)

Privacy-by-design. The only data that may be stored, shown or exported (CAP-6, CAP-9, CAP-13):

- breach event timestamp
- detected vehicle class (e.g. `TRICYCLE`, `MOTORCYCLE`) and centroid
- anonymized bounding-box frame crop
- aggregates: hourly vehicle counts, violation counts per approach, red-light running frequency

Forbidden: OCR, driver face identification, body-number or plate reading, and database cross-referencing.

## Tier 2: Phase 2 municipal institutionalization (out of scope)

These are prerequisites before any franchise-level tracking. They are delivered to Catarman LGU as a roadmap only.

1. An LGU-led Privacy Impact Assessment (PIA), approved by the Catarman Data Protection Officer (DPO), under NPC Circular 16-01.
2. A Sangguniang Bayan ordinance that authorizes automated traffic-violation auditing and sets public data-subject notices.
3. Encryption at rest for violation audit logs, with role-based access control (RBAC).

## References

RA 10173; NPC Circular 16-01; NPC Advisory 2020-04; NEMA TS2 Traffic Controller Assembly Standards; DPWH Highway Safety Design Standards Manual; Ultralytics YOLOv8 documentation; Espressif ESP32 Technical Reference Manual.
