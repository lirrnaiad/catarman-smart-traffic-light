import type { ControllerState } from "@stl/contracts";
import type { Hub } from "../sse/hub.ts";

/**
 * The sole writer of the `state` slice (AD-8). Written on every message, never
 * compared with the last value; a retained copy loses `remainingS`, since its
 * interval may have ended long ago (AD-6).
 */
export function writeState(
  hub: Hub,
  payload: ControllerState,
  receivedAt: number,
  retained: boolean,
): void {
  const { v: _v, remainingS, ...rest } = payload;
  hub.setSlice("state", {
    ...rest,
    ...(retained || remainingS === undefined ? {} : { remainingS }),
    receivedAt: new Date(receivedAt).toISOString(),
  });
}
