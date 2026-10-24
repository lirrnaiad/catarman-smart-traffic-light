// Shared Tailwind class strings (DESIGN.md → Components). Full literals, so Tailwind's scanner sees them.

/** Stencil label: heavy, condensed, uppercase. */
export const stencil = "font-stencil font-stretch-condensed uppercase";

/** `{components.focus-ring}`: 3px solid focus, offset 3px. */
export const focusRing =
  "focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-focus";

/** Matte −45° hazard stripes, 12px paint and 12px ink. */
export const hazardStripes =
  "bg-[repeating-linear-gradient(-45deg,var(--color-hazard-paint)_0_12px,var(--color-hazard-ink)_12px_24px)]";
