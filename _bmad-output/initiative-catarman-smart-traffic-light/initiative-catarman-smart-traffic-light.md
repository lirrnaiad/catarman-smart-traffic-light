---
type: initiative
title: Catarman SMART Traffic Light
parent: none
---

## Notes

- Parked: CAP-7 to CAP-20 (M2, December pitch) are not sliced yet. That covers live video, live telemetry with the countdown, power source and boot count, the CSV export, the speed alert mockup, polish, and the Squad A and B capabilities, plus AD-19's retention purge and the hotspot broker mode. They get their own epic or epics after M1 is submitted (user, 2026-10-23).
- Decision: the platform baseline (S0 and the three package cores) opens epic 1, M1 Midterm prototype, as its first stories (spine AD-14), instead of being an epic of its own (user, 2026-10-23).
- Source conflict (M2, for bmad-spec): EXPERIENCE.md Component Patterns, Link health bar — the power source shows in the link health bar as "Power · USB / Battery", vs spine AD-14, where the CAP-8 story mounts `power-source.tsx` on `/` and the header stays as the shell built it. M1 renders neither.
