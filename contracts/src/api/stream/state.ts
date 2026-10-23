import type { z } from "zod";
import { ControllerState } from "../../mqtt/controller-state.ts";
import { isoUtc } from "../../scalars.ts";

/**
 * SSE `state` slice, nullable: the `controller/state` payload without `v`, plus
 * `receivedAt`. Writer: services/state.ts.
 */
export const StateSlice = ControllerState.omit({ v: true })
  .extend({ receivedAt: isoUtc })
  .nullable();
export type StateSlice = z.infer<typeof StateSlice>;
