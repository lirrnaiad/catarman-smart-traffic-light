import { z } from "zod";
import { Approach } from "../enums.ts";
import { epochMs, uuid, vehicleClassId } from "../scalars.ts";

export const Crossing = z.object({
  approach: Approach,
  vehicleClass: vehicleClassId,
  count: z.number().int().min(1),
});
export type Crossing = z.infer<typeof Crossing>;

/**
 * `vision/counts`: crossings since the previous message; at most once per
 * second; not sent when there were none. Each approach + vehicleClass pair
 * appears at most once. `ts` is optional (AD-6: occurredAt is ts when present).
 */
export const VisionCounts = z.object({
  v: z.literal(1),
  id: uuid,
  ts: epochMs.optional(),
  crossings: z
    .array(Crossing)
    .min(1)
    .refine(
      (crossings) =>
        new Set(crossings.map((c) => `${c.approach}:${c.vehicleClass}`))
          .size === crossings.length,
      { message: "Each approach + vehicleClass pair appears at most once" },
    )
    .meta({
      description:
        "Each approach + vehicleClass pair appears at most once; count is an integer >= 1.",
    }),
});
export type VisionCounts = z.infer<typeof VisionCounts>;
