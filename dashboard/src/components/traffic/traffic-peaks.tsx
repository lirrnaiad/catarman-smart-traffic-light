"use client";

import {
  type HourCounts,
  type HourlyCounts,
  HourlyCountsQuery,
  type VehicleClass,
} from "@stl/contracts";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { ApiRequestError } from "../../lib/api/client.ts";
import { getHourlyCounts } from "../../lib/api/counts.ts";
import { useLive, useStreamEpoch } from "../../lib/live/hooks.ts";
import {
  formatManila,
  manilaDayLabel,
  manilaHourLabel,
} from "../../lib/time.ts";
import { useVehicleClasses } from "../../lib/use-vehicle-classes.ts";
import { classColor, colorVar } from "../../lib/visuals.ts";
import { ClassLabel } from "../ui/class-label.tsx";
import { focusRing, stencil } from "../ui/styles.ts";

// Fixed geometry (the 1920×1080 target is fixed; Recharts measures nothing in jsdom).
const W = 1816;
const H = 676;
const M = { top: 96, right: 24, bottom: 16, left: 8 };
const Y_AXIS_W = 64;
const X_AXIS_H = 40;
const PLOT_X = M.left + Y_AXIS_W;
const PLOT_W = W - PLOT_X - M.right;
const PLOT_H = H - M.top - M.bottom - X_AXIS_H;
const BAND = PLOT_W / 24;
const BAR_W = BAND * 0.8; // Recharts' default 10% category gap on each side.

/** The calendar day `delta` days from `date` (pure date arithmetic, no time zone involved). */
function shiftDay(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** A 1/2/5 × 10^k step giving at most 6 gridlines up to `max`. */
function yScale(max: number): { top: number; ticks: number[] } {
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(max / 6)));
  const step =
    [1, 2, 5, 10].map((s) => s * mag).find((s) => Math.ceil(max / s) <= 6) ??
    10 * mag;
  const top = Math.max(step, Math.ceil(max / step) * step);
  return {
    top,
    ticks: Array.from({ length: top / step + 1 }, (_, i) => i * step),
  };
}

type Load = { date: string; data?: HourlyCounts; error?: ApiRequestError };

export function TrafficPeaks() {
  const param = useSearchParams()?.get("date") ?? undefined;
  const today = formatManila(new Date().toISOString(), "date");
  const parsed = HourlyCountsQuery.safeParse({ date: param }).data?.date;
  // A future date has nothing to show yet, so it falls back to today like a bad one.
  const date = parsed && parsed <= today ? parsed : today;
  const isToday = date === today;
  const epoch = useStreamEpoch();
  const slice = useLive("counts");
  // On an hour rollover the finished hour reloads from REST, so it keeps its live counts.
  const liveHourStart = date === today ? slice?.hourStart : undefined;
  const { classes, error: classesError } = useVehicleClasses();
  const [load, setLoad] = useState<Load>({ date });

  // biome-ignore lint/correctness/useExhaustiveDependencies: each stream epoch and live-hour rollover reloads the day.
  useEffect(() => {
    let live = true;
    getHourlyCounts(date).then(
      (data) => live && setLoad({ date, data }),
      (error: ApiRequestError) => live && setLoad({ date, error }),
    );
    return () => {
      live = false;
    };
  }, [date, epoch, liveHourStart]);

  const ready = load.date === date && (classes || classesError);
  let body: ReactNode;
  if (load.date === date && load.error) {
    body = (
      <p role="alert" className={`${stencil} text-label-panel text-text`}>
        Couldn't load traffic · {load.error.code}
      </p>
    );
  } else if (!ready || !load.data) {
    body = (
      <p className={`${stencil} text-label-panel text-text-2`}>
        Loading traffic…
      </p>
    );
  } else {
    // Today's current hour follows the live `counts` slice.
    const liveHour =
      isToday && slice
        ? load.data.buckets.findIndex((b) => b.hourStart === slice.hourStart)
        : -1;
    const buckets =
      liveHour >= 0 && slice
        ? load.data.buckets.map((b, i) => (i === liveHour ? slice : b))
        : load.data.buckets;
    body = buckets.every((b) => b.total === 0) ? (
      <p className={`${stencil} text-label-panel text-text-2`}>
        No vehicles counted.
      </p>
    ) : (
      <Chart
        date={date}
        buckets={buckets}
        liveHour={liveHour}
        classes={classes ?? []}
      />
    );
  }

  const dayBtn = `${stencil} ${focusRing} flex h-[68px] items-center gap-[10px] rounded-md border border-edge-dark px-[18px] text-label-row no-underline`;
  return (
    <div className="h-full px-page-margin pt-[20px] pb-[24px]">
      <section
        aria-label="Hourly vehicle throughput"
        className="flex h-full flex-col rounded-lg border border-edge-dark bg-linear-to-b from-surface-housing-hi via-surface-housing to-surface-housing-lo px-panel-pad-x pb-panel-pad-bottom shadow-[0_4px_0_var(--color-edge-dark)]"
      >
        <h2
          className={`${stencil} -mx-panel-pad-x mb-[14px] flex h-panel-title-height items-center justify-between rounded-t-lg border-b-2 border-edge-dark bg-linear-to-b from-surface-title-hi to-surface-title-lo px-[28px] text-label-panel text-text-2`}
        >
          <span>Hourly vehicle throughput · all approaches</span>
          <span className="text-micro text-text-3">
            Stacked by vehicle class · vehicles per hour
          </span>
        </h2>

        <div className="mb-[12px] flex items-center gap-[12px]">
          <Link
            href={`/traffic/?date=${shiftDay(date, -1)}`}
            className={`${dayBtn} bg-linear-to-b from-surface-plate-hi to-surface-plate text-text`}
          >
            Prev day
          </Link>
          <div className="flex h-[68px] items-center gap-[18px] rounded-md border border-edge-light bg-surface-recess px-[20px]">
            <div className={stencil}>
              <span className="block text-micro text-text-3">
                Date · Asia/Manila
              </span>
              <span className="block text-display-time tabular-nums">
                {manilaDayLabel(date)}
              </span>
            </div>
            {isToday && (
              <span
                className={`${stencil} rounded-sm bg-text px-[9px] py-[6px] text-caption text-text-inverse`}
              >
                Today
              </span>
            )}
          </div>
          {isToday ? (
            <button
              type="button"
              disabled
              className={`${dayBtn} cursor-not-allowed bg-surface-housing text-text-3`}
            >
              Next day
            </button>
          ) : (
            <Link
              href={`/traffic/?date=${shiftDay(date, 1)}`}
              className={`${dayBtn} bg-linear-to-b from-surface-plate-hi to-surface-plate text-text`}
            >
              Next day
            </Link>
          )}
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center rounded-md border border-edge-dark bg-surface-recess shadow-[inset_0_2px_5px_rgba(0,0,0,.65)]">
          {body}
        </div>

        <div
          className={`${stencil} mt-[12px] flex h-[40px] items-center gap-[24px] text-label-control`}
        >
          <span className="text-caption text-text-3">Class</span>
          {(classes ?? []).map((c) => (
            <ClassLabel key={c.id} id={c.id} classes={classes ?? []} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Chart({
  date,
  buckets,
  liveHour,
  classes,
}: {
  date: string;
  buckets: HourCounts[];
  liveHour: number;
  classes: VehicleClass[];
}) {
  // File order first, then any unknown ids (AD-12); summed over the four approaches.
  const ids = [
    ...new Set([
      ...classes.map((c) => c.id),
      ...buckets.flatMap((b) =>
        Object.values(b.byApproach).flatMap(Object.keys),
      ),
    ]),
  ];
  const rows = buckets.map((b) => {
    const row: Record<string, number | string> = {
      hour: manilaHourLabel(b.hourStart),
      total: b.total,
    };
    for (const id of ids)
      row[id] = Object.values(b.byApproach).reduce(
        (sum, a) => sum + (a[id] ?? 0),
        0,
      );
    return row;
  });
  const peak = buckets.reduce(
    (best, b, i) => (b.total > buckets[best].total ? i : best),
    0,
  );
  const peakText = `Peak ${rows[peak].hour} · ${buckets[peak].total} vehicles`;
  const { top, ticks } = yScale(buckets[peak].total * 1.1);
  const cx = (i: number) => PLOT_X + BAND * (i + 0.5);
  const barTop = (i: number) => M.top + PLOT_H * (1 - buckets[i].total / top);
  const label = (id: string) => classes.find((c) => c.id === id)?.label ?? id;
  const tick = {
    fill: colorVar("text-3"),
    className: `${stencil} text-caption`,
  };

  return (
    <div className="relative" style={{ width: W, height: H }}>
      <BarChart
        width={W}
        height={H}
        data={rows}
        margin={M}
        aria-label={`Vehicles per hour by class. ${peakText}.`}
      >
        <CartesianGrid vertical={false} stroke={colorVar("edge-light")} />
        <XAxis
          dataKey="hour"
          height={X_AXIS_H}
          interval={0}
          tick={tick}
          tickLine={false}
        />
        <YAxis
          width={Y_AXIS_W}
          domain={[0, top]}
          ticks={ticks}
          tick={tick}
          tickLine={false}
          axisLine={false}
        />
        {ids.map((id) => (
          <Bar
            key={id}
            dataKey={id}
            name={label(id)}
            stackId="hour"
            fill={colorVar(classColor(id, classes))}
            isAnimationActive={false}
          />
        ))}
      </BarChart>

      <svg
        aria-hidden="true"
        width={W}
        height={H}
        className="pointer-events-none absolute inset-0"
      >
        <path
          d={`M${cx(peak)} 40V${barTop(peak) - 6}`}
          stroke={colorVar("text")}
          strokeWidth={2}
        />
        {liveHour >= 0 && (
          <rect
            x={cx(liveHour) - BAR_W / 2}
            y={barTop(liveHour) - 14}
            width={BAR_W}
            height={14}
            fill="none"
            stroke={colorVar("status-ok")}
            strokeWidth={2}
            strokeDasharray="5 4"
            data-live-cap
          />
        )}
      </svg>

      <div
        className={`${stencil} absolute top-[12px] w-[340px] rounded-md border border-edge-dark bg-text px-[16px] py-[10px] text-text-inverse shadow-[0_4px_0_var(--color-edge-dark)]`}
        style={{ left: Math.min(Math.max(cx(peak) - 170, 8), W - 348) }}
      >
        <span className="block text-micro text-surface-plate">
          Busiest hour
        </span>
        <span className="block text-value-md tabular-nums">{peakText}</span>
      </div>

      {liveHour >= 0 && (
        <div
          className={`${stencil} absolute flex items-center gap-[8px] rounded border border-status-ok-deep bg-surface-recess px-[12px] py-[7px] text-label-sub tabular-nums`}
          style={{
            top: Math.max(M.top, barTop(liveHour) - 50),
            ...(liveHour < 20
              ? { left: cx(liveHour) + BAR_W / 2 + 8 }
              : { right: W - (cx(liveHour) - BAR_W / 2 - 8) }),
          }}
        >
          <i
            aria-hidden="true"
            className="size-[12px] rounded-xs border-2 border-status-ok-deep bg-status-ok"
          />
          Live · {buckets[liveHour].total} so far
        </div>
      )}

      {/* A table ignores sr-only's 1px box, so the wrapper clips it. */}
      <div className="sr-only">
        <table>
          <caption>
            Vehicles per hour by class, {manilaDayLabel(date)}, Asia/Manila
          </caption>
          <thead>
            <tr>
              <th scope="col">Hour</th>
              {ids.map((id) => (
                <th key={id} scope="col">
                  {label(id)}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.hour}>
                <th scope="row">
                  {i === liveHour ? `${r.hour} (live)` : r.hour}
                </th>
                {ids.map((id) => (
                  <td key={id}>{r[id]}</td>
                ))}
                <td>{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
