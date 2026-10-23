import { z } from "zod";
import { Source } from "../enums.ts";

/**
 * `vision/status`: retained. The LWT and the pre-disconnect message use the
 * same shape with `online: false` (AD-5).
 */
export const VisionStatus = z.object({
  v: z.literal(1),
  online: z.boolean(),
  source: Source,
});
export type VisionStatus = z.infer<typeof VisionStatus>;
