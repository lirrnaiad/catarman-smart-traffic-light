import type { ControllerState, ControllerStatus } from "@stl/contracts";
import type { ReplCtx } from "../repl.ts";

/** A REPL command a behavior adds; returns the text to print, if any. */
export type BehaviorCommand = (
  args: string[],
  ctx: ReplCtx,
) => string | undefined;

/**
 * A pluggable simulator behavior (AD-14). `state` and `status` return extra
 * fields merged into the controller's payloads; `commands` join the REPL.
 */
export type Behavior = {
  name: string;
  state?(s: ControllerState): Partial<ControllerState> | undefined;
  status?(s: ControllerStatus): Partial<ControllerStatus> | undefined;
  commands?: Record<string, BehaviorCommand>;
};

// One alphabetical registration line per behavior file.
export const behaviors: Behavior[] = [];
