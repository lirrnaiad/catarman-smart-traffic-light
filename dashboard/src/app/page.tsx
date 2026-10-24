import { LatestBreach } from "../components/breach/latest-breach.tsx";
import { FloodFaultPanel } from "../components/live/flood-fault-panel.tsx";
import { LadderPanel } from "../components/live/ladder-panel.tsx";
import { SignalStatePanel } from "../components/live/signal-state-panel.tsx";

/** `/`: the 432 · 960 · 432 grid (DESIGN.md → Layout & Spacing). Only mount lines here. */
export default function LivePage() {
  return (
    <div className="grid h-full grid-cols-[var(--spacing-column-side)_var(--spacing-column-center)_var(--spacing-column-side)] gap-gutter px-page-margin pt-[20px] pb-page-margin">
      <div className="flex min-h-0 flex-col gap-panel-gap">
        <SignalStatePanel />
        <LadderPanel />
        <FloodFaultPanel />
      </div>
      <div className="flex min-h-0 flex-col gap-panel-gap">
        {/* entry 13: intersection map */}
      </div>
      <div className="flex min-h-0 flex-col gap-panel-gap">
        {/* entry 13: vehicle counts this hour */}
        <LatestBreach />
        {/* entry 10: MDRRMO override panel */}
      </div>
    </div>
  );
}
