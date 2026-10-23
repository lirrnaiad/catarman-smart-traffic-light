import { z } from "zod";
import { Approach } from "../enums.ts";
import { isoUtc, uuid, vehicleClassId } from "../scalars.ts";

/** SSE `breach` and `GET /api/breaches` items. Never carries crop bytes (AD-11). */
export const BreachItem = z.object({
  id: uuid,
  occurredAt: isoUtc,
  receivedAt: isoUtc,
  approach: Approach,
  vehicleClass: vehicleClassId,
  centroid: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }),
  /** API-relative, `/api/breaches/<id>/crop`; null when there is no crop. */
  cropUrl: z.string().nullable(),
});
export type BreachItem = z.infer<typeof BreachItem>;
