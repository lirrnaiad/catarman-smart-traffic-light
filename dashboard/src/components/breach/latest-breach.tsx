"use client";

import type { BreachItem } from "@stl/contracts";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listBreaches } from "../../lib/api/breaches.ts";
import type { ApiRequestError } from "../../lib/api/client.ts";
import { useLiveEvent, useStreamEpoch } from "../../lib/live/hooks.ts";
import { formatManila } from "../../lib/time.ts";
import { useVehicleClasses } from "../../lib/use-vehicle-classes.ts";
import { approachVisuals } from "../../lib/visuals.ts";
import { NoData, Panel, well } from "../live/panel.tsx";
import { ClassLabel } from "../ui/class-label.tsx";
import { focusRing, stencil } from "../ui/styles.ts";
import { CropThumb } from "./crop-thumb.tsx";

const newer = (a: BreachItem | null, b: BreachItem) =>
  a && a.receivedAt > b.receivedAt ? a : b;

/** The Latest breach card on `/` (EXPERIENCE → Latest breach card); opens `/breaches/?id=`. */
export function LatestBreach() {
  const epoch = useStreamEpoch();
  const { classes } = useVehicleClasses();
  // undefined: page 1 not loaded yet; null: no breach stored.
  const [item, setItem] = useState<BreachItem | null | undefined>(undefined);
  const [error, setError] = useState<ApiRequestError | null>(null);

  // Newest breach on mount and on each stream epoch.
  // biome-ignore lint/correctness/useExhaustiveDependencies: epoch is the trigger, not an input.
  useEffect(() => {
    let mounted = true;
    listBreaches({ limit: 1 }).then(
      (page) => {
        if (!mounted) return;
        const [first] = page.items;
        // A live breach that landed while this was in flight is newer; keep it.
        setItem((prev) =>
          first ? newer(prev ?? null, first) : (prev ?? null),
        );
        setError(null);
      },
      (err: ApiRequestError) => mounted && setError(err),
    );
    return () => {
      mounted = false;
    };
  }, [epoch]);

  useLiveEvent("breach", (b) => {
    setItem(b);
    setError(null);
  });

  return (
    <Panel
      title="Latest breach"
      tag="Red-light running · anonymized"
      of="vision"
      since={item?.receivedAt}
    >
      {error && (
        <p
          role="alert"
          className={`${stencil} mb-[8px] rounded-sm border-l-[6px] border-hazard-paint bg-surface-housing px-[14px] py-[10px] text-label-control`}
        >
          Could not load breaches · {error.code}
        </p>
      )}
      {item ? (
        <Link
          href={`/breaches/?id=${item.id}`}
          aria-label={`Latest breach: ${formatManila(item.occurredAt)}, ${approachVisuals[item.approach].label}, ${classes?.find((c) => c.id === item.vehicleClass)?.label ?? item.vehicleClass}. Open in the breach log`}
          className={`${focusRing} flex items-center gap-[18px] rounded-md`}
        >
          <CropThumb cropUrl={item.cropUrl} />
          <div className={stencil}>
            <div className="text-display-time tabular-nums">
              {formatManila(item.occurredAt)}
            </div>
            <div className="mt-[8px] text-label-row text-text-2">
              {approachVisuals[item.approach].label}
            </div>
            <div className="mt-[4px] text-label-row text-text-2">
              <ClassLabel id={item.vehicleClass} classes={classes ?? []} />
            </div>
          </div>
        </Link>
      ) : item === null ? (
        <p
          className={`${well} ${stencil} px-[14px] py-[16px] text-label-row text-text-2`}
        >
          No breaches recorded.
        </p>
      ) : (
        !error && <NoData />
      )}
    </Panel>
  );
}
