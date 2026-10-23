import { z } from "zod";
import { Phase } from "../enums.ts";
import { epochMs, uuid } from "../scalars.ts";

/**
 * `controller/override/cmd`: published only by the backend (AD-2). `NONE`
 * releases the override; `phase` is present only with CORRIDOR.
 */
export const ControllerOverrideCmd = z.discriminatedUnion("mode", [
  z.object({
    v: z.literal(1),
    commandId: uuid,
    ts: epochMs,
    mode: z.literal("NONE"),
  }),
  z.object({
    v: z.literal(1),
    commandId: uuid,
    ts: epochMs,
    mode: z.literal("FLASHING_AMBER"),
  }),
  z.object({
    v: z.literal(1),
    commandId: uuid,
    ts: epochMs,
    mode: z.literal("CORRIDOR"),
    phase: Phase,
  }),
]);
export type ControllerOverrideCmd = z.infer<typeof ControllerOverrideCmd>;
