import { z } from "zod";
import { isoUtc, vehicleClassId } from "../scalars.ts";

/** Dense: every configured class id (0 when none) plus any unknown id seen. */
export const ClassCounts = z.record(vehicleClassId, z.number().int().min(0));
export type ClassCounts = z.infer<typeof ClassCounts>;

/** SSE `counts` and each bucket of `GET /api/counts/hourly`. */
export const HourCounts = z.object({
  /** The UTC instant of the Asia/Manila hour start. */
  hourStart: isoUtc,
  total: z.number().int().min(0),
  byApproach: z.object({
    N: ClassCounts,
    S: ClassCounts,
    E: ClassCounts,
    W: ClassCounts,
  }),
});
export type HourCounts = z.infer<typeof HourCounts>;

/** `GET /api/counts/hourly`: exactly 24 buckets for one Asia/Manila date. */
export const HourlyCounts = z.object({
  date: z.iso.date(),
  buckets: z.array(HourCounts).length(24),
});
export type HourlyCounts = z.infer<typeof HourlyCounts>;

/** `GET /api/counts/hourly?date=YYYY-MM-DD`; `date` defaults to today in Asia/Manila. */
export const HourlyCountsQuery = z.object({
  date: z.iso.date().optional(),
});
export type HourlyCountsQuery = z.infer<typeof HourlyCountsQuery>;
