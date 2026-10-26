import type {
  Approach,
  Aspect,
  BrokerStatus,
  CommandStatus,
  Flood,
  Level,
  LinkStatus,
  Liveness,
  OverrideMode,
  Phase,
  Power,
  Source,
  VehicleClass,
} from "@stl/contracts";

// The only source of enum labels and color tokens (DESIGN.md → Colors, EXPERIENCE.md → Signal Semantics).

/** Every DESIGN.md color key; each is `--color-<key>` in globals.css. */
export const COLOR_TOKENS = [
  "surface-page",
  "surface-page-hi",
  "surface-housing",
  "surface-housing-hi",
  "surface-housing-lo",
  "surface-title-hi",
  "surface-title-lo",
  "surface-recess",
  "surface-plate",
  "surface-plate-hi",
  "surface-backplate",
  "surface-head-lo",
  "surface-head-hi",
  "visor",
  "lens-socket",
  "lens-bezel",
  "edge-light",
  "edge-dark",
  "rivet",
  "rivet-hi",
  "reflector",
  "map-asphalt",
  "map-block",
  "map-block-hatch",
  "map-sidewalk",
  "map-paint",
  "map-zone",
  "flood-water",
  "text",
  "text-2",
  "text-3",
  "text-inverse",
  "signal-red",
  "signal-red-core",
  "signal-red-deep",
  "signal-red-glass",
  "signal-red-glass-hi",
  "signal-yellow",
  "signal-yellow-core",
  "signal-yellow-deep",
  "signal-yellow-glass",
  "signal-yellow-glass-hi",
  "signal-green",
  "signal-green-core",
  "signal-green-deep",
  "signal-green-glass",
  "signal-green-glass-hi",
  "hazard-paint",
  "hazard-ink",
  "status-ok",
  "status-ok-deep",
  "status-off",
  "focus",
  "thumb-1",
  "thumb-2",
  "thumb-3",
  "class-car",
  "class-tricycle",
  "class-motorcycle",
  "class-jeepney",
  "class-utility-van",
  "class-unknown",
] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];

export type Visual = { label: string; token: ColorToken };

export function colorVar(token: ColorToken): string {
  return `var(--color-${token})`;
}

/** Level badges: plate tones, L4 in hazard paint; never a signal hue. */
export const levelVisuals: Record<Level, Visual> = {
  L1: { label: "L1 Vision adaptive", token: "surface-plate-hi" },
  L2: { label: "L2 Stop-bar presence", token: "surface-plate" },
  L3: { label: "L3 Fixed timing", token: "surface-plate" },
  L4: { label: "L4 Flashing Amber", token: "hazard-paint" },
};

/** The only family that uses signal hues. */
export const aspectVisuals: Record<Aspect, Visual> = {
  GREEN: { label: "Green", token: "signal-green" },
  YELLOW: { label: "Yellow", token: "signal-yellow" },
  RED: { label: "Red", token: "signal-red" },
  FLASHING_AMBER: { label: "Flashing amber", token: "signal-yellow" },
  DARK: { label: "Dark", token: "text-2" },
};

export const overrideModeVisuals: Record<OverrideMode, Visual> = {
  NONE: { label: "None", token: "text-2" },
  FLASHING_AMBER: { label: "Flashing amber", token: "text" },
  CORRIDOR: { label: "Corridor", token: "text" },
};

export const floodVisuals: Record<Flood, Visual> = {
  DRY: { label: "Dry", token: "text-2" },
  WET: { label: "Wet", token: "text" },
  FLOODED: { label: "Flooded", token: "hazard-paint" },
};

export const powerVisuals: Record<Power, Visual> = {
  USB: { label: "USB", token: "text-2" },
  BATTERY: { label: "Battery", token: "text-2" },
};

export const sourceVisuals: Record<Source, Visual> = {
  sim: { label: "Sim", token: "text-2" },
  live: { label: "Live", token: "text-2" },
};

/** Neutral text plates; REJECTED and TIMEOUT get a hazard edge, never red. */
export const commandStatusVisuals: Record<CommandStatus, Visual> = {
  REQUESTED: { label: "Pending · waiting for controller", token: "text-2" },
  APPLIED: { label: "Applied", token: "text" },
  REJECTED: { label: "Rejected", token: "hazard-paint" },
  TIMEOUT: { label: "No reply from controller in 5 s", token: "hazard-paint" },
};

/** The known rejection codes. The reason is an open string in the contract (AD-7). */
export const rejectionReasonVisuals: Record<
  "CONTROLLER_OFFLINE" | "CONFLICT_FAULT",
  Visual
> = {
  CONTROLLER_OFFLINE: { label: "Controller offline", token: "text" },
  CONFLICT_FAULT: { label: "Conflict fault", token: "text" },
};

/** A known code's label, or the raw code in the neutral color. */
export function rejectionReasonVisual(code: string): Visual {
  return (
    (rejectionReasonVisuals as Record<string, Visual>)[code] ?? {
      label: code,
      token: "text-2",
    }
  );
}

/** Link pilots: steel blue squares, deliberately not R/Y/G. */
export const linkStatusVisuals: Record<LinkStatus, Visual> = {
  ONLINE: { label: "Online", token: "status-ok" },
  STALE: { label: "Stale", token: "status-ok-deep" },
  OFFLINE: { label: "Offline", token: "status-off" },
};

export const brokerStatusVisuals: Record<BrokerStatus, Visual> = {
  CONNECTED: { label: "Connected", token: "status-ok" },
  DISCONNECTED: { label: "Disconnected", token: "status-off" },
};

export const livenessVisuals: Record<Liveness, Visual> = {
  LIVE: { label: "Live", token: "status-ok" },
  STALE: { label: "Stale", token: "text" },
};

export const approachVisuals: Record<Approach, Visual> = {
  N: { label: "North approach", token: "text" },
  S: { label: "South approach", token: "text" },
  E: { label: "East approach", token: "text" },
  W: { label: "West approach", token: "text" },
};

export const phaseVisuals: Record<Phase, Visual> = {
  NS: { label: "NS", token: "text" },
  EW: { label: "EW", token: "text" },
};

/** The conflict-monitor fault: its own hazard state, never L4. */
export function faultVisual(fault: boolean): Visual {
  return fault
    ? { label: "FAULT · Conflict monitor", token: "hazard-paint" }
    : { label: "None", token: "text-2" };
}

/** Class tokens in DESIGN order, matched to the i-th class of `GET /api/vehicle-classes`. */
const CLASS_TOKENS = [
  "class-car",
  "class-tricycle",
  "class-motorcycle",
  "class-jeepney",
  "class-utility-van",
] as const satisfies readonly ColorToken[];

export function classColor(
  id: string,
  classes: readonly VehicleClass[],
): ColorToken {
  const i = classes.findIndex((c) => c.id === id);
  return CLASS_TOKENS[i] ?? "class-unknown";
}

/**
 * A class label without its trailing aside, for tight headers, and the aside as a footnote
 * (DESIGN.md → Counts table): "Motorcycle (incl. habal-habal)" gives "Motorcycle" and
 * "Motorcycle includes habal-habal". A label with no aside has no note.
 */
export function classLabelParts(label: string): {
  short: string;
  note: string | null;
} {
  const m = /^(.+?)\s*\((.+)\)$/.exec(label);
  if (!m) return { short: label, note: null };
  const [, short, aside] = m;
  const incl = /^incl\.\s*/i;
  return {
    short,
    note: `${short} ${incl.test(aside) ? aside.replace(incl, "includes ") : `(${aside})`}`,
  };
}

/** Where a class word may break in a narrow header, as in the live-status mockup ("Motor-cycle*"). */
const WORD_BREAKS: Record<string, number> = {
  motorcycle: 5,
  tricycle: 3,
  jeepney: 4,
};

/**
 * Puts a soft hyphen at each known break, so a header that can't fit a word breaks it there
 * with a hyphen. Unlike `hyphens: auto`, this needs no hyphenation dictionary in the browser.
 */
export function softHyphenate(text: string): string {
  return text.replace(/\p{L}+/gu, (word) => {
    const at = WORD_BREAKS[word.toLowerCase()];
    return at ? `${word.slice(0, at)}­${word.slice(at)}` : word;
  });
}
