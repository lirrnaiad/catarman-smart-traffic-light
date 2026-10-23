import type { z } from "zod";
import { BreachEvent } from "./breach.ts";
import { CountsSlice } from "./counts.ts";
import { DemandSlice } from "./demand.ts";
import { LinkSlice } from "./link.ts";
import { OverrideEvent } from "./override.ts";
import { SpeedAlertEvent } from "./speed-alert.ts";
import { StateSlice } from "./state.ts";

export * from "./breach.ts";
export * from "./counts.ts";
export * from "./demand.ts";
export * from "./link.ts";
export * from "./override.ts";
export * from "./speed-alert.ts";
export * from "./state.ts";

/**
 * Every SSE event name and its data schema (AD-8). Slices (link, state, counts,
 * demand) come first, in the order the hub writes them on connect; then the
 * occurrences (breach, override, speedAlert).
 */
export const streamSchemas = {
  link: LinkSlice,
  state: StateSlice,
  counts: CountsSlice,
  demand: DemandSlice,
  breach: BreachEvent,
  override: OverrideEvent,
  speedAlert: SpeedAlertEvent,
} as const;

export type StreamSchemas = typeof streamSchemas;
export type StreamName = keyof StreamSchemas;
export type StreamData<N extends StreamName> = z.infer<StreamSchemas[N]>;

/** The one SSE wire format: `event: <name>\ndata: <JSON>\n\n`, with the bare value as JSON. */
export function sseFrame<N extends StreamName>(
  name: N,
  data: StreamData<N>,
): string {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}
