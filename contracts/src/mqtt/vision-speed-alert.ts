import { z } from "zod";
import { Approach } from "../enums.ts";
import { epochMs, uuid, vehicleClassId } from "../scalars.ts";

/**
 * `vision/speed-alert` (M2, CAP-10): an uncalibrated mockup, not a measurement.
 * Integer milliseconds; thresholdMs >= 1 and 0 <= elapsedMs < thresholdMs.
 */
export const VisionSpeedAlert = z
  .object({
    v: z.literal(1),
    id: uuid,
    ts: epochMs.optional(),
    approach: Approach,
    vehicleClass: vehicleClassId,
    elapsedMs: z.number().int().min(0),
    thresholdMs: z.number().int().min(1),
  })
  .refine((alert) => alert.elapsedMs < alert.thresholdMs, {
    message: "elapsedMs must be less than thresholdMs",
    path: ["elapsedMs"],
  })
  .meta({
    description:
      "Crossed two virtual lines on one approach in elapsedMs < thresholdMs; an uncalibrated mockup.",
  });
export type VisionSpeedAlert = z.infer<typeof VisionSpeedAlert>;
