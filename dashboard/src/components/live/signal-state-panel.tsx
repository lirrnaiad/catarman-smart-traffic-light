"use client";

import type { Aspect, Phase } from "@stl/contracts";
import { useLive, useLiveness } from "../../lib/live/hooks.ts";
import { aspectVisuals, colorVar, phaseVisuals } from "../../lib/visuals.ts";
import { stencil } from "../ui/styles.ts";
import { NoData, Panel, well } from "./panel.tsx";
import { SignalHead } from "./signal-head.tsx";

const heads: Record<Phase, string> = { NS: "N + S heads", EW: "E + W heads" };

function PhaseCard({
  phase,
  aspect,
  stale,
}: {
  phase: Phase;
  aspect: Aspect;
  stale: boolean;
}) {
  const { label, token } = aspectVisuals[aspect];
  const name = `Phase ${phaseVisuals[phase].label}`;
  return (
    <div className={`${well} flex items-center gap-[14px] px-[12px] py-[4px]`}>
      <SignalHead
        aspect={aspect}
        size={20}
        stale={stale}
        label={`${name}: ${label.toLowerCase()}`}
      />
      <div className={stencil}>
        <div className="text-[15px] font-extrabold tracking-[0.14em] text-text-2">
          {name}
        </div>
        <div
          className="mt-[3px] mb-[2px] text-headline-aspect"
          style={{ color: colorVar(token) }}
        >
          {label}
        </div>
        <div className="text-caption text-text-3">{heads[phase]}</div>
      </div>
    </div>
  );
}

/** NS and EW phase cards. No countdown in M1 (AD-14). */
export function SignalStatePanel() {
  const state = useLive("state");
  const stale = useLiveness("controller") === "STALE";
  return (
    <Panel
      title="Signal state"
      tag="Live · INT-01"
      of="controller"
      since={state?.receivedAt}
    >
      {state ? (
        <div className="flex flex-col gap-[8px]">
          {(["NS", "EW"] as const).map((p) => (
            <PhaseCard
              key={p}
              phase={p}
              aspect={state.signals[p]}
              stale={stale}
            />
          ))}
        </div>
      ) : (
        <NoData />
      )}
    </Panel>
  );
}
