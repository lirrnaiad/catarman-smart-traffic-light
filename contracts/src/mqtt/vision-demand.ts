import { z } from "zod";
import { epochMs } from "../scalars.ts";

const pcu = z.number().min(0);

/**
 * `vision/demand`: on change, leading-edge throttled to at most 10 Hz. Each
 * value is the sum of the PCU weights currently inside that approach's ROI;
 * 0 when empty, never a rate (AD-12, AD-17).
 */
export const VisionDemand = z.object({
  v: z.literal(1),
  ts: epochMs,
  pcu: z.object({ N: pcu, S: pcu, E: pcu, W: pcu }),
});
export type VisionDemand = z.infer<typeof VisionDemand>;
