---
name: Catarman SMART Traffic Light Dashboard
status: final
created: 2026-10-22
updated: 2026-10-23
description: Operator dashboard for one edge-only adaptive signal (INT-01) on a 1920×1080 venue TV. Direction "Signal Hardware" — matte signal housings, visored glowing lenses, matte hazard paint. Every token maps 1:1 to a Tailwind v4 @theme variable (--color-*, --font-*) in globals.css.
sources:
  - ../spec-smart-traffic-light/spec-smart-traffic-light.md
  - ../architecture-smart-traffic-light/architecture-smart-traffic-light.md
colors:
  # Surfaces: matte charcoal and black signal housings
  surface-page: '#0B0C0D'
  surface-page-hi: '#15171A'
  surface-housing: '#1A1C1F'
  surface-housing-hi: '#24272B'
  surface-housing-lo: '#151719'
  surface-title-hi: '#202327'
  surface-title-lo: '#191B1E'
  surface-recess: '#0F1012'
  surface-plate: '#2C3035'
  surface-plate-hi: '#383D43'
  surface-backplate: '#08090A'
  surface-head-lo: '#131517'
  surface-head-hi: '#262A2E'
  visor: '#0C0D0E'
  lens-socket: '#070809'
  lens-bezel: '#2E3237'
  edge-light: '#3A3F45'
  edge-dark: '#050607'
  rivet: '#555B62'
  rivet-hi: '#8A9097'
  reflector: '#6B7178'
  # Map: top-down junction
  map-asphalt: '#232528'
  map-block: '#141618'
  map-block-hatch: '#1B1E21'
  map-sidewalk: '#34383D'
  map-paint: '#D8DBDE'
  map-zone: '#8C939A'
  flood-water: '#3B82B5'
  # Text
  text: '#F1F1EC'
  text-2: '#AEB3B8'
  text-3: '#737A81'
  text-inverse: '#0B0B0B'
  # Signal aspects: semantic only; lit and glowing only as a lens or a live aspect label
  signal-red: '#FF3B2F'
  signal-red-core: '#FFC2B8'
  signal-red-deep: '#B0150C'
  signal-red-glass: '#3A110E'
  signal-red-glass-hi: '#5A1B16'
  signal-yellow: '#FFB000'
  signal-yellow-core: '#FFE3A3'
  signal-yellow-deep: '#B26A00'
  signal-yellow-glass: '#3A2A08'
  signal-yellow-glass-hi: '#5C440F'
  signal-green: '#19E68C'
  signal-green-core: '#BDFFE0'
  signal-green-deep: '#04935A'
  signal-green-glass: '#0B2C1F'
  signal-green-glass-hi: '#154A35'
  # Hazard: alert and override zones; matte diagonal stripes, rectangles only
  hazard-paint: '#EBC81A'
  hazard-ink: '#0D0D0D'
  # System status: link health; square pilots, deliberately not R/Y/G
  status-ok: '#6EC6F2'
  status-ok-deep: '#1D5E80'
  status-off: '#2A2D31'
  focus: '#6EC6F2'
  # Media placeholder: anonymized breach crop
  thumb-1: '#8A8F95'
  thumb-2: '#5E6369'
  thumb-3: '#4A4F55'
  # Vehicle classes: chart series and class chips, never signal R/Y/G, hazard yellow or status blue
  class-car: '#9D3EB1'
  class-tricycle: '#5A8FF3'
  class-motorcycle: '#C770A8'
  class-jeepney: '#4C55BC'
  class-utility-van: '#028A9B'
  class-unknown: '#737A81'
typography:
  font-stencil:
    fontFamily: '"Bahnschrift", "DIN Condensed", "Roboto Condensed", "Arial Narrow", "Liberation Sans Narrow", "Nimbus Sans Narrow", "Helvetica Neue", "Noto Sans", "DejaVu Sans Condensed", system-ui, sans-serif'
    fontWeight: '800'
  font-body:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif'
    fontWeight: '400'
  display-countdown:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 92px
    fontWeight: '800'
    lineHeight: '0.92'
  display-approach:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 80px
    fontWeight: '800'
    lineHeight: '0.84'
    letterSpacing: 0.02em
  display-total:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 58px
    fontWeight: '800'
    lineHeight: '1'
  display-time:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 50px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: 0.02em
  headline-aspect:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 42px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: 0.03em
  headline-map-state:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 36px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: 0.04em
  headline-dialog:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 36px
    fontWeight: '800'
    lineHeight: '1.02'
    letterSpacing: 0.03em
  title-brand:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: 0.05em
  numeral-pcu:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 32px
    fontWeight: '800'
    lineHeight: '1'
  label-loader:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 30px
    fontWeight: '800'
    letterSpacing: 0.34em
  numeral-count:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 27px
    fontWeight: '800'
  value-md:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 24px
    fontWeight: '800'
    letterSpacing: 0.06em
  label-lg:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 21px
    fontWeight: '800'
    letterSpacing: 0.1em
  label-row:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 20px
    fontWeight: '800'
    lineHeight: '1.05'
    letterSpacing: 0.06em
  label-tab:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 19px
    fontWeight: '800'
    letterSpacing: 0.1em
  label-panel:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 18px
    fontWeight: '800'
    letterSpacing: 0.14em
  label-control:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 17px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: 0.06em
  label-link:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 16px
    fontWeight: '800'
    letterSpacing: 0.1em
  label-sub:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 14px
    fontWeight: '700'
    letterSpacing: 0.16em
  caption:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 13px
    fontWeight: '700'
    lineHeight: '1.4'
    letterSpacing: 0.12em
  micro:
    fontFamily: '{typography.font-stencil.fontFamily}'
    fontSize: 12px
    fontWeight: '700'
    letterSpacing: 0.16em
  body-dialog:
    fontFamily: '{typography.font-body.fontFamily}'
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.3'
rounded:
  xs: 2px
  sm: 3px
  DEFAULT: 4px
  md: 6px
  lg: 10px
  xl: 12px
  full: 9999px
spacing:
  '1': 4px
  '2': 6px
  '3': 8px
  '4': 10px
  '5': 12px
  '6': 14px
  '7': 16px
  '8': 20px
  '9': 24px
  page-margin: 24px
  gutter: 24px
  panel-gap: 20px
  panel-pad-x: 20px
  panel-pad-bottom: 18px
  topbar-height: 88px
  linkbar-height: 44px
  grid-height: 948px
  panel-title-height: 46px
  column-side: 432px
  column-center: 960px
  hazard-frame: 10px
  hazard-band: 12px
components:
  top-bar:
    background: 'linear-gradient(180deg, {colors.surface-housing-hi}, {colors.surface-housing-lo})'
    height: '{spacing.topbar-height}'
    border-bottom: '2px solid {colors.edge-dark}'
  nav-tab:
    background: 'linear-gradient(180deg, {colors.surface-housing-hi}, {colors.surface-housing})'
    foreground: '{colors.text-2}'
    typography: '{typography.label-tab}'
    radius: '{rounded.md}'
    height: 54px
  nav-tab-current:
    background: '{colors.text}'
    foreground: '{colors.text-inverse}'
  intersection-plate:
    background: 'linear-gradient(180deg, {colors.surface-plate-hi}, {colors.surface-plate})'
    foreground: '{colors.text}'
    radius: '{rounded.DEFAULT}'
  link-health-bar:
    background: '{colors.surface-recess}'
    height: '{spacing.linkbar-height}'
    typography: '{typography.label-link}'
  status-pilot:
    size: 14px
    radius: '{rounded.xs}'
    fill-ok: '{colors.status-ok}'
    border-ok: '{colors.status-ok-deep}'
    fill-off: '{colors.status-off}'
  sim-tag:
    border: '1px solid {colors.text-3}'
    foreground: '{colors.text-2}'
    typography: '{typography.micro}'
    radius: '{rounded.sm}'
  panel:
    background: 'linear-gradient(180deg, {colors.surface-housing-hi} 0%, {colors.surface-housing} 35%, {colors.surface-housing-lo} 100%)'
    border: '1px solid {colors.edge-dark}'
    radius: '{rounded.lg}'
    padding: '0 {spacing.panel-pad-x} {spacing.panel-pad-bottom}'
    rivet: '{colors.rivet}'
    rivet-glint: '{colors.rivet-hi}'
  panel-title:
    background: 'linear-gradient(180deg, {colors.surface-title-hi}, {colors.surface-title-lo})'
    foreground: '{colors.text-2}'
    typography: '{typography.label-panel}'
    height: '{spacing.panel-title-height}'
  well:
    background: '{colors.surface-recess}'
    border: '1px solid {colors.edge-dark}'
    radius: '{rounded.md}'
  signal-head:
    housing: 'linear-gradient(90deg, {colors.surface-head-lo} 0%, {colors.surface-head-hi} 45%, {colors.surface-housing} 100%)'
    backplate: '{colors.surface-backplate}'
    backplate-border: '2px solid {colors.reflector}'
    backplate-radius: '{rounded.md}'
    lamp-size-map: 64px
    lamp-size-phase: 20px
    lamp-size-loader: 76px
  aspect-lamp-red:
    lit: '{colors.signal-red}'
    core: '{colors.signal-red-core}'
    deep: '{colors.signal-red-deep}'
    glass: '{colors.signal-red-glass}'
    glass-hi: '{colors.signal-red-glass-hi}'
    radius: '{rounded.full}'
  aspect-lamp-yellow:
    lit: '{colors.signal-yellow}'
    core: '{colors.signal-yellow-core}'
    deep: '{colors.signal-yellow-deep}'
    glass: '{colors.signal-yellow-glass}'
    glass-hi: '{colors.signal-yellow-glass-hi}'
    radius: '{rounded.full}'
  aspect-lamp-green:
    lit: '{colors.signal-green}'
    core: '{colors.signal-green-core}'
    deep: '{colors.signal-green-deep}'
    glass: '{colors.signal-green-glass}'
    glass-hi: '{colors.signal-green-glass-hi}'
    radius: '{rounded.full}'
  aspect-lamp-fitting:
    socket: '{colors.lens-socket}'
    bezel: '{colors.lens-bezel}'
    visor: '{colors.visor}'
  countdown:
    background: '{colors.surface-recess}'
    numeral: '{typography.display-countdown}'
    foreground: '{colors.text}'
  level-badge-l1:
    background: '{colors.surface-plate-hi}'
    foreground: '{colors.text}'
    radius: '{rounded.DEFAULT}'
  level-badge-l2:
    background: '{colors.surface-plate}'
    pattern: 'stop-bar line in {colors.text-2} across 74–86% of badge height'
  level-badge-l3:
    background: '{colors.surface-plate}'
    pattern: 'dot grid in {colors.edge-light}, 7px pitch'
  level-badge-l4:
    background: 'hazard stripes {colors.hazard-paint} / {colors.hazard-ink}'
    label-background: '{colors.hazard-ink}'
    label-foreground: '{colors.hazard-paint}'
  ladder-rung-current:
    background: 'linear-gradient(90deg, {colors.surface-plate}, {colors.surface-title-hi})'
    marker: 'inset 5px {colors.text}'
    flag-background: '{colors.text}'
    flag-foreground: '{colors.text-inverse}'
  flood-selector:
    cell-background: '{colors.surface-housing}'
    cell-foreground: '{colors.text-3}'
    on-background: '{colors.text}'
    on-foreground: '{colors.text-inverse}'
    flooded-edge: 'hazard stripes, {spacing.hazard-band} wide'
  pcu-tag:
    background: '{colors.surface-page} at 90%'
    border: '1px solid {colors.map-zone}'
    numeral: '{typography.numeral-pcu}'
    zero-foreground: '{colors.text-3}'
  counts-table:
    row-background: '{colors.surface-recess}'
    numeral: '{typography.numeral-count}'
    zero-foreground: '{colors.text-3}'
  hour-total:
    background: 'linear-gradient(180deg, {colors.surface-plate-hi}, {colors.surface-plate})'
    numeral: '{typography.display-total}'
  breach-thumb:
    background: '{colors.thumb-3}'
    size: 156px × 104px
    radius: '{rounded.md}'
  override-panel:
    frame: 'hazard stripes {colors.hazard-paint} / {colors.hazard-ink}'
    frame-width: '{spacing.hazard-frame}'
    radius: '{rounded.xl}'
    inner-background: 'linear-gradient(180deg, {colors.surface-housing-hi}, {colors.surface-housing-lo})'
  override-button:
    background: 'linear-gradient(180deg, {colors.surface-plate-hi}, {colors.surface-plate})'
    foreground: '{colors.text}'
    typography: '{typography.label-control}'
    radius: '{rounded.md}'
  override-button-release:
    background: 'linear-gradient(180deg, {colors.surface-housing-hi}, {colors.surface-housing})'
    foreground: '{colors.text-2}'
  confirm-dialog:
    width: 446px
    background: 'linear-gradient(180deg, {colors.surface-housing-hi}, {colors.surface-housing-lo})'
    radius: '{rounded.lg}'
    hazard-band-height: 18px
    scrim: '{colors.edge-dark} at 78%'
    title: '{typography.headline-dialog}'
    effect-text: '{typography.body-dialog}'
  dialog-button-cancel:
    background: 'linear-gradient(180deg, {colors.surface-plate-hi}, {colors.surface-plate})'
    foreground: '{colors.text}'
    height: 60px
  dialog-button-confirm:
    background: '{colors.hazard-paint}'
    foreground: '{colors.text-inverse}'
    edge: 'hazard stripes, 16px wide'
    height: 60px
  state-banner-l4:
    background: '{colors.hazard-paint}'
    foreground: '{colors.text-inverse}'
    caps: 'hazard stripes, 26px wide each end'
  state-banner-override:  # not in the direction
    background: '{colors.text}'
    foreground: '{colors.text-inverse}'
    caps: 'hazard stripes, 26px wide each end'
  state-banner-fault:  # not in the direction
    background: '{colors.hazard-ink}'
    foreground: '{colors.hazard-paint}'
  stale-badge:  # not in the direction
    background: '{colors.text}'
    foreground: '{colors.text-inverse}'
    typography: '{typography.micro}'
    radius: '{rounded.sm}'
  focus-ring:
    outline: '3px solid {colors.focus}'
    offset: 3px
---

# Catarman SMART Traffic Light Dashboard — Design Spine

Visual identity for the operator dashboard. Lifted from the chosen direction, Signal Hardware (`.working/direction-signal-hardware.html`, promoted as [`mockups/live-status.html`](mockups/live-status.html)). The other routes are drawn in [`mockups/traffic-peaks.html`](mockups/traffic-peaks.html), [`mockups/breach-log.html`](mockups/breach-log.html), [`mockups/override-log.html`](mockups/override-log.html) and [`mockups/state-history.html`](mockups/state-history.html). **This spine and `EXPERIENCE.md` win over any mock.** Behavior lives in `EXPERIENCE.md`.

## Brand & Style

The operator screen is built from the thing it controls: matte charcoal housings, visored round lenses, riveted stencil plates, and yellow-and-black hazard paint around anything that takes INT-01 out of automatic. Weighty, physical, trustworthy, at medium density.

It is read from 3–4 m by POSO enforcers, MDRRMO dispatchers and, at the pitch, judges from MDRRMO, DICT, EE and university ICT. So it is a strongly traffic-light-themed screen built on red, yellow and green, and it is disciplined about it: the theme's boldness lives in the hardware (housings, lenses, visors, hazard paint), while lit color is reserved for meaning.

Dark only. There is no light theme; the screen is a TV in a venue.

## Colors

Hex values are verbatim from the direction's token block. Each color key is the Tailwind v4 `@theme` variable `--color-<key>` in `globals.css` (so `{colors.signal-red}` is `--color-signal-red` and the utility `bg-signal-red`). **`src/lib/visuals.ts` is the only source of colors and labels for every enum family** (Level, Aspect, Override mode, Flood, Power, Source, Command status, Rejection reason, Link, Broker, Liveness, Approach, Phase). Components ask `visuals.ts` for an enum's token and label; they never hard-code either.

**Signal semantics (hard rule).** Red, yellow and green glow only as a live signal lamp (a round lens) or as the text label of a live aspect beside it. Decorative red, yellow and green appear only as unlit tinted glass (`*-glass`, `*-glass-hi`), as in the brand mark. Hazard stripes are matte rectangles: never round, never glowing. Link health uses steel blue square pilots, deliberately not red, yellow or green. Nothing else may borrow a signal hue.

- **Surfaces** (`surface-*`, `visor`, `lens-*`, `edge-*`, `rivet*`, `reflector`). Graphite steps from `{colors.surface-page}` (floor) through `{colors.surface-housing}` (panel body) to `{colors.surface-plate}` (raised plates and buttons), plus `{colors.surface-recess}` for sunken wells. `{colors.reflector}` borders signal backplates in neutral grey, never yellow.
- **Map** (`map-*`, `flood-water`). Asphalt, hatched blocks and sidewalks. **All road paint is `{colors.map-paint}` white**; there is no yellow road paint. `{colors.map-zone}` draws the dashed demand zones. `{colors.flood-water}` appears only on the map in L4, as a 20%-fill wave hatch over the roads.
- **Text.** `{colors.text}` is a warm white for values and current state; `{colors.text-2}` for secondary labels; `{colors.text-3}` for captions and inactive rungs; `{colors.text-inverse}` on white plates and hazard paint.
- **Signal aspects** (`signal-red|yellow|green` and their `-core`, `-deep`, `-glass`, `-glass-hi`). A lit lens is a radial of `-core` → lit → `-deep`; an unlit lens is `-glass-hi` → `-glass`. Glow is the lit hex at 55% (tight) and 22% (wide) alpha. `{colors.signal-yellow}` serves both YELLOW and FLASHING_AMBER.
- **Hazard** (`hazard-paint`, `hazard-ink`). A −45° stripe of 12px paint and 12px ink. It marks the override panel, the confirm dialog, the L4 rung and banner, and the FLOODED cell. It is matte paint: no glow, no circles. `{colors.hazard-paint}` is a different hue from `{colors.signal-yellow}` and is never lit.
- **System status** (`status-ok`, `status-ok-deep`, `status-off`, `focus`). Steel blue for a healthy link and for the keyboard focus ring; `{colors.status-off}` for an unlit pilot.
- **Media placeholder** (`thumb-1..3`). Grey blobs blurred 8px, standing in for an anonymized crop.

**Vehicle-class colors.** `visuals.ts` maps `classColor(id)` in the order of `vehicle-classes.json`: car `{colors.class-car}`, tricycle `{colors.class-tricycle}`, motorcycle `{colors.class-motorcycle}`, jeepney `{colors.class-jeepney}`, utility van `{colors.class-utility-van}`. An unknown id gets `{colors.class-unknown}`. None of them is signal red, yellow or green, hazard yellow or status blue. They color chart series and class chips only, never a lamp or a state. See [mockups/traffic-peaks.html](mockups/traffic-peaks.html).

**Contrast.** Computed WCAG ratios for the load-bearing pairs. Target: AA (4.5:1 body, 3:1 large text).

| Pair | Ratio |
|---|---|
| `text` on `surface-housing` / `surface-recess` | 15.1 / 16.8 |
| `text-2` on `surface-housing` / `surface-recess` | 8.1 / 9.0 |
| `text-3` on `surface-housing` / `surface-recess` | 3.9 / 4.4 |
| `signal-red` / `signal-yellow` / `signal-green` on `surface-recess` | 5.4 / 10.4 / 11.5 |
| `signal-red` on `map-asphalt` (36px map labels) | 4.3 |
| `text-inverse` on `hazard-paint` / on `text` | 12.0 / 17.4 |
| `focus` on `surface-page` | 10.3 |

`{colors.text-3}` falls below 4.5:1 at caption sizes, so it never carries load-bearing state; it captions what larger text already says.

## Typography

System fonts only: no web fonts and no remote assets (spine AD-9). The build may bundle a face through `next/font/local`; it may not use `next/font/google`.

- **`{typography.font-stencil}`** sets every label, value and numeral: weight 800, `font-stretch: condensed`, uppercase, tracked 0.02–0.34em. It reads as a stencilled equipment plate.
- **`{typography.font-body}`** appears only in sentence-case explanation, such as the confirm dialog's effect line (`{typography.body-dialog}`).
- **Numerals** use `font-variant-numeric: tabular-nums` (countdown, counts, totals, PCU, times), so live updates don't jitter.

Ramp, largest first: `display-countdown` 92 · `display-approach` 80 · `display-total` 58 · `display-time` 50 · `headline-aspect` 42 · `headline-map-state` / `headline-dialog` 36 · `title-brand` / `numeral-pcu` 32 · `label-loader` 30 · `numeral-count` 27 · `value-md` 24 · `label-lg` 21 · `label-row` 20 · `label-tab` 19 · `label-panel` 18 · `label-control` 17 · `label-link` 16 · `label-sub` 14 · `caption` 13 · `micro` 12 (11px for the PCU unit and the thumb tag).

**TV legibility.** Anything an operator acts on from 3–4 m (aspect, countdown, level name, flood state, counts, breach time) is 20px or larger. 11–14px is for units, footnotes and tags only.

**Font availability.** Bahnschrift is a Windows face; on a Linux laptop the stack falls through to Liberation Sans Narrow, Nimbus Sans Narrow or DejaVu Sans Condensed. If the demo laptop has none of them, widths grow and the fixed grid can overflow. Bundling one condensed face through `next/font/local` is the AD-9-compliant fix.

## Layout & Spacing

One fixed 1920×1080 artboard, no page scroll on `/` (composition: [`mockups/live-status.html`](mockups/live-status.html)):

| Band | Height | Content |
|---|---|---|
| Top bar | `{spacing.topbar-height}` 88 | Brand mark, title and sub-line, INT-01 plate · nav tabs right |
| Link health bar | `{spacing.linkbar-height}` 44 | Broker, Controller, Vision pilots · data-source note right |
| Grid | `{spacing.grid-height}` 948 | Three columns, 20px top and 24px side and bottom padding |

Columns: `{spacing.column-side}` 432 · `{spacing.column-center}` 960 · 432, with `{spacing.gutter}` 24 between them (24+432+24+960+24+432+24 = 1920). Panels stack with `{spacing.panel-gap}` 20; the last panel in a side column flexes to fill.

- **Left:** Signal state (phase cards and countdown) · Degradation level ladder · Flood sensor and conflict fault (fills).
- **Center:** Intersection INT-01, top-down: a 936×840 map, north up.
- **Right:** Vehicle counts this hour · Latest breach · MDRRMO override (fills, in its hazard frame).

The spacing scale is 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 (`{spacing.1}`–`{spacing.9}`): tight steps inside wells and tables, 20–24 between panels and at the page edge.

**Other routes** (`/traffic/`, `/breaches/`, `/log/overrides/`, `/log/states/`) keep the top bar and link health bar and fill the 1872px content width inside 24px margins. They may scroll vertically.

## Elevation & Depth

Depth is physical, as in cast and stamped metal, never soft and floating.

1. **Floor:** `{colors.surface-page}` with a radial vignette lifting to `{colors.surface-page-hi}` at the center.
2. **Housing (panels):** a top-lit gradient, a 1px inner highlight (white at 7%), a hard 4px ledge in `{colors.edge-dark}`, and an ambient `0 14px 30px` black at 55%. Four rivets (`{colors.rivet}` with a `{colors.rivet-hi}` glint) sit in the corners.
3. **Recessed wells:** `{colors.surface-recess}` with an inset `0 2px 5px` black at 65%. Values sit in wells.
4. **Raised plates and buttons:** a plate gradient, a 12–14% white inner highlight, and a 3–4px `{colors.edge-dark}` ledge. The current nav tab inverts to a white plate with a 4px inner bottom shadow.
5. **Dialog:** the highest layer, with a 6px ledge and `0 30px 60px` black at 70% over a `{colors.edge-dark}` 78% scrim.

**Light emission belongs to lamps alone.** A lit lens is the only element with an outer glow. Nothing else glows, pulses or casts colored light.

## Shapes

- **Circle = lens.** `{rounded.full}` is used only for signal lenses, under an arched visor hood. No other surface, badge, pilot or icon is a circle (rivets are sub-5px hardware detail).
- **Square = system status.** Link pilots and the fault pilot are 14px squares at `{rounded.xs}`.
- **Rectangles for everything else:** `{rounded.sm}` tags and flags · `{rounded.DEFAULT}` plates, level badges, PCU tags, map, banners · `{rounded.md}` wells, buttons, tabs, signal backplates, thumbs · `{rounded.lg}` panels and dialog · `{rounded.xl}` the override hazard frame. The direction's one-off 5px (selector cells, count rows, inner override plate) and 9px (L4 flood frame) fold into the nearest step.
- **Signal head:** a vertical housing with corner radius 0.16 × lamp size, lamps in fixed order red, yellow, green from the top, on a matte backplate with a top mounting bracket.
- **Hazard stripes** are always −45°, 12px bands, inside rectangles.

## Components

Shared atoms `LevelBadge`, `AspectLamp`, `StaleBadge`, `ClassLabel` and `ConfirmDialog` live in `src/components/ui/`, owned by the shell; they are built from Tailwind atoms, with no UI kit. Behavior for every component is in `EXPERIENCE.md` → Component Patterns.

- **Top bar** — `{components.top-bar}`. Brand mark (a 13px unlit signal head on a backplate, which is the one decorative use of tinted glass), title in `{typography.title-brand}`, sub-line "Edge-only adaptive signal · Catarman, Northern Samar" in `{typography.label-sub}` `{colors.text-3}`, then the **Intersection plate** (`{components.intersection-plate}`, "INTERSECTION" over "INT-01" at 30px).
- **Nav tab** — `{components.nav-tab}`; the current tab is `{components.nav-tab-current}` (white plate, inverse ink).
- **Link health bar** — `{components.link-health-bar}`. "LINK HEALTH" label, then one **Status pilot** per role (`{components.status-pilot}`) with the role name in `{colors.text-2}` and its status word, and a **Sim tag** (`{components.sim-tag}`) when the source is simulated. The right end holds "Data source · simulated (midterm)" in `{colors.text-3}`, or the state banners.
  - Pilot states: lit `{colors.status-ok}` for ONLINE and CONNECTED; unlit `{colors.status-off}` for OFFLINE and DISCONNECTED; for STALE, an unlit fill with a `{colors.status-ok-deep}` border.
- **Panel** — `{components.panel}` with a **Panel title** strip (`{components.panel-title}`): an uppercase title left, a `{typography.micro}` tag right ("LIVE · INT-01", "DEGRADES DOWNWARD", "APPROACH × CLASS").
- **Well** — `{components.well}`. The sunken tray for every live value.
- **Signal head** — `{components.signal-head}`. Three lenses, red, yellow, green from the top, on a backplate. Sizes: 64px lenses on the map, 20px in phase cards, 32px on the L4 board, 76px in the loader.
- **AspectLamp** — `{components.aspect-lamp-red}`, `{components.aspect-lamp-yellow}` or `{components.aspect-lamp-green}`, plus `{components.aspect-lamp-fitting}`: a socket ring, a bezel highlight, a Fresnel ring texture and an arched visor. Unlit: tinted glass. Lit: a hot-spot radial plus a two-layer glow.
- **Aspect label** — the live aspect's word in its signal color: `{typography.headline-aspect}` in phase cards, `{typography.headline-map-state}` beside map heads. It always sits next to its lit lens.
- **Phase card** — a well with a 20px head, "PHASE NS" in `{colors.text-2}`, the aspect label, and "N + S HEADS" in `{colors.text-3}`.
- **Countdown** — `{components.countdown}`: "RUNNING INTERVAL · NS GREEN" key; an optional "UP TO" prefix at 24px in `{colors.text-2}`; the numeral in `{typography.display-countdown}` white, not signal-colored; a unit "s" at 34px; a right-aligned note ("Green can end early") in `{typography.caption}`.
- **Degradation ladder** — four 62px rungs in fixed L1→L4 order: **LevelBadge**, a 30px stroke icon (camera · stop-bar sensor · clock · water waves), the level name in `{typography.label-row}`, and a "CURRENT" flag. Each LevelBadge has its own pattern so the levels never look alike: L1 `{components.level-badge-l1}` plain, L2 `{components.level-badge-l2}` stop-bar line, L3 `{components.level-badge-l3}` dot grid, L4 `{components.level-badge-l4}` hazard stripes. Non-current badges sit at 55% opacity; the current rung is `{components.ladder-rung-current}`.
- **Flood selector** — `{components.flood-selector}`: a three-cell DRY · WET · FLOODED switch in `{typography.label-lg}`. The active cell inverts to a white plate; FLOODED carries a hazard edge. Notes below in `{typography.caption}`.
- **Fault row** — a well with a square fault pilot (`{colors.status-off}` when clear), "CONFLICT FAULT", the value in `{typography.value-md}`, and the note "Own state, never shown as L4".
- **Intersection map** — inline SVG from `map-*` tokens: hatched blocks with sidewalks, white zebra crossings, stop bars and dashed center lines, dashed demand zones, approach chevrons at 45% opacity, and "INT-01" stencilled at the center in `{colors.edge-light}`. Four signal heads on backplates sit at the block corners.
- **Approach label** — on the map: the letter in `{typography.display-approach}`, then "NORTH APPROACH", "PHASE NS", the aspect label and the countdown sub-line.
- **PCU tag** — `{components.pcu-tag}`, 72×60 inside each demand zone: the value over "PCU · N". Zero dims to `{colors.text-3}`.
- **Counts table** — `{components.counts-table}`: rows N/S/E/W, columns from the class list (**ClassLabel**, two-line headers in `{typography.micro}`, with the footnote "* Motorcycle includes habal-habal"). Each row is a recess band with a 4px plate edge; zero cells dim.
- **Hour total** — `{components.hour-total}`: "HOUR TOTAL / All approaches, all classes" left, the value in `{typography.display-total}` right.
- **Latest breach card** — a **Breach thumb** (`{components.breach-thumb}`, with a "BLURRED" tag bottom-left), then the time in `{typography.display-time}`, the approach and the class in `{typography.label-row}` `{colors.text-2}`. No other fields exist to show.
- **MDRRMO override panel** — `{components.override-panel}`: a hazard frame around a housing. The title row is "MDRRMO OVERRIDE" with a **Current override plate** right ("CURRENT" and a recess chip). Below it, a 2×2 grid of **Override buttons** (`{components.override-button}`, a 34px stroke icon and a two-line label); "Release to automatic" uses `{components.override-button-release}`. The footer has a lock icon and "Every override asks for confirmation first".
- **ConfirmDialog** — `{components.confirm-dialog}`: an 18px hazard band on top, a lock kicker "MDRRMO OVERRIDE · CONFIRM", the question in `{typography.headline-dialog}`, an effect well (a junction pictogram plus the effect sentence in `{typography.body-dialog}` and "MDRRMO ONLY" in stencil), and two 60px buttons: Cancel (`{components.dialog-button-cancel}`, focused by default) and Confirm (`{components.dialog-button-confirm}`, hazard paint with a striped edge).
- **State banners** — 38px tall at the right end of the link health bar on `/` (the L4 board drew one at the right of a slimmer top bar, where `/` keeps the nav).
  - L4: `{components.state-banner-l4}`, "L4 · FLASHING AMBER · FLOOD".
  - Override active: `{components.state-banner-override}`, e.g. "OVERRIDE · CORRIDOR NS".
  - FAULT: `{components.state-banner-fault}`, the inverse of L4 so the two never read alike: "FAULT · CONFLICT MONITOR".
- **StaleBadge** — `{components.stale-badge}` in the panel title's tag slot: "STALE · " plus the last update time. A stale panel keeps its last values; its lit lenses lose their glow halo and breathing.
- **Loader** — a 76px signal head on a backplate, centered on the floor; "LOADING" in `{typography.label-loader}` and "Connecting to INT-01" in `{typography.label-sub}` `{colors.text-3}`.
- **Hourly chart** (`/traffic/`, Recharts) — 24 bars inside a well, stacked by vehicle class in the class colors; a white "Peak 17:00 · 248 vehicles" plate with a leader line to the peak bar; the current hour marked LIVE with a dashed cap; axis labels in `{typography.caption}` `{colors.text-3}`; gridlines in `{colors.edge-light}`. Never signal colors.
- **Log table** (`/breaches/`, `/log/overrides/`, `/log/states/`) — the counts-table language: recess row bands with 5px spacing, stencil cells, times in tabular numerals. Command status is a neutral text plate; REJECTED and TIMEOUT add a hazard edge, never red.
- **Speed alert line** (M2, CAP-10) — one line on `/` in hazard paint with ink text, "UNCALIBRATED MOCKUP" in `{typography.micro}`.
- **Focus ring** — `{components.focus-ring}` on every focusable control.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Light red, yellow or green only in a round lens or a live aspect label beside it | Use signal hues for chrome, charts, class colors, alerts, errors or decoration |
| Keep lamps in red-top, yellow-middle, green-bottom order, each with a text label | Show a lit lamp with no word next to it, or reorder lamps |
| Draw hazard stripes as matte −45° rectangles | Make hazard paint round, glowing or animated |
| Show link health with steel blue square pilots and a status word | Use a green or red dot for link health |
| Give L1–L4 distinct badge patterns, icons and names | Tell levels apart by color alone, or reuse the L4 hazard look for FAULT |
| Keep all road paint white and backplate borders grey | Paint the map or hardware yellow |
| Take every enum's color and label from `visuals.ts` tokens | Hard-code a hex or a label in a component |
| Use stencil uppercase with tabular numerals for values | Use web fonts, CDN assets or proportional numerals |
| Let lamps alone emit light | Add glows, neon or colored shadows to panels or buttons |
| Show only Tier 1 fields: time, class, approach, centroid, blurred crop, aggregates | Show OCR text, plates, body numbers, faces or anything that identifies a person |
