"use client";

import type { StateSlice } from "@stl/contracts";
import { usePathname } from "next/navigation";
import { useLive } from "../../lib/live/hooks.ts";
import {
  aspectVisuals,
  faultVisual,
  overrideModeVisuals,
  phaseVisuals,
} from "../../lib/visuals.ts";
import { hazardStripes, stencil } from "../ui/styles.ts";
import { samePath } from "./top-bar.tsx";

type Banner = { kind: "l4" | "override" | "fault"; text: string };

/** The banners `state` calls for, in the order L4, Override, FAULT. FAULT is never drawn as L4. */
export function bannersFor(state: StateSlice | undefined): Banner[] {
  if (!state) return [];
  const out: Banner[] = [];
  if (state.level === "L4")
    out.push({
      kind: "l4",
      text: `L4 · ${aspectVisuals.FLASHING_AMBER.label} · Flood`,
    });
  const o = state.override;
  if (o && o.mode !== "NONE") {
    const phase =
      o.mode === "CORRIDOR" ? ` ${phaseVisuals[o.phase].label}` : "";
    out.push({
      kind: "override",
      text: `Override · ${overrideModeVisuals[o.mode].label}${phase}`,
    });
  }
  if (state.fault) out.push({ kind: "fault", text: faultVisual(true).label });
  return out.map((b) => ({ ...b, text: b.text.toUpperCase() }));
}

/** Banners show on `/` only. */
export function useStateBanners(): Banner[] {
  const state = useLive("state");
  const onLive = samePath(usePathname() ?? "/", "/");
  return onLive ? bannersFor(state ?? undefined) : [];
}

const look: Record<Banner["kind"], string> = {
  l4: "bg-hazard-paint text-text-inverse",
  override: "bg-text text-text-inverse",
  fault: "bg-hazard-ink text-hazard-paint",
};

export function StateBanners({ banners }: { banners: Banner[] }) {
  return (
    <div className="ml-auto flex gap-[12px]">
      {banners.map(({ kind, text }) => (
        <div
          key={kind}
          className={`${stencil} flex h-[38px] overflow-hidden rounded shadow-[0_0_0_1px_var(--color-edge-dark),0_3px_0_var(--color-edge-dark)] ${look[kind]}`}
        >
          {kind !== "fault" && <i className={`w-[26px] ${hazardStripes}`} />}
          <span className="flex items-center px-[14px] text-label-tab">
            {text}
          </span>
          {kind !== "fault" && <i className={`w-[26px] ${hazardStripes}`} />}
        </div>
      ))}
    </div>
  );
}
