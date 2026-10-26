"use client";

import type { Flood } from "@stl/contracts";
import { useLive } from "../../lib/live/hooks.ts";
import { colorVar, faultVisual, floodVisuals } from "../../lib/visuals.ts";
import { stencil } from "../ui/styles.ts";
import { NoData, Panel, well } from "./panel.tsx";

const FLOODS: Flood[] = ["DRY", "WET", "FLOODED"];

/** Hazard edge on the FLOODED cell: matte −45° stripes, 12px wide. */
const floodedEdge = `repeating-linear-gradient(-45deg, ${colorVar("hazard-paint")} 0 12px, ${colorVar("hazard-ink")} 12px 24px) left / 12px 100% no-repeat, `;

/** The read-only flood selector and the conflict-fault row (it has no control). */
export function FloodFaultPanel() {
  const state = useLive("state");
  return (
    <Panel
      title="Flood sensor"
      tag="Immersion probe"
      of="controller"
      since={state?.receivedAt}
      className="min-h-0 flex-1"
    >
      {state ? (
        <>
          <div
            role="img"
            aria-label={`Flood sensor: ${floodVisuals[state.flood].label.toLowerCase()}`}
            className={`${well} grid grid-cols-3 gap-[6px] p-[6px]`}
          >
            {FLOODS.map((f) => {
              const on = f === state.flood;
              const fill = colorVar(on ? "text" : "surface-housing");
              return (
                <span
                  key={f}
                  data-flood={f}
                  data-on={on || undefined}
                  className={`${stencil} grid h-[42px] place-items-center rounded-md text-label-lg ${
                    on
                      ? "text-text-inverse shadow-[0_3px_0_var(--color-edge-dark)]"
                      : "text-text-3"
                  } ${f === "FLOODED" ? "pl-[12px]" : ""}`}
                  style={{
                    background:
                      f === "FLOODED" ? `${floodedEdge}${fill}` : fill,
                  }}
                >
                  {floodVisuals[f].label}
                </span>
              );
            })}
          </div>
          {state.flood === "WET" && (
            <p
              className={`${stencil} mx-[2px] mt-[4px] text-caption text-text-2`}
            >
              Wet · immersion seen, debounce running
            </p>
          )}
          <FaultRow fault={state.fault} />
        </>
      ) : (
        <NoData />
      )}
    </Panel>
  );
}

function FaultRow({ fault }: { fault: boolean }) {
  const { label, token } = faultVisual(fault);
  return (
    <div
      className={`${well} ${stencil} mt-[8px] flex items-center gap-[12px] px-[12px] py-[5px]`}
    >
      <i
        aria-hidden="true"
        className="size-[14px] shrink-0 rounded-xs border-2 border-edge-dark"
        style={{ background: colorVar(fault ? token : "status-off") }}
      />
      <div className="min-w-0 flex-1">
        {/* The reset note shares the key's line: the left column has no height to spare. */}
        <div className="flex items-baseline justify-between gap-[8px]">
          <span className="text-[15px] font-extrabold tracking-[0.14em] text-text-2">
            Conflict fault
          </span>
          {fault && (
            <span className="text-caption text-text-2">
              Reset at the controller box
            </span>
          )}
        </div>
        <div className="text-value-md" style={{ color: colorVar(token) }}>
          {label}
        </div>
      </div>
    </div>
  );
}
