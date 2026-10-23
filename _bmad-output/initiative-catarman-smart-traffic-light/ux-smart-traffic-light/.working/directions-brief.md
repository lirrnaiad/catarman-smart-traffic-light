# Design directions brief (shared by every direction renderer)

## The product

Catarman SMART Traffic Light: an edge-only adaptive traffic signal for Catarman, Northern Samar (Philippines). An ESP32 runs the signals of one 4-way intersection (INT-01, a scale diorama). A camera vision node counts mixed traffic (tricycles, motorcycles, cars, jeepneys, utility vans). The dashboard is the operator screen for POSO traffic enforcers and MDRRMO disaster dispatchers. It shows on a venue Smart TV, full-screen Chromium at 1920×1080, during a pitch to judges (MDRRMO head, DICT, EE professor, university ICT director). The midterm (Oct 26) runs on simulated data.

## The user's direction (binding)

- A strongly traffic-light-themed dashboard, centered on red, yellow and green.
- The loader is an animation flashing red, then yellow, then green, in sequence.
- For the midterm, a few simple animations are enough, as long as the theming is solid.

## Hero screen to render: live status (`/`), 1920×1080, no page scroll

Use this real content (no lorem):

- **Header:** "Catarman SMART Traffic Light" · intersection "INT-01" · link health: Broker CONNECTED, Controller ONLINE (sim), Vision ONLINE (sim). Navigation: Live, Traffic peaks, Breaches, Override log, State history.
- **Signal state:** Phase NS = GREEN, Phase EW = RED. North and South heads share NS; East and West share EW. A countdown for the running interval: green in L1/L2 shows "up to 14 s" (it can end early); yellow, all-red and L3 counts are exact ("3 s").
- **Degradation level:** L1 Vision adaptive (current). The ladder: L1 Vision adaptive · L2 Stop-bar presence · L3 Fixed timing · L4 Flashing Amber (flood). L1–L4 must look visually distinct. A conflict fault shows as a separate FAULT state, never as L4.
- **Flood sensor:** DRY (others: WET = immersion seen, debounce running; FLOODED = L4 cause).
- **PCU demand per approach** (passenger-car units currently waiting in each approach's zone): N 2.5 · S 0 · E 1.0 · W 0.5.
- **Vehicle counts this hour, per approach × class:** classes are Car, Tricycle, Motorcycle (incl. habal-habal), Jeepney, Utility van. Example totals this hour: N — car 14, tricycle 31, motorcycle 22, jeepney 3, utility van 4; S — car 9, tricycle 18, motorcycle 17, jeepney 2, utility van 1; E — car 11, tricycle 26, motorcycle 19, jeepney 0, utility van 3; W — car 6, tricycle 12, motorcycle 9, jeepney 1, utility van 2. Hour total 210.
- **MDRRMO override panel:** buttons "Flashing Amber", "Evacuation corridor — NS", "Evacuation corridor — EW", "Release to automatic". Every override asks for confirmation first. Show current override: none.
- **Latest breach** (red-light running, anonymized): 14:32:08 · East approach · Motorcycle · small blurred crop thumbnail (a gray blurred box is fine).

## Also show (below or beside the hero artboard, smaller)

1. **The loader**: red → yellow → green flashing in sequence, in this direction's style (CSS keyframes only).
2. **One state variant**, as a second smaller artboard or panel: L4 Flashing Amber (flood mode: Flood FLOODED, both phases flashing amber, animated), OR the "stale" state (controller link lost: last values kept but visibly marked STALE, countdown hidden).
3. **Override confirm dialog**: "Activate evacuation corridor NS? All other approaches go red. MDRRMO only." with Confirm / Cancel.

## Design constraints every direction must respect

- **Signal semantics stay readable.** Red, yellow and green also mean real signal aspects (RED, YELLOW/FLASHING_AMBER, GREEN) and states. The theme may use them boldly, but an operator must never confuse a decorative red with "signal is red" or "alarm". Show how this direction keeps them apart. Note your approach in the rationale.
- **Color-blind safety:** lamps keep traffic-light position order (red top, yellow middle, green bottom) and every state also has a text label, so color is never the only cue.
- **TV legibility:** readable from 3–4 m: large numerals, high contrast.
- **Motion:** a few simple CSS animations only (the loader, lamp glow, flashing amber in L4). Wrap every animation in `@media (prefers-reduced-motion: no-preference)`.
- **Tech:** one self-contained HTML file: inline CSS, system font stack only (no web fonts, no network, no images; draw lamps, intersection and icons with CSS or inline SVG), no JavaScript. Document every concrete hex value in a `<style>` comment at the top, grouped as tokens (e.g. `--signal-red`, `--surface`, `--text`). The real build uses Tailwind v4 `@theme` tokens, so name tokens semantically.
- **Page layout:** at the top, a slim strip with the direction name and a 2–3 sentence rationale. Then the hero as a fixed 1920×1080 artboard at native size (the user zooms with Ctrl+minus if needed). Then the extras below it.
