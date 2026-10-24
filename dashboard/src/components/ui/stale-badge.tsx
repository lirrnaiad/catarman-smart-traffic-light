"use client";

import { useEffect, useRef } from "react";
import { useLiveness } from "../../lib/live/hooks.ts";
import { formatManila } from "../../lib/time.ts";
import { livenessVisuals } from "../../lib/visuals.ts";
import { useAnnounce } from "../shell/live-region.tsx";
import { stencil } from "./styles.ts";

type Role = "controller" | "vision";
const roleName: Record<Role, string> = {
  controller: "Controller",
  vision: "Vision",
};

/** "STALE · HH:mm:ss" in a panel title's tag slot while the `of` role is STALE; nothing while LIVE. */
export function StaleBadge({ of: role, since }: { of: Role; since?: string }) {
  const liveness = useLiveness(role);
  const announce = useAnnounce();
  const prev = useRef(liveness);
  useEffect(() => {
    // Only transitions are announced, not the STALE a page mounts with.
    if (prev.current === liveness) return;
    prev.current = liveness;
    announce(
      `${roleName[role]} ${livenessVisuals[liveness].label.toLowerCase()}`,
    );
  }, [liveness, announce, role]);

  if (liveness === "LIVE") return null;
  const word = livenessVisuals.STALE.label.toUpperCase();
  return (
    <span
      className={`${stencil} rounded-sm bg-text px-[6px] py-[2px] text-micro text-text-inverse tabular-nums`}
    >
      {since ? `${word} · ${formatManila(since)}` : word}
    </span>
  );
}
