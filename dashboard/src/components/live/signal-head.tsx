import type { Aspect } from "@stl/contracts";
import { AspectLamp, type LensColor } from "../ui/aspect-lamp.tsx";

const LENSES: LensColor[] = ["RED", "YELLOW", "GREEN"];

/** The lens a reported aspect lights; FLASHING_AMBER flashes yellow, DARK lights none. */
const litLens: Record<Aspect, LensColor | null> = {
  RED: "RED",
  YELLOW: "YELLOW",
  GREEN: "GREEN",
  FLASHING_AMBER: "YELLOW",
  DARK: null,
};

type Props = {
  aspect: Aspect;
  /** Lens diameter in px: 20 in phase cards, 64 on the map. */
  size: number;
  /** e.g. "Phase NS: green" or "North head: green". */
  label: string;
  stale?: boolean;
};

/** Three lenses, red over yellow over green, on a backplate; exactly the reported lens is lit. */
export function SignalHead({ aspect, size, label, stale = false }: Props) {
  const flashing = aspect === "FLASHING_AMBER";
  return (
    <div
      role="img"
      aria-label={label}
      className="relative shrink-0 rounded-md border-2 border-reflector bg-surface-backplate"
      style={{ padding: Math.max(4, size * 0.13) }}
    >
      <div
        className="flex flex-col items-center bg-linear-to-r from-surface-head-lo via-surface-head-hi to-surface-housing"
        style={{
          gap: size * 0.16,
          padding: `${size * 0.26}px ${size * 0.22}px`,
          borderRadius: size * 0.16,
        }}
      >
        {LENSES.map((c) => {
          const on = litLens[aspect] === c;
          return (
            <AspectLamp
              key={c}
              color={c}
              size={size}
              lit={on}
              flashing={on && flashing && !stale}
              stale={stale}
            />
          );
        })}
      </div>
    </div>
  );
}
