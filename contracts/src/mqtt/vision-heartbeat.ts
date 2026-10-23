import { z } from "zod";
import { epochMs } from "../scalars.ts";

/**
 * `vision/heartbeat`: 1 Hz. `ok` is the vision node's own frame-quality verdict;
 * `confidence` and `fps` are informational (AD-17).
 */
export const VisionHeartbeat = z.object({
  v: z.literal(1),
  ts: epochMs,
  seq: z.number().int().min(0),
  ok: z.boolean(),
  confidence: z.number().min(0).max(1),
  fps: z.number().min(0),
});
export type VisionHeartbeat = z.infer<typeof VisionHeartbeat>;
