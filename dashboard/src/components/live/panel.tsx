"use client";

import { type ReactNode, useId } from "react";
import { useLiveness } from "../../lib/live/hooks.ts";
import { colorVar } from "../../lib/visuals.ts";
import { StaleBadge } from "../ui/stale-badge.tsx";
import { stencil } from "../ui/styles.ts";

/** `{components.well}`: the sunken tray every live value sits in. */
export const well =
  "rounded-md border border-edge-dark bg-surface-recess shadow-[inset_0_2px_5px_color-mix(in_srgb,var(--color-edge-dark)_65%,transparent)]";

const rivet = `radial-gradient(circle, ${colorVar("rivet-hi")} 0 1px, ${colorVar("rivet")} 1.5px 2.8px, ${colorVar("edge-dark")} 3.3px, transparent 4px)`;
const rivets = [
  "6px 6px",
  "calc(100% - 6px) 6px",
  "6px calc(100% - 6px)",
  "calc(100% - 6px) calc(100% - 6px)",
]
  .map((at) => `${rivet} ${at} / 10px 10px no-repeat`)
  .join(", ");

type Props = {
  title: string;
  /** The micro tag at the right of the title strip, e.g. "LIVE · INT-01". */
  tag: string;
  /** The live role feeding this panel: while it is STALE, the StaleBadge takes the tag's place. */
  of: "controller" | "vision";
  /** The last update time (ISO) shown in the StaleBadge. */
  since?: string;
  className?: string;
  children: ReactNode;
};

/** DESIGN.md → Panel: a riveted housing with a title strip and a tag slot. */
export function Panel({
  title,
  tag,
  of,
  since,
  className = "",
  children,
}: Props) {
  const stale = useLiveness(of) === "STALE";
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className={`relative flex flex-col rounded-lg border border-edge-dark bg-[linear-gradient(180deg,var(--color-surface-housing-hi)_0%,var(--color-surface-housing)_35%,var(--color-surface-housing-lo)_100%)] px-panel-pad-x pb-panel-pad-bottom shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-text)_7%,transparent),0_4px_0_var(--color-edge-dark),0_14px_30px_color-mix(in_srgb,var(--color-edge-dark)_55%,transparent)] ${className}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ background: rivets }}
      />
      <div
        className={`${stencil} -mx-panel-pad-x mb-[10px] flex h-panel-title-height shrink-0 items-center justify-between gap-[12px] rounded-t-lg border-b-2 border-edge-dark bg-linear-to-b from-surface-title-hi to-surface-title-lo px-[28px] text-text-2`}
      >
        {/* Only the title is in the heading, so it alone names the section. */}
        <h2 id={titleId} className="text-label-panel">
          {title}
        </h2>
        <div>
          {/* Always mounted, so it can announce the LIVE ↔ STALE transitions. */}
          <StaleBadge of={of} since={since} />
          {!stale && <span className="text-micro text-text-3">{tag}</span>}
        </div>
      </div>
      {children}
    </section>
  );
}

/** What a panel shows in place of its values while its slice is `null` or not yet received. */
export function NoData() {
  return (
    <div
      className={`${well} ${stencil} px-[14px] py-[16px] text-label-row text-text-2`}
    >
      No data yet
    </div>
  );
}
