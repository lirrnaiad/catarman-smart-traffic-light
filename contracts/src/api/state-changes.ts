import { z } from "zod";
import { Aspect, Flood, Level } from "../enums.ts";
import { StateOverride } from "../mqtt/controller-state.ts";
import { isoUtc } from "../scalars.ts";

/**
 * `GET /api/state-changes` items: one stored signal-state change (AD-5). No row id
 * (Public ids convention). `overrideEnded` is true for a `{NONE, X}` override
 * where X was not a release: the override ended on its own (link loss or fault).
 */
export const StateChangeItem = z.object({
  receivedAt: isoUtc,
  level: Level,
  signals: z.object({ NS: Aspect, EW: Aspect }),
  flood: Flood,
  fault: z.boolean(),
  override: StateOverride.nullable(),
  overrideEnded: z.boolean(),
});
export type StateChangeItem = z.infer<typeof StateChangeItem>;
