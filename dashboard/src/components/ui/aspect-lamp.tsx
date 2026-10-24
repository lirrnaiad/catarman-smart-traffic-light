import { aspectVisuals, type ColorToken, colorVar } from "../../lib/visuals.ts";

export type LensColor = "RED" | "YELLOW" | "GREEN";

type Props = {
  color: LensColor;
  lit?: boolean;
  /** Flashing amber: lit, with the 1 Hz flash (steady lit under reduced motion). */
  flashing?: boolean;
  /** Lens diameter in px. */
  size: number;
  /** A stale lens keeps its state but loses the glow halo and breathing. */
  stale?: boolean;
};

/** One visored round lens (DESIGN.md → AspectLamp). Decorative: the signal head carries the label. */
export function AspectLamp({
  color,
  lit = false,
  flashing = false,
  size: s,
  stale = false,
}: Props) {
  const lens = aspectVisuals[color].token;
  const v = (suffix: string) => colorVar(`${lens}${suffix}` as ColorToken);
  const on = lit || flashing;
  const glow = stale
    ? ""
    : `0 0 ${s * 0.3}px ${s * 0.06}px color-mix(in srgb, ${v("")} 55%, transparent), 0 0 ${s * 0.95}px ${s * 0.24}px color-mix(in srgb, ${v("")} 22%, transparent), `;
  const motion = flashing ? "lamp-flash" : on && !stale ? "lamp-glow" : "";
  return (
    <span
      aria-hidden="true"
      className="relative block shrink-0 rounded-full"
      style={{
        width: s,
        height: s,
        background: `repeating-radial-gradient(circle at 50% 50%, color-mix(in srgb, ${colorVar("text")} 4.5%, transparent) 0 1px, transparent 1px 4px), radial-gradient(circle at 50% 30%, ${v("-glass-hi")} 0%, ${v("-glass")} 55%, ${colorVar("edge-dark")} 100%)`,
        boxShadow: `0 0 0 ${s * 0.06}px ${colorVar("lens-socket")}, 0 0 0 ${s * 0.08}px ${colorVar("lens-bezel")}`,
      }}
    >
      <span
        data-lens={color}
        className={`absolute inset-0 z-1 rounded-full ${motion}`}
        style={{
          opacity: on ? 1 : 0,
          background: `repeating-radial-gradient(circle at 50% 50%, color-mix(in srgb, ${colorVar("text")} 13%, transparent) 0 1px, transparent 1px 4px), radial-gradient(circle at 50% 58%, ${v("-core")} 0%, ${v("")} 36%, ${v("-deep")} 100%)`,
          boxShadow: `${glow}inset 0 ${s * 0.15}px ${s * 0.16}px ${s * -0.06}px color-mix(in srgb, ${colorVar("edge-dark")} 55%, transparent)`,
        }}
      />
      <span
        className="absolute z-2"
        style={{
          left: s * -0.14,
          right: s * -0.14,
          top: s * -0.16,
          height: s * 0.64,
          border: `${s * 0.1}px solid ${colorVar("visor")}`,
          borderBottom: 0,
          borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
        }}
      />
    </span>
  );
}
