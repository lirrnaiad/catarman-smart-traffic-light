"use client";

import type { Level } from "@stl/contracts";
import type { ReactNode } from "react";
import { useLive } from "../../lib/live/hooks.ts";
import { levelVisuals } from "../../lib/visuals.ts";
import { LevelBadge } from "../ui/level-badge.tsx";
import { stencil } from "../ui/styles.ts";
import { NoData, Panel, well } from "./panel.tsx";

// 30px stroke icons: camera · stop-bar sensor · clock · water waves (DESIGN.md → Degradation ladder).
const icons: Record<Level, ReactNode> = {
  L1: (
    <>
      <rect x="3" y="9" width="19" height="14" rx="2" />
      <path d="M22 14l7-3.5v11L22 18z" />
      <circle cx="11" cy="16" r="3.2" />
    </>
  ),
  L2: (
    <>
      <rect x="10" y="3" width="12" height="16" rx="3" />
      <path d="M3 26h26" strokeWidth="4" />
    </>
  ),
  L3: (
    <>
      <circle cx="16" cy="16" r="12" />
      <path d="M16 8.5V16l5.5 3.5" />
    </>
  ),
  L4: (
    <>
      <path d="M3 11c3.2-3 5-3 8 0s5 3 8 0 5-3 8 0" />
      <path d="M3 18c3.2-3 5-3 8 0s5 3 8 0 5-3 8 0" />
      <path d="M3 25c3.2-3 5-3 8 0s5 3 8 0 5-3 8 0" />
    </>
  ),
};

const LEVELS: Level[] = ["L1", "L2", "L3", "L4"];

/** The L1→L4 ladder. CURRENT follows `state.level` only: a fault or an override never moves it. */
export function LadderPanel() {
  const state = useLive("state");
  return (
    <Panel
      title="Degradation level"
      tag="Degrades downward"
      of="controller"
      since={state?.receivedAt}
    >
      {state ? (
        <ol className="flex flex-col gap-[5px]">
          {LEVELS.map((level) => {
            const current = level === state.level;
            return (
              <li
                key={level}
                aria-current={current ? "true" : undefined}
                className={`${well} ${stencil} grid h-[62px] grid-cols-[58px_30px_1fr_auto] items-center gap-[12px] pr-[12px] pl-[8px] ${
                  current
                    ? "border-edge-light bg-linear-to-r from-surface-plate to-surface-title-hi text-text shadow-[inset_5px_0_0_var(--color-text),0_2px_0_var(--color-edge-dark)]"
                    : "text-text-3"
                }`}
              >
                <span className={current ? "" : "opacity-55"}>
                  <LevelBadge level={level} />
                </span>
                <svg
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                  className="size-[30px] fill-none stroke-current [stroke-width:2.2] [stroke-linecap:round] [stroke-linejoin:round]"
                >
                  {icons[level]}
                </svg>
                {/* The badge shows the code; together they read the exact level name. */}
                <span aria-hidden="true" className="text-label-row">
                  {levelVisuals[level].label.replace(`${level} `, "")}
                </span>
                {current ? (
                  <span className="rounded-sm bg-text px-[8px] py-[5px] text-micro text-text-inverse">
                    Current
                  </span>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <NoData />
      )}
    </Panel>
  );
}
