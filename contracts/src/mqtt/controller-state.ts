import { z } from "zod";
import { Aspect, Flood, Level, Phase, Power } from "../enums.ts";
import { uuid } from "../scalars.ts";

/**
 * `state.override`: the last command applied, from the moment it is applied
 * (AD-7 rule 6). `phase` is present only with CORRIDOR. `commandId` is absent
 * only before the first command since boot, so only the NONE variant may omit it.
 */
export const StateOverride = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("NONE"), commandId: uuid.optional() }),
  z.object({ mode: z.literal("FLASHING_AMBER"), commandId: uuid }),
  z.object({ mode: z.literal("CORRIDOR"), phase: Phase, commandId: uuid }),
]);
export type StateOverride = z.infer<typeof StateOverride>;

/**
 * `controller/state`: retained; published on every change and at least every
 * 2 s; at most 512 bytes. Controller payloads carry no `ts` (AD-6).
 */
export const ControllerState = z.object({
  v: z.literal(1),
  level: Level,
  signals: z.object({ NS: Aspect, EW: Aspect }),
  flood: Flood,
  /** A conflict-monitor fault: forces FLASHING_AMBER on both phases; `level` keeps the automatic level. */
  fault: z.boolean(),
  /** Absent only before the first command since boot. */
  override: StateOverride.optional(),
  /** M2: ceil(ms left / 1000) in the interval now running; absent while nothing is timed. */
  remainingS: z.number().int().min(0).optional(),
  /** M2: from the GPIO 35 sense. */
  power: Power.optional(),
});
export type ControllerState = z.infer<typeof ControllerState>;
