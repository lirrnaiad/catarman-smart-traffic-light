import { z } from "zod";
import { Approach } from "../enums.ts";
import { epochMs, uuid, vehicleClassId } from "../scalars.ts";

/**
 * Optional in v1 and deliberately unconstrained, so a bad crop never fails the
 * envelope (AD-4, AD-11). The backend checks it and stores the breach without a
 * crop when a check fails.
 */
export const BreachCrop = z
  .object({ mime: z.string(), data: z.string() })
  .meta({
    description:
      'An anonymized baseline JPEG without EXIF: mime "image/jpeg", data base64, ' +
      "at most 64 px on its long side and at most 204,800 base64 characters, " +
      "scaled down and then blurred before encoding. The backend checks these " +
      "limits, not the schema (AD-11).",
  });
export type BreachCrop = z.infer<typeof BreachCrop>;

/** `vision/breach`: `centroid` is in normalized frame coordinates (0 to 1). */
export const VisionBreach = z.object({
  v: z.literal(1),
  id: uuid,
  ts: epochMs.optional(),
  approach: Approach,
  vehicleClass: vehicleClassId,
  centroid: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }),
  crop: BreachCrop.optional(),
});
export type VisionBreach = z.infer<typeof VisionBreach>;
