import { AspectLamp, type LensColor } from "../ui/aspect-lamp.tsx";
import { stencil } from "../ui/styles.ts";

const LENSES: LensColor[] = ["RED", "YELLOW", "GREEN"];

/** An unlit signal head on its backplate: the brand mark (13px) and the loader (76px). */
export function UnlitHead({
  size,
  className = "",
}: {
  size: number;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-md border-2 border-reflector bg-surface-backplate ${className}`}
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
        {LENSES.map((c) => (
          <AspectLamp key={c} color={c} size={size} />
        ))}
      </div>
    </div>
  );
}

/** Full-screen until the first SSE frame. Under reduced motion: an unlit head with its words. */
export function Loader() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-[30px] bg-[radial-gradient(ellipse_at_50%_42%,var(--color-surface-page-hi)_0%,var(--color-surface-page)_72%)]"
    >
      <UnlitHead size={76} className="loader-head" />
      <div className={`${stencil} loader-text pl-[0.34em] text-label-loader`}>
        Loading
      </div>
      <div className={`${stencil} -mt-[18px] text-label-sub text-text-3`}>
        Connecting to INT-01
      </div>
    </div>
  );
}
