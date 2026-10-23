---
name: Catarman SMART Traffic Light Dashboard
status: final
created: 2026-10-22
updated: 2026-10-23
sources:
  - ../spec-smart-traffic-light/spec-smart-traffic-light.md
  - ../architecture-smart-traffic-light/architecture-smart-traffic-light.md
---

# Catarman SMART Traffic Light Dashboard — Experience Spine

How the operator dashboard works. Visual identity and tokens live in `DESIGN.md`. Compositions: [`mockups/live-status.html`](mockups/live-status.html), [`mockups/traffic-peaks.html`](mockups/traffic-peaks.html), [`mockups/breach-log.html`](mockups/breach-log.html), [`mockups/override-log.html`](mockups/override-log.html), [`mockups/state-history.html`](mockups/state-history.html). **This spine and `DESIGN.md` win over any mock.**

## Foundation

- **Form factor:** a single 1920×1080 venue Smart TV running full-screen Chromium. The edge laptop drives it over HDMI; if HDMI fails, the laptop screen is mirrored over Miracast, never opened in the TV's own browser, so the backend stays local-only. `/` fits without page scroll.
- **Input:** the edge laptop's keyboard and pointer. Only that laptop can reach the backend, so it is the only place an override can come from. There is no login.
- **Build:** a static Next.js export (`output: 'export'`, `trailingSlash: true`), served same-origin by Express in demo mode. No route handlers, server actions, rewrites, cookies or dynamic routes; parameters are query strings read inside `<Suspense>`. No remote assets, CDN scripts or web fonts (spine AD-9).
- **UI system:** our own Tailwind v4 atoms (`LevelBadge`, `AspectLamp`, `StaleBadge`, `ClassLabel`, `ConfirmDialog` in `src/components/ui/`, owned by the shell). There is no UI kit in M1. Charts use Recharts. Enum colors and labels come only from `src/lib/visuals.ts`; displayed times come only through `src/lib/time.ts` (`formatManila`, `manilaHourLabel`, Asia/Manila through `Intl`).
- **Data:** live data through `LiveProvider` (SSE); history through `src/lib/api/<resource>.ts` inside `useEffect`. No SWR, TanStack Query, Redux or Zustand in M1.
- **Milestones:** M1 (Oct 26) runs on simulated telemetry and covers CAP-1 to CAP-6. M2 (December pitch) adds live telemetry with the countdown and power source (CAP-8), live video (CAP-7), CSV export (CAP-9), the speed alert mockup (CAP-10) and polish with animation (CAP-11).

## Information Architecture

| Route | Tab | Shows | Owner | Data |
|---|---|---|---|---|
| `/` | Live | Signal state and countdown, degradation ladder, flood sensor and conflict fault, top-down intersection with heads and PCU, vehicle counts this hour, latest breach, MDRRMO override panel | CAP-3; CAP-5 adds the override panel from `components/override/`; CAP-10 adds the speed alert line (M2) | SSE slices `link`, `state`, `counts`, `demand`; occurrences `breach`, `override`, `speedAlert`; `POST /api/overrides` |
| `/traffic/` | Traffic peaks | Hourly peaks chart for one Asia/Manila day | CAP-4 | `GET /api/counts/hourly?date=YYYY-MM-DD` (24 buckets) |
| `/breaches/` | Breaches | Red-light breach log | CAP-6 | `GET /api/breaches` (`Page<BreachItem>`), SSE `breach`, `GET /api/breaches/:id/crop` |
| `/log/overrides/` | Override log | Override commands and their outcomes | CAP-5 | `GET /api/overrides` (`Page<OverrideCommand>`), SSE `override` |
| `/log/states/` | State history | Signal-state changes | CAP-2 | `GET /api/state-changes` (`Page<StateChangeItem>`, shape set by the CAP-2 story) |

- Every route carries the top bar (brand, INT-01 plate, the five tabs) and the link health bar.
- There are no other routes. Deep links are query strings: `/breaches/?id=…` opens on that breach, and `/traffic/?date=…` picks a day.
- Modals stack one level deep: `ConfirmDialog` is the only one.

## Voice and Tone

Microcopy. The brand posture lives in `DESIGN.md` → Brand & Style. Labels are uppercase stencil; one sentence-case line appears in dialogs.

| Do | Don't |
|---|---|
| Level names exactly: "L1 Vision adaptive", "L2 Stop-bar presence", "L3 Fixed timing", "L4 Flashing Amber" | "Queue mode", "queue length", or anything that calls L2 queue measurement |
| Aspect words beside every lamp: "Green", "Yellow", "Red", "Flashing amber" | A lit lamp with no word |
| "Up to 14 s" plus "Green can end early" for an L1 or L2 green; "3 s" for yellow, all-red and any L3 interval | "14 s" for a green that can end early |
| "No countdown while flashing" | "0 s", or a frozen number on stale data |
| "Conflict fault · None"; on a fault, "FAULT · Conflict monitor" and "Reset at the controller box" | "L4" or "Flood" for a fault; any reset button |
| "Activate evacuation corridor NS?" · "All other approaches go red." · "MDRRMO only." | "Are you sure?" |
| "Pending · waiting for controller" | "Corridor NS active" before `state.override` reports it |
| "Rejected · Controller offline", "Rejected · Conflict fault"; an unknown code shows raw: "Rejected · SOME_CODE" | "Error", "Something went wrong" |
| "No reply from controller in 5 s" | "Failed": TIMEOUT is not terminal |
| "Stale · 14:32:08" (time of the last update) | Blanking a panel or showing "—" in place of its last value |
| "14:32:08 · East approach · Motorcycle", "Red-light running · anonymized", "Blurred" | A plate, body number, face, driver or name, or anything else that identifies a person |
| "Sim" tag and "Data source · simulated (midterm)" | Presenting simulated data as live |
| Speed alert (M2): "Faster than threshold" and "Uncalibrated mockup"; times in ms or s | A speed in km/h |
| 24-hour Asia/Manila times, "14:32:08" | UTC, offsets, or the browser's local zone |
| Loader: "Loading" · "Connecting to INT-01" | Spinners with no words |
| Empty states that name the fact: "No breaches recorded.", "No overrides yet.", "No vehicles counted." | Exclamation marks, emoji, cheerleading |

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md` → Components.

| Component | Where | Behavioral rules |
|---|---|---|
| Nav tab | Top bar, every route | Static links to the five routes; the current route gets `aria-current="page"`. |
| Link health bar | Every route | Reads the `link` slice. One Status pilot per role (Broker, Controller, Vision), with its status word from `visuals.ts`. A Sim tag shows when `source` is `sim`. In M2 the power source (`state.power`) shows here as "Power · USB / Battery". |
| Phase card, Signal head, AspectLamp | `/` left column and map | The aspect is `state.signals.NS` or `state.signals.EW`. The N and S heads mirror NS; E and W mirror EW. Exactly the reported lens lights. See Signal Semantics. |
| Countdown | `/` signal state panel; map sub-lines | Counts down locally from `state.remainingS` (Live Data & Staleness). Hidden with no `remainingS` or while the controller is STALE. M2 only (CAP-8): M1 builds no countdown, per spine AD-14, even though the hero mock shows one. |
| Degradation ladder, LevelBadge | `/` left column | The current rung is `state.level`. Neither a fault nor an override moves it, because `state.level` keeps reporting the automatic level. |
| Flood selector | `/` left column | One cell on, from `state.flood`: DRY, WET (debounce running) or FLOODED (the L4 cause). Read-only. |
| Fault row | `/` left column | Reads `state.fault`; true shows FAULT. It has no control: a fault clears only at the controller-box reset button. |
| Intersection map, PCU tag | `/` center | PCU per approach from `demand.pcu`, shown as received, never computed here (spine AD-12). Zero dims. |
| Counts table, ClassLabel, Hour total | `/` right column | The `counts` slice is `HourCounts` for the current Asia/Manila hour. Columns follow `useVehicleClasses()` in file order; ClassLabel shows the file's label, or the raw id for an unknown id. The total is `counts.total`. The table resets when the backend pushes the new hour. An unknown class id adds a column. |
| Latest breach card | `/` right column | Loads `GET /api/breaches?limit=1` on mount and on each stream epoch, then each SSE `breach` replaces it. Shows `occurredAt`, approach, class and the crop from `apiUrl(cropUrl)`. Clicking it opens `/breaches/?id=…`. |
| MDRRMO override panel, Override button | `/` right column | A click opens ConfirmDialog. Confirm sends `POST /api/overrides` with `{mode, phase?}`; Release sends `{mode: "NONE"}` and is confirmed too. While a command is REQUESTED, the four buttons are disabled; they re-enable on APPLIED, REJECTED or TIMEOUT. The Current override plate reads only `state.override`, never the command status. |
| ConfirmDialog | Over `/` | Modal and focus-trapped. Cancel holds focus on open. Esc equals Cancel. Confirm is disabled after the first press until the POST returns, since the dashboard cannot dedupe without minting ids. |
| State banners | `/`, link health bar right end | L4 shows while `state.level` is L4; Override while `state.override.mode` is not NONE; FAULT while `state.fault` is true. Several can show at once. |
| StaleBadge | Title of every panel fed by a STALE role | Shows while `useLiveness(role)` is STALE, with the last update time. |
| Loader | Full screen | Shows until the first SSE frame arrives. |
| Hourly chart | `/traffic/` | Loads the day on entry and on each stream epoch: 24 bars labeled by `manilaHourLabel`, with the peak hour flagged. For today, the current hour's bar follows the live `counts` slice. Day navigation via `?date=`. |
| Breach log | `/breaches/` | Newest first. Upserts SSE `breach` by `id` at the top. "Load more" follows `nextCursor` (limit 50). Each row shows `occurredAt`, approach, class and the crop. `?id=` scrolls to and marks that row. |
| Override log | `/log/overrides/` | Newest first. Upserts SSE `override` by `commandId`, so a REQUESTED row turns APPLIED in place, and a TIMEOUT row resolves later if the controller answers. Shows mode and phase, status, the reason label, `requestedAt` and `resolvedAt`. A command that ended on its own does not appear here; it appears in State history. |
| State history | `/log/states/` | Newest first, from `receivedAt`: level, NS and EW aspects, flood, fault, override mode and phase. A `{NONE, X}` row where X was not a release reads "Override ended (link loss or fault)". Refetches page 1 on each stream epoch; it does not append live. |
| Speed alert line (M2) | `/` only | One transient line per SSE `speedAlert`: approach, class, time and "faster than threshold", labeled an uncalibrated mockup. `elapsedMs` and `thresholdMs` may show as times, never as a speed. Never stored. How long it stays is not yet set. |
| Live video (M2) | Not yet placed | CAP-7's annotated frames from the vision node: the one data source outside `src/lib/api/` and `LiveProvider` (AD-9). Its place on the no-scroll `/` is not designed yet. |
| CSV export (M2) | `/breaches/` | Exports every stored breach with Tier 1 fields only (CAP-9). |

## State Patterns

| State | Trigger | Treatment |
|---|---|---|
| Connecting | No SSE frame yet | Loader. |
| No value yet | A slice arrives as `null` | The panel shows "No data yet" in place of values. |
| Live | `useLiveness(role)` is LIVE | Normal rendering. |
| Controller stale | `useLiveness('controller')` is STALE | Signal state, ladder, flood, fault, map heads and the Current plate keep their last values under a StaleBadge. Lenses stay lit without glow. The countdown hides. Override buttons stay enabled; the backend decides and answers 409 if the controller is offline. |
| Vision stale | `useLiveness('vision')` is STALE | PCU tags, counts and the latest breach keep their last values under a StaleBadge. |
| Stream lost | The `EventSource` drops | Every role goes STALE. The browser reconnects after 2 s (`retry: 2000`); on reconnect the stream epoch increments and history views refetch page 1. |
| L1, L2, L3 | `state.level` | The ladder's current rung moves. L3 counts every interval exactly ("N s"). |
| L4 Flashing Amber | `state.level` is L4 | L4 rung and banner; flood FLOODED; every head flashes amber; flood-water hatch on the map; "No countdown while flashing". |
| FAULT | `state.fault` is true | FAULT banner and fault row. The heads show FLASHING_AMBER as reported, and the ladder keeps the automatic level. Corridor commands will be rejected with CONFLICT_FAULT. There is no reset control. Never rendered as L4. |
| Override pending | An `OverrideCommand` is REQUESTED (202 or SSE) | The pressed button reads "Pending · waiting for controller". Current does not change. |
| Override active | `state.override.mode` is not NONE | The Current plate shows the mode and phase, and the override banner shows. The level is displayed separately. |
| Override rejected | The command is REJECTED (409 or SSE) | A failure notice in the panel, with the reason label from `visuals.ts`. |
| Override timeout | The command is TIMEOUT | A failure notice. If a later ack or state resolves the command, the notice clears and Current follows `state.override`. |
| Override ended on its own | `state.override` is `{NONE, X}` and X was not a release | Current returns to "None", with a notice "Corridor ended — link loss or fault". |
| Flood WET | `state.flood` is WET | The WET cell is on; the note reads "immersion seen, debounce running". |
| Empty history | A page with no items | One empty-state line (Voice and Tone). |
| REST failure | `ApiError` from a history call | An inline notice with the code's label in that view; live panels are unaffected. |
| Crop absent | `cropUrl` is null, the crop returns 404, or it was purged after 21 days | The thumb shows the placeholder with "No crop". Breach rows outlive crops (1 year against 21 days). |
| Unknown id | An unknown vehicle class or rejection reason | Shown raw, in the neutral class color. |
| Simulated source | `link.controller.source` or `link.vision.source` is `sim` | Sim tags in the link health bar. |

## Interaction Primitives

- **Click, or Enter/Space on focus,** is the only action. All actions live in the override panel on `/`; everything else is read-only.
- **Navigate** with the tabs; the browser's Back works across the static routes.
- **Tab order** follows reading order: top bar, link bar, left column, center, right column.
- **History routes** list newest first and page with "Load more"; they may scroll vertically.
- **No hover-only information:** the TV audience cannot see a hover.
- **Banned:** WebSockets and polling for live views; reloading to refresh; page scroll on `/`; login screens; remote override; any fault-reset control; client-minted UUIDs (key on the server's `id` and `commandId`); a second modal over ConfirmDialog; dynamic routes.

## Accessibility Floor

Behavioral. Contrast ratios live in `DESIGN.md` → Colors.

- **Color is never the only cue.** Every lit lens has its word beside it, and lamps keep the red-top, yellow-middle, green-bottom order. L1–L4 differ by pattern, icon and name. Hazard zones carry text. Pilots carry status words.
- **Reduced motion:** every animation sits inside `@media (prefers-reduced-motion: no-preference)`. Under `reduce`, Flashing Amber shows a steady lit yellow lens labeled "Flashing amber", the loader shows an unlit head with its words, and lit lenses stop breathing.
- **Flash rate:** the amber flash runs at 1 Hz, under the three-flashes-per-second limit (WCAG 2.3.1).
- **Keyboard:** every control is focusable, with the visible `{components.focus-ring}` (`{colors.focus}`). ConfirmDialog is `role="dialog"`, `aria-modal="true"` and `aria-labelledby` its title; it traps focus, opens on Cancel, and returns focus to the button that opened it.
- **Semantics:** each signal head is `role="img"` with an `aria-label` such as "North head: green"; the link health bar is `role="status"`; panels are labeled sections; tables use header cells.
- **Announcements:** override status changes (pending, applied, rejected, timeout) and STALE transitions are announced through a polite live region.
- **Distance legibility:** load-bearing values are 20px or larger (`DESIGN.md` → Typography), and `{colors.text-3}` never carries state.
- **Target:** WCAG 2.2 AA.

## Signal Semantics

What each value from the controller looks like. The colors are `DESIGN.md` tokens, resolved through `visuals.ts`.

| Data | Display |
|---|---|
| `GREEN` | Green lens lit and glowing; "Green" in `{colors.signal-green}` |
| `YELLOW` | Yellow lens lit; "Yellow" in `{colors.signal-yellow}` |
| `RED` | Red lens lit; "Red" in `{colors.signal-red}`. Both phases RED is the all-red clearance. |
| `FLASHING_AMBER` | Yellow lens flashing; "Flashing amber" in `{colors.signal-yellow}`; no countdown |
| `DARK` | No lens lit; "Dark" in `{colors.text-2}` |
| `state.level` | LevelBadge pattern on the ladder, never a signal color; L4 uses matte hazard stripes |
| `state.fault` | FAULT: its own banner and row, never L4 |
| `state.override` | The Current plate and the override banner, separate from the level |
| `state.flood` | The flood selector; FLOODED carries a hazard edge |
| `link` | Steel blue square pilots (`{colors.status-ok}`), with words |

- **Glow means live.** Red, yellow and green glow only as a live lens or the aspect label beside it.
- **Hazard paint means attention:** INT-01 is out of automatic (override panel and dialog), flooded (L4) or faulted. It is matte, striped and rectangular.
- **Nothing else borrows a signal hue:** not vehicle classes, charts, command statuses, errors or link health.
- **Phase to heads:** NS drives the North and South heads; EW drives East and West.

## Live Data & Staleness

- **One stream:** `LiveProvider`, mounted once in the root layout, opens the tab's only `EventSource` on `GET /api/stream`. There are no WebSockets, no polling and no reloads.
- **Slices** (`link`, `state`, `counts`, `demand`) carry the full value on every frame, and views replace them, never merge. On connect they arrive in that order; `null` means no value yet.
- **Occurrences** (`breach`, `override`, `speedAlert`) arrive once each through `useLiveEvent`. Views upsert them by `id` (breach) or `commandId` (override).
- **Epoch:** `useStreamEpoch()` increments on every connect and reconnect, and history views refetch REST page 1 when it does.
- **Staleness:** a role is LIVE only while the stream is open, `link.broker` is CONNECTED and `link.<role>` is ONLINE. Views read this only through `useLiveness(role)`. The backend marks the controller STALE after 5 s of silence and vision after 3 s. A stale view keeps its last value and marks it; it never blanks.
- **Roles to panels:** controller → signal state, countdown, ladder, flood, fault, map heads, Current override; vision → PCU, counts, latest breach.
- **Countdown:** shows `max(0, remainingS − ⌊(now − receivedAt) / 1000⌋)`, ticking locally and resyncing on every `state`. It hides when `remainingS` is absent or the controller is STALE: a timer isn't a value, so keep-last-value doesn't apply. A retained `state` arrives without `remainingS`, so the countdown waits for the next live frame.
- **Latency:** a state change shows within 1 s without a reload (CAP-3); the backend writes it to SSE within 250 ms of receipt.
- **Times:** breaches show `occurredAt` (the vision event's own time); the override log shows `requestedAt` and `resolvedAt`; state history shows `receivedAt`. All go through `formatManila`.
- **Ids:** the dashboard never mints UUIDs.
- **Privacy:** only Tier 1 data reaches the screen: timestamp, vehicle class, centroid, anonymized crop and aggregates. No OCR text, plate, body number, face, driver identity or track id appears anywhere. Speed alerts are transient and never stored.

## Motion

M1 ships only these animations. Everything else snaps.

| Animation | Where | Spec | Under `reduce` |
|---|---|---|---|
| R→Y→G loader | Loader | A 3 s cycle: each lens is lit for its first second, staggered 0 / 1 / 2 s, red first. "Loading" fades between 100% and 55% opacity over 1.5 s. | An unlit head with its words |
| Lamp glow | Every lit lens | Brightness 1 → 1.14 → 1 over 3.2 s, ease-in-out | Steady lit |
| Flashing amber | The yellow lens under FLASHING_AMBER | 1 s linear: on for 0–46%, off (4% opacity) for 52–96% | Steady lit, with the label |

- The dashboard's amber flash is a CSS rhythm, not synchronized with the physical LEDs.
- Hazard stripes, banners and panels never animate in M1.
- **M2 (CAP-11):** phase, level, override and new-breach changes animate instead of snapping. The animation library is deferred; it must ship without remote assets (AD-9), follow the visuals convention, and sit inside `prefers-reduced-motion: no-preference`.

## Responsive & Platform

- **TV only:** 1920×1080 full-screen Chromium. No breakpoints, no phone or tablet layout, no light theme.
- `/` never scrolls. Other routes may scroll vertically.
- On a smaller development screen, use browser zoom; the layout does not reflow.
- The screen path is HDMI from the laptop, with a Miracast mirror as fallback, never the TV's browser. Whether the venue TV's HDMI input works is an open question in the spec, due to be tested by mid-November.

## Inspiration & Anti-patterns

- **Lifted from control-room research:** one overview for situational awareness, plus an event list and an action log. These became `/`, `/breaches/` and `/log/overrides/`.
- **Lifted from converge.ai's "Cinematic Smart City Traffic Dashboard":** a dark canvas in three panels with the map at the center. Status color moved into the lamps alone.
- **Lifted from CSS traffic-light loaders:** lamps lit in sequence with staggered keyframes.
- **Context:** no dedicated traffic-light-themed dashboard was found. The nearest (Dribbble's "Traffic Control System" dark UI kit, "Urban Traffic x FUI") informed the dark posture. Their sidebar was not lifted; the direction uses top tabs.
- **Not chosen:** Control Room HUD (neon line work, monospace), Road Sign (asphalt, sign plates) and Color Block (light canvas, pill chips).
- **Rejected:** decorative red, yellow or green; red, yellow or green status dots; yellow road paint; a UI kit in M1; WebSockets or polling; any identifying data on screen.

## Key Flows

### Flow 1 — Evacuation corridor in a typhoon flood (MDRRMO dispatcher, at the edge laptop)

Typhoon rain has kept the curb sensor wet past its 5 s debounce, and the controller is in L4. A convoy must cross north–south.

1. `/` shows the flood: the "L4 · Flashing amber · Flood" banner, Flood sensor FLOODED, both phase cards and all four map heads flashing amber, "No countdown while flashing", the ladder current on L4 and the override plate reading "Current None".
2. The dispatcher weighs L4 against a corridor. L4 is the controller's automatic flood response, and it only ever gives Flashing Amber: caution on every approach. A clear corridor is never automatic; only an MDRRMO override gives one, and an override outranks L4.
3. The dispatcher clicks "Evacuation corridor — NS".
4. ConfirmDialog asks: "Activate evacuation corridor NS? All other approaches go red. MDRRMO only." Cancel holds focus; the dispatcher moves to Confirm and presses it.
5. The dashboard sends `POST /api/overrides` with `{mode: "CORRIDOR", phase: "NS"}`. The backend answers 202 with the `OverrideCommand` (REQUESTED) and pushes SSE `override`. The button reads "Pending · waiting for controller"; Current still reads "None".
6. The controller acks within 1 s. The command turns APPLIED, and `state.override` reports `{CORRIDOR, NS, commandId}`. From that frame, Current reads "Corridor NS" and the override banner appears. The heads follow `state.signals` through the controller's lead-in clearance. (In M2 the countdown shows the timed yellow and all-red, then hides for the untimed corridor green.)
7. **Climax:** N and S glow green, E and W glow red, and "Override · Corridor NS" sits in the banner. Right beside it, the ladder still reads L4 Flashing Amber and the flood sensor still reads FLOODED. One glance gives the dispatcher both truths: the junction is still under water, and the convoy has a clear north–south run that the controller itself confirmed.
8. Once the convoy has passed, the dispatcher clicks "Release to automatic" and confirms. `state.override` reports `{NONE, <release id>}` and Current returns to "None". With the water still up, the controller falls back to its automatic level, L4, and every head flashes amber again.

Failure paths:

- **Controller offline:** the POST returns `409 CONTROLLER_OFFLINE`, the REJECTED command arrives over SSE, and the notice reads "Rejected · Controller offline". Nothing reached the controller.
- **Conflict fault:** the corridor is rejected with CONFLICT_FAULT. Flashing Amber is still accepted during a fault; the fault itself clears only at the controller box.
- **No answer in 5 s:** a TIMEOUT notice shows. If the ack or a matching state arrives later, the command resolves and Current follows `state.override`.
- **Command link lost mid-corridor:** the controller holds the corridor for 60 s, then returns to automatic through yellow and all-red. Meanwhile the controller panels go STALE and the countdown hides. When the link returns, `state.override` reads `{NONE, X}` and the dashboard shows that the corridor ended on its own.
- **M1:** the simulator plays the controller (CAP-5). In M2 the ESP32 obeys, and the diorama's LEDs change (CAP-8).

### Flow 2 — The hour's peaks and breaches (POSO enforcer, at the edge laptop)

1. On `/`, the Vehicle counts panel shows this hour by approach and class. North leads with 31 tricycles, and the Hour total reads 210.
2. Latest breach shows "14:32:08 · East approach · Motorcycle" beside a blurred crop.
3. The enforcer opens Traffic peaks. `/traffic/` loads `GET /api/counts/hourly` for today, Asia/Manila: 24 bars labeled by hour, with the peak hour flagged.
4. The current hour's bar matches the Hour total on `/`, because both come from the same backend counts service.
5. The enforcer opens Breaches. `/breaches/` lists events newest first: time, approach, class and blurred crop. A new breach slides in at the top while the enforcer reads.
6. **Climax:** the peak hour and a run of East-approach breaches line up on screen. That is the objective, timestamped record POSO lacks, and it holds no plate, body number, face or name: only a time, a class, an approach and a blur.
7. Rows older than 21 days show "No crop", because the crop has been purged; the row itself stays for a year.

Failure paths:

- **Stream drop:** StaleBadges appear; on reconnect, page 1 refetches.
- **A day with no traffic:** "No vehicles counted."
- **Export:** CSV export arrives in M2 (CAP-9).
