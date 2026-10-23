import { z } from "zod";
import { Approach } from "../enums.ts";
import { isoUtc, uuid, vehicleClassId } from "../scalars.ts";

/** SSE `speedAlert` (M2, CAP-10); no REST, never stored. */
export const SpeedAlertItem = z
  .object({
    id: uuid,
    occurredAt: isoUtc,
    receivedAt: isoUtc,
    approach: Approach,
    vehicleClass: vehicleClassId,
    elapsedMs: z.number().int().min(0),
    thresholdMs: z.number().int().min(1),
  })
  .refine((alert) => alert.elapsedMs < alert.thresholdMs, {
    message: "elapsedMs must be less than thresholdMs",
    path: ["elapsedMs"],
  });
export type SpeedAlertItem = z.infer<typeof SpeedAlertItem>;
