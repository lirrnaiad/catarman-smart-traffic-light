"use client";

import type { BrokerStatus, LinkStatus, Source } from "@stl/contracts";
import { useLive } from "../../lib/live/hooks.ts";
import {
  brokerStatusVisuals,
  colorVar,
  linkStatusVisuals,
  sourceVisuals,
} from "../../lib/visuals.ts";
import { stencil } from "../ui/styles.ts";
import { StateBanners, useStateBanners } from "./state-banners.tsx";

function Pilot({
  name,
  status,
  source = null,
}: {
  name: string;
  status: LinkStatus | BrokerStatus;
  source?: Source | null;
}) {
  const { label, token } =
    status === "CONNECTED" || status === "DISCONNECTED"
      ? brokerStatusVisuals[status]
      : linkStatusVisuals[status];
  const lit = status === "ONLINE" || status === "CONNECTED";
  const stale = status === "STALE";
  return (
    <span className="flex items-center gap-[10px]">
      <i
        aria-hidden="true"
        data-pilot={lit ? "lit" : stale ? "stale" : "off"}
        className="size-[14px] rounded-xs border-2"
        style={{
          // Lit: the token's fill. STALE: an unlit fill with the token's deep border. Off: unlit.
          background: colorVar(lit ? token : "status-off"),
          borderColor: colorVar(lit || stale ? "status-ok-deep" : "status-off"),
        }}
      />
      <b className="font-bold text-text-2">{name}</b> {label}
      {source === "sim" && (
        <em className="rounded-sm border border-text-3 px-[6px] py-[2px] text-micro text-text-2 not-italic">
          {sourceVisuals.sim.label}
        </em>
      )}
    </span>
  );
}

/** Broker, Controller and Vision pilots; the data-source note or, on `/`, the state banners. */
export function LinkHealthBar() {
  const link = useLive("link");
  const banners = useStateBanners();
  const sim =
    link?.controller.source === "sim" || link?.vision.source === "sim";
  return (
    <div
      role="status"
      aria-label="Link health"
      className={`${stencil} flex h-linkbar-height shrink-0 items-center gap-[34px] border-b border-edge-light bg-surface-recess px-page-margin text-label-link`}
    >
      <span className="text-[14px] tracking-[0.18em] text-text-3">
        Link health
      </span>
      {link && (
        <>
          <Pilot name="Broker" status={link.broker} />
          <Pilot
            name="Controller"
            status={link.controller.status}
            source={link.controller.source}
          />
          <Pilot
            name="Vision"
            status={link.vision.status}
            source={link.vision.source}
          />
        </>
      )}
      {banners.length > 0 ? (
        <StateBanners banners={banners} />
      ) : (
        sim && (
          <span className="ml-auto text-[14px] tracking-[0.16em] text-text-3">
            Data source · simulated (midterm)
          </span>
        )
      )}
    </div>
  );
}
