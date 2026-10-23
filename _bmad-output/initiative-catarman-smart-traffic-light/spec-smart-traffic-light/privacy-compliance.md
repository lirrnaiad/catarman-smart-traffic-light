# Privacy Compliance (RA 10173)

Capturing tricycle municipal body numbers to sanction franchised operators is automated PII processing under RA 10173, the Data Privacy Act of 2012. It also falls under NPC Circular 2024-02 (CCTV Systems, in effect Aug 27, 2024) and NPC Circular 16-01 (personal data security in government agencies). Circular 2024-02 is the governing CCTV framework. It modifies NPC Advisory 2020-04 without expressly repealing it, so the advisory's consistent parts survive as guidance.

## Tier 1: both milestones (binding)

Privacy-by-design. The only data that may be stored, shown or exported (CAP-6, CAP-9, CAP-13):

- breach event timestamp
- detected vehicle class (e.g. `tricycle`, `motorcycle`) and centroid
- anonymized bounding-box frame crop
- aggregates: hourly vehicle counts, violation counts per approach, red-light running frequency

Forbidden: OCR, text detection (including finding a body number in order to mask it), driver face identification, body-number or plate reading, and database cross-referencing.

### Crop anonymization

- The vision node degrades the whole crop before JPEG encoding: it scales the crop so its long side is at most 64 px, then blurs it. Nothing locates text first.
- **Acceptance test:** a printed body-number sticker on a toy tricycle (`hardware.md`) is unreadable in the stored crop, while the vehicle class stays recognizable.
- 64 px is also the crop pixel cap the backend checks (spine AD-11). The backend checks size only; the blur is proven by the sticker test.

### Retention

| Data | Kept for | Basis |
|---|---|---|
| Anonymized breach crops | 21 days | The only data that could identify anyone. Fits the 3-week maximum that DILG MC 2022-060 §4.4.2 reportedly sets for LGU CCTV footage. |
| Breach rows (no image), signal-state changes, override log | 1 year | Annual planning and MDRRMO audits. |
| Vehicle counts | Indefinitely | Aggregates, not personal data. |

- A daily backend job deletes expired rows by their stored timestamps.
- The NPC sets no fixed period: footage is kept only as long as its purpose needs, and storage capacity alone may not decide it (NPC Circular 2024-02).

### Access

There is no operator login. Overrides and data come only from the edge laptop: the backend accepts local connections only, and the broker gets a password and an ACL before it listens on the hotspot (kernel Constraints). Role-based access is Tier 2.

## Tier 2: Phase 2 municipal institutionalization (out of scope)

These are prerequisites before any franchise-level tracking. They are delivered to Catarman LGU as a roadmap only.

1. An LGU-led Privacy Impact Assessment (PIA), approved by the Catarman Data Protection Officer (DPO), under NPC Circular 16-01.
2. A Sangguniang Bayan ordinance that authorizes automated traffic-violation auditing and sets public data-subject notices.
3. Encryption at rest for violation audit logs, with role-based access control (RBAC).

## References

RA 10173; NPC Circular 16-01; NPC Circular 2024-02 (CCTV Systems); NPC Advisory 2020-04; DILG Memorandum Circular 2022-060, cited in Privacy.ph Collective, *CCTV Systems and Data Protection* (2024); NEMA TS2 Traffic Controller Assembly Standards; DPWH Highway Safety Design Standards Manual; Ultralytics YOLOv8 documentation; Espressif ESP32 Technical Reference Manual.
