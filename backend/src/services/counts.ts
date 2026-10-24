import {
  Approach,
  type ClassCounts,
  type HourCounts,
  type HourlyCounts,
} from "@stl/contracts";
import vehicleClasses from "@stl/contracts/vehicle-classes.json" with {
  type: "json",
};
import type { Pool } from "../db/pool.ts";
import {
  type HourSum,
  vehicleCountsByHour,
} from "../db/repositories/vehicle_count.by-hour.ts";
import type { Hub } from "../sse/hub.ts";

const HOUR_MS = 3_600_000;
const CLASS_IDS = vehicleClasses.map((c) => c.id);

/** Asia/Manila is UTC+8 with no DST, so its hours start on UTC hours. */
export function manilaHourStart(now: Date): Date {
  return new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
}

/** Dense per approach: configured ids in file order at 0, then unknown ids seen this hour (AD-12). */
function bucket(hourStart: Date, sums: HourSum[]): HourCounts {
  const ids = [...new Set([...CLASS_IDS, ...sums.map((s) => s.vehicleClass)])];
  const empty = (): ClassCounts => Object.fromEntries(ids.map((id) => [id, 0]));
  const byApproach = Object.fromEntries(
    Approach.options.map((a) => [a, empty()]),
  ) as HourCounts["byApproach"];
  let total = 0;
  for (const s of sums) {
    byApproach[s.approach][s.vehicleClass] += s.count;
    total += s.count;
  }
  return { hourStart: hourStart.toISOString(), total, byApproach };
}

async function writeSlice(
  { pool, hub }: { pool: Pool; hub: Hub },
  now: Date,
): Promise<void> {
  const start = manilaHourStart(now);
  const end = new Date(start.getTime() + HOUR_MS);
  hub.setSlice(
    "counts",
    bucket(start, await vehicleCountsByHour(pool, start, end)),
  );
}

let flight: Promise<void> | undefined;
let next: { ctx: { pool: Pool; hub: Hub }; now: Date } | undefined;

/**
 * The only `counts` slice writer (AD-8): re-reads the Manila hour containing `now`.
 * Single-flight: calls during a run coalesce into one more run with the latest args.
 * Never rejects; a failed read is logged and the slice keeps its last value.
 */
export function refreshCounts(
  ctx: { pool: Pool; hub: Hub },
  now: Date,
): Promise<void> {
  next = { ctx, now };
  flight ??= (async () => {
    try {
      while (next) {
        const run = next;
        next = undefined;
        try {
          await writeSlice(run.ctx, run.now);
        } catch (err) {
          console.error("[job] counts refresh failed:", (err as Error).message);
        }
      }
    } finally {
      flight = undefined;
    }
  })();
  return flight;
}

/** The 24 Manila-hour buckets of an Asia/Manila `YYYY-MM-DD`, dense zeros included. */
export async function hourlyCounts(
  pool: Pool,
  date: string,
): Promise<HourlyCounts> {
  const start = Date.parse(`${date}T00:00:00+08:00`);
  const sums = await vehicleCountsByHour(
    pool,
    new Date(start),
    new Date(start + 24 * HOUR_MS),
  );
  const buckets = Array.from({ length: 24 }, (_, h) =>
    bucket(
      new Date(start + h * HOUR_MS),
      sums.filter((s) => s.hour === h),
    ),
  );
  return { date, buckets };
}
