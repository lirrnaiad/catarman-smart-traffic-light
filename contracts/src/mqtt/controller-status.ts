import { z } from "zod";
import { Source } from "../enums.ts";

/**
 * `controller/status`: retained. The LWT and the pre-disconnect message use the
 * same shape with `online: false` (AD-5).
 */
export const ControllerStatus = z.object({
  v: z.literal(1),
  online: z.boolean(),
  source: Source,
  /** M2: the ESP32's NVS boot counter, also in the LWT; the serial bridge relays it. */
  bootCount: z.number().int().min(0).optional(),
});
export type ControllerStatus = z.infer<typeof ControllerStatus>;
