"use client";

import type { Approach, Phase } from "@stl/contracts";
import { useLive, useLiveness } from "../../lib/live/hooks.ts";
import {
  approachVisuals,
  aspectVisuals,
  colorVar,
  phaseVisuals,
} from "../../lib/visuals.ts";
import { StaleBadge } from "../ui/stale-badge.tsx";
import { stencil } from "../ui/styles.ts";
import { Panel } from "./panel.tsx";
import { SignalHead } from "./signal-head.tsx";

// Drawn at the mockup's 936×840, then scaled to the 920px inside the panel.
const W = 936;
const H = 840;
const SCALE = 920 / W;

const phaseOf: Record<Approach, Phase> = { N: "NS", S: "NS", E: "EW", W: "EW" };

/** Mockup positions (px in the 936×840 map) for each approach's head, label and PCU tag. */
const layout: Record<
  Approach,
  {
    head: [number, number];
    label: [number, number, number];
    right: boolean;
    pcu: [number, number];
  }
> = {
  N: { head: [232, 26], label: [32, 30, 184], right: true, pcu: [386, 110] },
  E: { head: [800, 26], label: [600, 30, 184], right: true, pcu: [737, 344] },
  S: {
    head: [588, 544],
    label: [724, 550, 196],
    right: false,
    pcu: [478, 672],
  },
  W: { head: [20, 544], label: [160, 550, 190], right: false, pcu: [127, 436] },
};
const APPROACHES = ["N", "E", "S", "W"] as const;

const paint = colorVar("map-paint");
const zone = colorVar("map-zone");

function MapArt({ flooded }: { flooded: boolean }) {
  const block = {
    fill: "url(#imap-hatch)",
    stroke: colorVar("map-sidewalk"),
    strokeWidth: 16,
  };
  const line = {
    fill: "none",
    stroke: paint,
    strokeWidth: 4,
    strokeDasharray: "26 18",
  };
  const zoneStyle = {
    fill: "none",
    stroke: zone,
    strokeWidth: 2,
    strokeDasharray: "8 6",
  };
  const chev = {
    fill: "none",
    stroke: paint,
    strokeWidth: 3,
    opacity: 0.45,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
      className="block"
    >
      <defs>
        <pattern
          id="imap-hatch"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="14" height="14" fill={colorVar("map-block")} />
          <rect width="2" height="14" fill={colorVar("map-block-hatch")} />
        </pattern>
        <pattern
          id="imap-zebra-v"
          width="20"
          height="10"
          patternUnits="userSpaceOnUse"
        >
          <rect x="4" width="11" height="10" fill={paint} />
        </pattern>
        <pattern
          id="imap-zebra-h"
          width="10"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <rect y="4" width="10" height="11" fill={paint} />
        </pattern>
        <pattern
          id="imap-water"
          width="24"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          <rect
            width="24"
            height="12"
            fill={colorVar("flood-water")}
            fillOpacity={0.2}
          />
          <path
            d="M0 8q6-6 12 0t12 0"
            fill="none"
            stroke={colorVar("flood-water")}
            strokeOpacity={0.7}
            strokeWidth={1.6}
          />
        </pattern>
        <clipPath id="imap-roads">
          <rect x="368" y="0" width="200" height={H} />
          <rect x="0" y="320" width={W} height="200" />
        </clipPath>
      </defs>
      <rect width={W} height={H} fill={colorVar("map-asphalt")} />
      <path {...block} d="M-20 -20H368V288Q368 320 336 320H-20Z" />
      <path {...block} d="M568 -20H956V320H600Q568 320 568 288Z" />
      <path {...block} d="M-20 520H336Q368 520 368 552V860H-20Z" />
      <path {...block} d="M568 552Q568 520 600 520H956V860H568Z" />
      <rect x="376" y="276" width="184" height="36" fill="url(#imap-zebra-v)" />
      <rect x="376" y="528" width="184" height="36" fill="url(#imap-zebra-v)" />
      <rect x="576" y="328" width="36" height="184" fill="url(#imap-zebra-h)" />
      <rect x="324" y="328" width="36" height="184" fill="url(#imap-zebra-h)" />
      <rect x="376" y="260" width="92" height="8" fill={paint} />
      <rect x="468" y="572" width="92" height="8" fill={paint} />
      <rect x="620" y="328" width="8" height="92" fill={paint} />
      <rect x="308" y="420" width="8" height="92" fill={paint} />
      <line {...line} x1="468" y1="0" x2="468" y2="252" />
      <line {...line} x1="468" y1="588" x2="468" y2="840" />
      <line {...line} x1="636" y1="420" x2="936" y2="420" />
      <line {...line} x1="0" y1="420" x2="300" y2="420" />
      <rect {...zoneStyle} x="384" y="28" width="76" height="222" rx="6" />
      <rect {...zoneStyle} x="476" y="590" width="76" height="222" rx="6" />
      <rect {...zoneStyle} x="638" y="336" width="270" height="76" rx="6" />
      <rect {...zoneStyle} x="28" y="428" width="270" height="76" rx="6" />
      <path {...chev} d="M410 222l12 12 12-12" />
      <path {...chev} d="M502 618l12-12 12 12" />
      <path {...chev} d="M666 362l-12 12 12 12" />
      <path {...chev} d="M270 454l12 12-12 12" />
      <text
        x="468"
        y="428"
        textAnchor="middle"
        fill={colorVar("edge-light")}
        style={{ font: "800 22px var(--font-stencil)", letterSpacing: 6 }}
      >
        INT-01
      </text>
      {flooded && (
        <ellipse
          data-flood-hatch
          cx="468"
          cy="420"
          rx="380"
          ry="320"
          fill="url(#imap-water)"
          clipPath="url(#imap-roads)"
        />
      )}
    </svg>
  );
}

/** CAP-3's center: the top-down intersection, four heads mirroring `state.signals`, and PCU per approach as received (AD-12). */
export function IntersectionMap() {
  const state = useLive("state");
  const demand = useLive("demand");
  const stale = useLiveness("controller") === "STALE";
  return (
    <Panel
      title="Intersection INT-01 · top-down"
      tag="Demand zone · PCU = passenger-car units waiting"
      of="controller"
      since={state?.receivedAt}
      className="flex-1"
    >
      <div
        className="relative overflow-hidden rounded-[4px]"
        style={{ width: W * SCALE, height: H * SCALE }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: W, height: H, transform: `scale(${SCALE})` }}
        >
          <MapArt flooded={state?.level === "L4"} />
          {APPROACHES.map((a) => {
            const { head, label, right, pcu } = layout[a];
            const phase = phaseOf[a];
            const aspect = state ? state.signals[phase] : "DARK";
            const v = aspectVisuals[aspect];
            const name = approachVisuals[a].label.replace(" approach", "");
            const value = demand?.pcu[a];
            return (
              <div key={a}>
                <div
                  className="absolute"
                  style={{ left: head[0], top: head[1] }}
                >
                  <SignalHead
                    aspect={aspect}
                    size={64}
                    stale={stale}
                    label={`${name} head: ${state ? v.label.toLowerCase() : "no data yet"}`}
                  />
                </div>
                <div
                  className={`${stencil} absolute ${right ? "text-right" : ""}`}
                  style={{ left: label[0], top: label[1], width: label[2] }}
                >
                  <div className="text-display-approach">{a}</div>
                  <div className="mt-[8px] text-[17px] font-extrabold tracking-[0.12em] text-text-2">
                    {approachVisuals[a].label}
                  </div>
                  <div className="mt-[12px] text-[15px] font-extrabold tracking-[0.14em] text-text-3">
                    Phase {phaseVisuals[phase].label}
                  </div>
                  {state ? (
                    <div
                      className="mt-[2px] text-headline-map-state"
                      style={{ color: colorVar(v.token) }}
                    >
                      {v.label}
                    </div>
                  ) : (
                    <div className="mt-[6px] text-label-row text-text-2">
                      No data yet
                    </div>
                  )}
                </div>
                <div
                  data-pcu={a}
                  role="img"
                  aria-label={`${name} demand: ${value === undefined ? "no data yet" : `${value.toFixed(1)} PCU`}`}
                  className={`${stencil} absolute flex h-[60px] w-[72px] flex-col items-center justify-center rounded-[4px] border border-map-zone bg-[color-mix(in_srgb,var(--color-surface-recess)_90%,transparent)]`}
                  style={{ left: pcu[0], top: pcu[1] }}
                >
                  <b
                    className={`text-numeral-pcu tabular-nums ${value === 0 ? "text-text-3" : ""}`}
                  >
                    {value === undefined ? "–" : value.toFixed(1)}
                  </b>
                  <span className="mt-[2px] text-[11px] font-extrabold tracking-[0.16em] text-text-2">
                    PCU · {a}
                  </span>
                </div>
              </div>
            );
          })}
          {/* The PCU layer is vision's: its own badge, beside the controller's in the title. */}
          <div className="absolute top-[470px] left-[468px] -translate-x-1/2">
            <StaleBadge of="vision" since={demand?.receivedAt} />
          </div>
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_2px_var(--color-edge-dark),inset_0_0_50px_color-mix(in_srgb,var(--color-edge-dark)_80%,transparent)]"
        />
      </div>
    </Panel>
  );
}
