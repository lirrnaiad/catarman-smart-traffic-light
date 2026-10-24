"use client";

import type { Aspect, ErrorCode, StateChangeItem } from "@stl/contracts";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../../lib/api/client.ts";
import { listStateChanges } from "../../lib/api/state-changes.ts";
import { useStreamEpoch } from "../../lib/live/hooks.ts";
import { formatManila } from "../../lib/time.ts";
import {
  aspectVisuals,
  colorVar,
  faultVisual,
  floodVisuals,
  levelVisuals,
  overrideModeVisuals,
  phaseVisuals,
} from "../../lib/visuals.ts";
import { well } from "../live/panel.tsx";
import { AspectLamp, type LensColor } from "../ui/aspect-lamp.tsx";
import { LevelBadge } from "../ui/level-badge.tsx";
import { focusRing, hazardStripes, stencil } from "../ui/styles.ts";

const LIMIT = 50;
const LENSES: LensColor[] = ["RED", "YELLOW", "GREEN"];
const litLens: Record<Aspect, LensColor | null> = {
  RED: "RED",
  YELLOW: "YELLOW",
  GREEN: "GREEN",
  FLASHING_AMBER: "YELLOW",
  DARK: null,
};

/** The conflict-fault checker (DESIGN → Log table): never hazard stripes, so a fault never reads as L4. */
const faultChecker =
  "[background:conic-gradient(var(--color-text)_0_25%,var(--color-hazard-ink)_0_50%,var(--color-text)_0_75%,var(--color-hazard-ink)_0)_0_0/10px_10px]";
/** The corner notch on a cell that differs from the next older row. */
const changedMark =
  "bg-[linear-gradient(135deg,var(--color-text)_0_9px,transparent_9px)] bg-no-repeat";
const plate =
  "inline-flex min-h-[30px] items-stretch overflow-hidden rounded border border-edge-dark bg-linear-to-b from-surface-plate-hi to-surface-plate text-label-link text-text shadow-[0_2px_0_var(--color-edge-dark)]";

const codeOf = (err: unknown): ErrorCode =>
  err instanceof ApiRequestError ? err.code : "INTERNAL";

type Column = "level" | "NS" | "EW" | "flood" | "fault" | "override";

/** What each marked column compares between a row and the next older one. */
const compared: Record<Column, (s: StateChangeItem) => unknown> = {
  level: (s) => s.level,
  NS: (s) => s.signals.NS,
  EW: (s) => s.signals.EW,
  flood: (s) => s.flood,
  fault: (s) => s.fault,
  override: (s) => JSON.stringify([s.override, s.overrideEnded]),
};

function Plate({
  hazard = false,
  children,
}: {
  hazard?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`${stencil} ${plate}`}>
      {hazard && (
        <span
          data-hazard=""
          aria-hidden="true"
          className={`${hazardStripes} w-[12px] shrink-0`}
        />
      )}
      <span className="flex items-center px-[10px] py-[4px]">{children}</span>
    </span>
  );
}

function Time({ iso, latest }: { iso: string; latest: boolean }) {
  return (
    <>
      <span className="block text-value-md tabular-nums">
        {formatManila(iso)}
      </span>
      <span className="mt-[3px] block text-micro text-text-3 tabular-nums">
        {formatManila(iso, "date")}
      </span>
      {latest && (
        <span
          data-latest=""
          className="mt-[4px] inline-block rounded-xs bg-text px-[6px] py-[2px] text-micro text-text-inverse"
        >
          Latest
        </span>
      )}
    </>
  );
}

/** A small head with the recorded lens lit, steady and unglowing (history is not live), plus its word. */
function AspectCell({ phase, aspect }: { phase: string; aspect: Aspect }) {
  const { label, token } = aspectVisuals[aspect];
  return (
    <span className="flex items-center gap-[12px]">
      <span
        role="img"
        aria-label={`${phase}: ${label.toLowerCase()}`}
        className="flex flex-col gap-[2px] rounded-[3px] border border-reflector bg-surface-backplate p-[3px]"
      >
        {LENSES.map((c) => (
          <AspectLamp
            key={c}
            color={c}
            size={11}
            lit={litLens[aspect] === c}
            stale
          />
        ))}
      </span>
      <span className="text-label-row" style={{ color: colorVar(token) }}>
        {label}
      </span>
    </span>
  );
}

function OverrideCell({ item }: { item: StateChangeItem }) {
  const o = item.override;
  if (item.overrideEnded) {
    return <Plate hazard>Override ended (link loss or fault)</Plate>;
  }
  if (!o || o.mode === "NONE") {
    return (
      <span className="text-label-row text-text-3">
        {overrideModeVisuals.NONE.label}
      </span>
    );
  }
  return (
    <Plate hazard>
      {overrideModeVisuals[o.mode].label}
      {o.mode === "CORRIDOR" && ` ${phaseVisuals[o.phase].label}`}
    </Plate>
  );
}

export function StateRow({
  item,
  older,
  latest,
}: {
  item: StateChangeItem;
  /** The next older loaded row; without one, nothing is marked changed. */
  older?: StateChangeItem;
  latest: boolean;
}) {
  // A fault row takes the fault edge even at L4: it is never shown as L4.
  const edge = item.fault ? "fault" : item.level === "L4" ? "l4" : null;
  const tone = item.fault ? "bg-surface-title-hi" : "bg-surface-recess";
  const isChanged = (col?: Column) =>
    col !== undefined &&
    older !== undefined &&
    compared[col](item) !== compared[col](older);
  // The notch is visual only; screen readers get the word.
  const mark = (col: Column) =>
    isChanged(col) && <span className="sr-only"> changed</span>;
  const cell = (col?: Column) => {
    const changed = isChanged(col);
    return {
      "data-changed": changed ? "" : undefined,
      className: `${tone} ${changed ? changedMark : ""} px-[14px] py-[8px] align-middle`,
    };
  };
  const flood = floodVisuals[item.flood];
  const fault = faultVisual(item.fault);
  return (
    <tr data-edge={edge ?? undefined} className={stencil}>
      <td
        {...cell()}
        className={`${cell().className} relative rounded-l-[5px] ${edge ? "" : "shadow-[inset_4px_0_0_var(--color-surface-plate)]"}`}
      >
        {edge && (
          <span
            aria-hidden="true"
            className={`absolute inset-y-0 left-0 rounded-l-[5px] ${edge === "fault" ? `w-[10px] ${faultChecker}` : `w-[7px] ${hazardStripes}`}`}
          />
        )}
        <Time iso={item.receivedAt} latest={latest} />
      </td>
      <td {...cell("level")}>
        <span className="flex items-center gap-[14px]">
          <LevelBadge level={item.level} />
          <span className="text-label-row">
            {/* The badge already shows the level, as on the ladder. */}
            {levelVisuals[item.level].label.replace(`${item.level} `, "")}
          </span>
        </span>
        {mark("level")}
      </td>
      <td {...cell("NS")}>
        <AspectCell phase="NS" aspect={item.signals.NS} />
        {mark("NS")}
      </td>
      <td {...cell("EW")}>
        <AspectCell phase="EW" aspect={item.signals.EW} />
        {mark("EW")}
      </td>
      <td {...cell("flood")}>
        {item.flood === "DRY" ? (
          <span className="text-label-row text-text-3">{flood.label}</span>
        ) : (
          <Plate hazard={item.flood === "FLOODED"}>{flood.label}</Plate>
        )}
        {mark("flood")}
      </td>
      <td {...cell("fault")}>
        {item.fault ? (
          <span
            className={`${stencil} inline-flex min-h-[30px] items-stretch overflow-hidden rounded text-label-link text-text-inverse shadow-[0_2px_0_var(--color-edge-dark)]`}
          >
            <span aria-hidden="true" className={`w-[12px] ${faultChecker}`} />
            <span className="flex items-center bg-text px-[10px] py-[4px]">
              {fault.label}
            </span>
          </span>
        ) : (
          <span className="text-label-row text-text-3">{fault.label}</span>
        )}
        {mark("fault")}
      </td>
      <td
        {...cell("override")}
        className={`${cell("override").className} rounded-r-[5px]`}
      >
        <OverrideCell item={item} />
        {mark("override")}
      </td>
    </tr>
  );
}

/** `/log/states/`: newest first by `receivedAt`; refetches page 1 on each stream epoch, never appends live (EXPERIENCE → State history). */
export function StateHistory() {
  const [items, setItems] = useState<StateChangeItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<ErrorCode | null>(null);
  const epoch = useStreamEpoch();
  const epochRef = useRef(epoch);
  epochRef.current = epoch;

  // biome-ignore lint/correctness/useExhaustiveDependencies: refetch page 1 on every stream epoch.
  useEffect(() => {
    let current = true;
    listStateChanges({ limit: LIMIT }).then(
      (page) => {
        if (!current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setError(null);
        setMoreError(null);
        setLoaded(true);
      },
      (err: unknown) => {
        if (current) setError(codeOf(err));
      },
    );
    return () => {
      current = false;
    };
  }, [epoch]);

  async function loadMore() {
    if (!nextCursor) return;
    const started = epoch;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await listStateChanges({ limit: LIMIT, cursor: nextCursor });
      // Page 1 was refetched meanwhile: this page and its cursor belong to the old chain.
      if (epochRef.current !== started) return;
      setItems((list) => [...list, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (epochRef.current === started) setMoreError(codeOf(err));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section
      aria-labelledby="state-history-title"
      className="flex flex-col rounded-lg border border-edge-dark bg-[linear-gradient(180deg,var(--color-surface-housing-hi)_0%,var(--color-surface-housing)_35%,var(--color-surface-housing-lo)_100%)] px-panel-pad-x pb-panel-pad-bottom shadow-[0_4px_0_var(--color-edge-dark)]"
    >
      <div
        className={`${stencil} -mx-panel-pad-x mb-[10px] flex h-panel-title-height items-center justify-between rounded-t-lg border-b-2 border-edge-dark bg-linear-to-b from-surface-title-hi to-surface-title-lo px-[28px] text-text-2`}
      >
        <h2 id="state-history-title" className="text-label-panel">
          Signal-state changes · newest first
        </h2>
        <span className="text-micro text-text-3">Times Asia/Manila</span>
      </div>

      {error && (
        <p
          role="alert"
          className={`${well} ${stencil} mb-[10px] px-[14px] py-[10px] text-label-row text-text`}
        >
          State history unavailable · {error}
        </p>
      )}

      {loaded && items.length === 0 ? (
        <p
          className={`${well} ${stencil} px-[14px] py-[16px] text-label-row text-text-2`}
        >
          No state changes recorded.
        </p>
      ) : (
        items.length > 0 && (
          <table className="w-full table-fixed border-separate border-spacing-y-[5px]">
            <colgroup>
              <col className="w-[170px]" />
              <col className="w-[360px]" />
              <col className="w-[230px]" />
              <col className="w-[230px]" />
              <col className="w-[190px]" />
              <col className="w-[300px]" />
              <col />
            </colgroup>
            <thead>
              <tr className={`${stencil} text-caption text-text-3`}>
                {[
                  "Time",
                  "Level",
                  "NS aspect",
                  "EW aspect",
                  "Flood",
                  "Fault",
                  "Override",
                ].map((h) => (
                  <th key={h} scope="col" className="px-[14px] text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <StateRow
                  // biome-ignore lint/suspicious/noArrayIndexKey: items have no id and two may share a millisecond; the list only appends or is replaced.
                  key={`${item.receivedAt}#${i}`}
                  item={item}
                  older={items[i + 1]}
                  latest={i === 0}
                />
              ))}
            </tbody>
          </table>
        )
      )}

      <div className="mt-[10px] flex items-center gap-[18px]">
        <div
          className={`${well} ${stencil} flex flex-1 items-center gap-[26px] px-[14px] py-[10px] text-caption text-text-2`}
        >
          <span className="flex items-center gap-[9px]">
            <i
              aria-hidden="true"
              className={`size-[22px] rounded-[3px] bg-surface-plate ${changedMark}`}
            />
            Changed from the row below
          </span>
          <span className="flex items-center gap-[9px]">
            <i
              aria-hidden="true"
              className={`h-[22px] w-[10px] rounded-[2px] ${hazardStripes}`}
            />
            {levelVisuals.L4.label}
          </span>
          <span className="flex items-center gap-[9px]">
            <i
              aria-hidden="true"
              className={`h-[22px] w-[10px] rounded-[2px] ${faultChecker}`}
            />
            {faultVisual(true).label}
          </span>
        </div>
        {moreError && (
          <span role="alert" className={`${stencil} text-caption text-text`}>
            Load more failed · {moreError}
          </span>
        )}
        {nextCursor && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className={`${stencil} ${focusRing} h-[52px] rounded-md border border-edge-dark bg-linear-to-b from-surface-plate-hi to-surface-plate px-[22px] text-label-tab text-text shadow-[0_4px_0_var(--color-edge-dark)] disabled:opacity-55`}
          >
            Load more
          </button>
        )}
      </div>
    </section>
  );
}
