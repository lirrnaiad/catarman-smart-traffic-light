import { z } from "zod";
import { CommandStatus, OverrideMode, Phase } from "../enums.ts";
import { isoUtc, rejectionReason, uuid } from "../scalars.ts";

/** `POST /api/overrides` body. `phase` is required with CORRIDOR. */
export const OverrideRequest = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("NONE") }),
  z.object({ mode: z.literal("FLASHING_AMBER") }),
  z.object({ mode: z.literal("CORRIDOR"), phase: Phase }),
]);
export type OverrideRequest = z.infer<typeof OverrideRequest>;

/** SSE `override`, the 202 response and `GET /api/overrides` items (AD-7). */
export const OverrideCommand = z.object({
  commandId: uuid,
  mode: OverrideMode,
  phase: Phase.nullable(),
  status: CommandStatus,
  reason: rejectionReason.nullable(),
  requestedAt: isoUtc,
  resolvedAt: isoUtc.nullable(),
});
export type OverrideCommand = z.infer<typeof OverrideCommand>;
