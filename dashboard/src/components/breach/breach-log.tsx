"use client";

import type { BreachItem } from "@stl/contracts";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { listBreaches } from "../../lib/api/breaches.ts";
import type { ApiRequestError } from "../../lib/api/client.ts";
import { useLiveEvent, useStreamEpoch } from "../../lib/live/hooks.ts";
import { formatManila } from "../../lib/time.ts";
import { useVehicleClasses } from "../../lib/use-vehicle-classes.ts";
import { approachVisuals } from "../../lib/visuals.ts";
import { ClassLabel } from "../ui/class-label.tsx";
import { focusRing, stencil } from "../ui/styles.ts";
import { CropThumb } from "./crop-thumb.tsx";

const LIMIT = 50;
const cell = "h-[66px] bg-surface-recess px-[14px] text-left";

/** The red-light breach log (EXPERIENCE → Breach log): newest first, live upserts, Load more, `?id=` marking. */
export function BreachLog() {
  const target = useSearchParams().get("id");
  const epoch = useStreamEpoch();
  const { classes } = useVehicleClasses();
  const [rows, setRows] = useState<BreachItem[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const marked = useRef<HTMLTableRowElement>(null);
  const scrolledTo = useRef<string | null>(null);
  // A Load more answered after a new epoch belongs to the old page 1; it is dropped.
  const epochRef = useRef(epoch);
  epochRef.current = epoch;

  // Page 1 on mount and on each stream epoch, replacing the rows.
  // biome-ignore lint/correctness/useExhaustiveDependencies: epoch is the trigger, not an input.
  useEffect(() => {
    let mounted = true;
    listBreaches({ limit: LIMIT }).then(
      (page) => {
        if (!mounted) return;
        setRows(page.items);
        setNext(page.nextCursor);
        setError(null);
      },
      (err: ApiRequestError) => mounted && setError(err),
    );
    return () => {
      mounted = false;
    };
  }, [epoch]);

  // shortcut: a breach that lands while page 1 is in flight shows once the response arrives (it is stored before it is emitted).
  useLiveEvent("breach", (item) =>
    setRows((prev) => prev && [item, ...prev.filter((r) => r.id !== item.id)]),
  );

  // Scroll to the deep-linked row once it is loaded; never fetch extra pages to find it.
  const found = rows?.some((r) => r.id === target) ?? false;
  useEffect(() => {
    if (!found || scrolledTo.current === target) return;
    scrolledTo.current = target;
    marked.current?.scrollIntoView({ block: "center" });
  }, [found, target]);

  async function loadMore() {
    if (next === null) return;
    setLoadingMore(true);
    const at = epoch;
    try {
      const page = await listBreaches({ limit: LIMIT, cursor: next });
      if (epochRef.current !== at) return;
      setRows((prev) => {
        const seen = new Set(prev?.map((r) => r.id));
        return [...(prev ?? []), ...page.items.filter((r) => !seen.has(r.id))];
      });
      setNext(page.nextCursor);
      setError(null);
    } catch (err) {
      if (epochRef.current === at) setError(err as ApiRequestError);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section
      aria-labelledby="breach-log-title"
      className="px-page-margin py-[20px]"
    >
      <h1
        id="breach-log-title"
        className={`${stencil} mb-[12px] text-label-panel text-text-2`}
      >
        Red-light breaches · newest first
      </h1>
      {error && (
        <p
          role="alert"
          className={`${stencil} mb-[12px] rounded-sm border-l-[6px] border-hazard-paint bg-surface-housing px-[14px] py-[10px] text-label-control`}
        >
          Could not load breaches · {error.code}
        </p>
      )}
      {rows === null && !error && (
        <p
          role="status"
          className={`${stencil} py-[20px] text-label-row text-text-3`}
        >
          Loading breaches…
        </p>
      )}
      {rows?.length === 0 && (
        <p className={`${stencil} py-[20px] text-label-row text-text-3`}>
          No breaches recorded.
        </p>
      )}
      {rows && rows.length > 0 && (
        <table className="w-full border-separate border-spacing-y-[5px]">
          <thead>
            <tr className={`${stencil} text-caption text-text-3`}>
              <th scope="col" className="px-[14px] text-left">
                Time · Asia/Manila
              </th>
              <th scope="col" className="px-[14px] text-left">
                Approach
              </th>
              <th scope="col" className="px-[14px] text-left">
                Vehicle class
              </th>
              <th scope="col" className="px-[14px] text-left">
                Crop
              </th>
            </tr>
          </thead>
          <tbody className={stencil}>
            {rows.map((b) => {
              const isTarget = b.id === target;
              const band = isTarget
                ? "bg-linear-to-b from-surface-plate to-surface-title-hi"
                : "";
              return (
                <tr
                  key={b.id}
                  ref={isTarget ? marked : undefined}
                  aria-current={isTarget ? "true" : undefined}
                  data-id={b.id}
                >
                  <th
                    scope="row"
                    className={`${cell} ${band} rounded-l-[5px] font-extrabold ${
                      isTarget
                        ? "shadow-[inset_6px_0_0_var(--color-text)]"
                        : "shadow-[inset_4px_0_0_var(--color-surface-plate)]"
                    }`}
                  >
                    <span className="block text-[32px] leading-none tabular-nums">
                      {formatManila(b.occurredAt)}
                    </span>
                    <span className="mt-[3px] block text-caption text-text-3 tabular-nums">
                      {formatManila(b.occurredAt, "date")}
                    </span>
                  </th>
                  <td className={`${cell} ${band} text-label-row`}>
                    <span className="inline-flex items-center gap-[12px]">
                      <span className="grid size-[40px] place-items-center rounded border border-edge-dark bg-linear-to-b from-surface-plate-hi to-surface-plate text-[26px]">
                        {b.approach}
                      </span>
                      <span className="text-text-2">
                        {approachVisuals[b.approach].label}
                      </span>
                    </span>
                  </td>
                  <td className={`${cell} ${band} text-label-row`}>
                    <ClassLabel id={b.vehicleClass} classes={classes ?? []} />
                  </td>
                  <td className={`${cell} ${band} rounded-r-[5px] py-[4px]`}>
                    <CropThumb cropUrl={b.cropUrl} width={87} height={58} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {next !== null && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className={`${stencil} ${focusRing} mt-[10px] h-[56px] rounded-md border border-edge-dark bg-linear-to-b from-surface-housing-hi to-surface-housing px-[22px] text-label-control text-text shadow-[0_3px_0_var(--color-edge-dark)] disabled:text-text-3`}
        >
          Load more
        </button>
      )}
    </section>
  );
}
