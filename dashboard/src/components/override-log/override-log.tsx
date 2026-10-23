"use client";

import type { ErrorCode, OverrideCommand } from "@stl/contracts";
import { useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../../lib/api/client.ts";
import { listOverrides } from "../../lib/api/overrides.ts";
import { useLiveEvent, useStreamEpoch } from "../../lib/live/hooks.ts";
import { formatManila } from "../../lib/time.ts";
import {
  commandStatusVisuals,
  overrideModeVisuals,
  phaseVisuals,
  rejectionReasonVisual,
} from "../../lib/visuals.ts";
import { well } from "../live/panel.tsx";
import { focusRing, hazardStripes, stencil } from "../ui/styles.ts";

const LIMIT = 50;

/** True when `a` sorts before `b`: newest first by requestedAt, then commandId (the API's order). */
const newer = (a: OverrideCommand, b: OverrideCommand) =>
  a.requestedAt === b.requestedAt
    ? a.commandId > b.commandId
    : a.requestedAt > b.requestedAt;

/**
 * A known id is replaced where it stands; a new id goes in at its sorted place.
 * With `more` pages unloaded, a row older than the last loaded one is skipped: Load more brings it.
 */
function upsert(
  list: OverrideCommand[],
  cmd: OverrideCommand,
  more: boolean,
): OverrideCommand[] {
  const i = list.findIndex((c) => c.commandId === cmd.commandId);
  if (i >= 0) return list.with(i, cmd);
  const at = list.findIndex((c) => newer(cmd, c));
  if (at >= 0) return list.toSpliced(at, 0, cmd);
  return more ? list : [...list, cmd];
}

const codeOf = (err: unknown): ErrorCode =>
  err instanceof ApiRequestError ? err.code : "INTERNAL";

/** Neutral text plate; REJECTED and TIMEOUT add a hazard edge, never red (DESIGN → Log table). */
export function StatusPlate({ status }: { status: OverrideCommand["status"] }) {
  const hazard = status === "REJECTED" || status === "TIMEOUT";
  const frame =
    status === "REQUESTED"
      ? "border-2 border-status-ok bg-surface-recess"
      : "border border-edge-dark bg-linear-to-b from-surface-plate-hi to-surface-plate shadow-[0_2px_0_var(--color-edge-dark)]";
  return (
    <span
      data-status={status}
      className={`${stencil} inline-flex min-h-[30px] items-stretch overflow-hidden rounded text-label-link text-text ${frame}`}
    >
      {hazard && (
        <span
          data-hazard=""
          aria-hidden="true"
          className={`${hazardStripes} w-[12px] shrink-0`}
        />
      )}
      <span className="flex items-center px-[10px] py-[4px]">
        {commandStatusVisuals[status].label}
      </span>
    </span>
  );
}

function Time({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-label-row text-text-3">—</span>;
  return (
    <>
      <span className="block text-value-md tabular-nums">
        {formatManila(iso)}
      </span>
      <span className="mt-[3px] block text-micro text-text-3 tabular-nums">
        {formatManila(iso, "date")}
      </span>
    </>
  );
}

export function OverrideRow({ cmd }: { cmd: OverrideCommand }) {
  const cell = "bg-surface-recess px-[14px] py-[8px] align-middle";
  return (
    <tr data-command-id={cmd.commandId} className={stencil}>
      <td
        className={`${cell} rounded-l-[5px] shadow-[inset_4px_0_0_var(--color-surface-plate)]`}
      >
        <Time iso={cmd.requestedAt} />
      </td>
      <td className={`${cell} text-label-row`}>
        {overrideModeVisuals[cmd.mode].label}
        {cmd.phase && ` ${phaseVisuals[cmd.phase].label}`}
      </td>
      <td className={cell}>
        <StatusPlate status={cmd.status} />
      </td>
      <td className={`${cell} text-label-row`}>
        {cmd.reason ? (
          rejectionReasonVisual(cmd.reason).label
        ) : (
          <span className="text-text-3">—</span>
        )}
      </td>
      <td className={`${cell} rounded-r-[5px]`}>
        <Time iso={cmd.resolvedAt} />
      </td>
    </tr>
  );
}

/** `/log/overrides/`: newest first, SSE `override` upserted by `commandId` (EXPERIENCE → Override log). */
export function OverrideLog() {
  const [items, setItems] = useState<OverrideCommand[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<ErrorCode | null>(null);
  // SSE rows seen while page 1 is in flight, replayed over it so a stale read can't undo them.
  const inFlight = useRef<OverrideCommand[] | null>(null);
  const epoch = useStreamEpoch();
  const epochRef = useRef(epoch);
  epochRef.current = epoch;

  useLiveEvent("override", (cmd) => {
    inFlight.current?.push(cmd);
    setItems((list) => upsert(list, cmd, nextCursor !== null));
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: refetch page 1 on every stream epoch.
  useEffect(() => {
    let current = true;
    const seen: OverrideCommand[] = [];
    inFlight.current = seen;
    listOverrides({ limit: LIMIT }).then(
      (page) => {
        if (!current) return;
        inFlight.current = null;
        const more = page.nextCursor !== null;
        setItems(seen.reduce((l, c) => upsert(l, c, more), page.items));
        setNextCursor(page.nextCursor);
        setError(null);
        setMoreError(null);
        setLoaded(true);
      },
      (err: unknown) => {
        if (!current) return;
        inFlight.current = null;
        setError(codeOf(err));
      },
    );
    return () => {
      current = false;
      if (inFlight.current === seen) inFlight.current = null;
    };
  }, [epoch]);

  async function loadMore() {
    if (!nextCursor) return;
    const started = epoch;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await listOverrides({ limit: LIMIT, cursor: nextCursor });
      // Page 1 was refetched meanwhile: this page and its cursor belong to the old chain.
      if (epochRef.current !== started) return;
      setItems((list) => [
        ...list,
        ...page.items.filter(
          (c) => !list.some((k) => k.commandId === c.commandId),
        ),
      ]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (epochRef.current === started) setMoreError(codeOf(err));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section
      aria-labelledby="override-log-title"
      className="flex flex-col rounded-lg border border-edge-dark bg-[linear-gradient(180deg,var(--color-surface-housing-hi)_0%,var(--color-surface-housing)_35%,var(--color-surface-housing-lo)_100%)] px-panel-pad-x pb-panel-pad-bottom shadow-[0_4px_0_var(--color-edge-dark)]"
    >
      <div
        className={`${stencil} -mx-panel-pad-x mb-[10px] flex h-panel-title-height items-center justify-between rounded-t-lg border-b-2 border-edge-dark bg-linear-to-b from-surface-title-hi to-surface-title-lo px-[28px] text-text-2`}
      >
        <h2 id="override-log-title" className="text-label-panel">
          MDRRMO commands · newest first
        </h2>
        <span className="text-micro text-text-3">Times Asia/Manila</span>
      </div>

      {error && (
        <p
          role="alert"
          className={`${well} ${stencil} mb-[10px] px-[14px] py-[10px] text-label-row text-text`}
        >
          Override log unavailable · {error}
        </p>
      )}

      {loaded && items.length === 0 ? (
        <p
          className={`${well} ${stencil} px-[14px] py-[16px] text-label-row text-text-2`}
        >
          No overrides yet.
        </p>
      ) : (
        items.length > 0 && (
          <table className="w-full table-fixed border-separate border-spacing-y-[5px]">
            <colgroup>
              <col className="w-[200px]" />
              <col className="w-[330px]" />
              <col className="w-[420px]" />
              <col />
              <col className="w-[200px]" />
            </colgroup>
            <thead>
              <tr className={`${stencil} text-caption text-text-3`}>
                {["Requested", "Mode", "Status", "Reason", "Resolved"].map(
                  (h) => (
                    <th key={h} scope="col" className="px-[14px] text-left">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((cmd) => (
                <OverrideRow key={cmd.commandId} cmd={cmd} />
              ))}
            </tbody>
          </table>
        )
      )}

      <div className="mt-[10px] flex items-center gap-[18px]">
        <p
          className={`${well} ${stencil} flex-1 px-[14px] py-[10px] text-caption text-text-2`}
        >
          A corridor that ended on its own (link lost for 60 s, or a conflict
          fault) appears in State history, not here.
        </p>
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
