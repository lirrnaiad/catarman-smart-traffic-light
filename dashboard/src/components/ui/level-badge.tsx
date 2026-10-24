import type { Level } from "@stl/contracts";
import { colorVar, levelVisuals } from "../../lib/visuals.ts";
import { hazardStripes, stencil } from "./styles.ts";

// Each level has its own pattern, so L1–L4 never differ by color alone (DESIGN.md → Degradation ladder).
const pattern: Record<Level, string> = {
  L1: "",
  L2: `linear-gradient(180deg, transparent 0 74%, ${colorVar("text-2")} 74% 86%, transparent 86%), `,
  L3: `radial-gradient(circle, ${colorVar("edge-light")} 0 1.4px, transparent 1.8px) 0 0 / 7px 7px, `,
  L4: "",
};

/** The level code on its pattern; its accessible name is the full level name. */
export function LevelBadge({ level }: { level: Level }) {
  const { label, token } = levelVisuals[level];
  const l4 = level === "L4";
  return (
    <span
      role="img"
      aria-label={label}
      data-level={level}
      className={`${stencil} grid h-[44px] w-[58px] place-items-center rounded border border-edge-dark text-[23px] font-extrabold tracking-[0.04em] text-text ${l4 ? hazardStripes : ""}`}
      style={
        l4 ? undefined : { background: `${pattern[level]}${colorVar(token)}` }
      }
    >
      <b
        className={`rounded-xs px-[4px] py-px ${l4 ? "bg-hazard-ink text-hazard-paint" : ""}`}
      >
        {level}
      </b>
    </span>
  );
}
