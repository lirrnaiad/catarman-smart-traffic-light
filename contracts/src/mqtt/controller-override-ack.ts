import { z } from "zod";
import { rejectionReason, uuid } from "../scalars.ts";

/**
 * `controller/override/ack`: sent within 1 s of receiving the command (AD-7).
 * A rejection carries an UPPER_SNAKE `reason`; unknown codes parse.
 */
export const ControllerOverrideAck = z.discriminatedUnion("result", [
  z.object({
    v: z.literal(1),
    commandId: uuid,
    result: z.literal("APPLIED"),
  }),
  z.object({
    v: z.literal(1),
    commandId: uuid,
    result: z.literal("REJECTED"),
    reason: rejectionReason,
  }),
]);
export type ControllerOverrideAck = z.infer<typeof ControllerOverrideAck>;
