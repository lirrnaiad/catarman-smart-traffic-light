import type { VisionDemand } from "@stl/contracts";
import type { Hub } from "../sse/hub.ts";

const HOLD_MS = 250;

type Pcu = VisionDemand["pcu"];
type Throttle = {
  timer?: ReturnType<typeof setTimeout>;
  held?: { pcu: Pcu; receivedAt: number };
};

// One throttle per hub, so tests with their own hub never share a hold.
const throttles = new WeakMap<Hub, Throttle>();

function write(hub: Hub, pcu: Pcu, receivedAt: number): void {
  hub.setSlice("demand", {
    pcu,
    receivedAt: new Date(receivedAt).toISOString(),
  });
}

function hold(hub: Hub, t: Throttle): void {
  t.timer = setTimeout(() => {
    t.timer = undefined;
    const held = t.held;
    t.held = undefined;
    if (!held) return;
    write(hub, held.pcu, held.receivedAt);
    hold(hub, t);
  }, HOLD_MS);
  // Never keeps the process open at shutdown: index.ts has no service hook.
  t.timer.unref();
}

/**
 * The sole writer of the `demand` slice (AD-8). `pcu` is relayed as received,
 * never recomputed (AD-12). Throttled: leading edge, 250 ms hold, then the
 * latest held value is flushed. Never skips a write because the value repeats.
 */
export function writeDemand(hub: Hub, pcu: Pcu, receivedAt: number): void {
  const t = throttles.get(hub) ?? {};
  throttles.set(hub, t);
  if (t.timer) {
    t.held = { pcu, receivedAt };
    return;
  }
  write(hub, pcu, receivedAt);
  hold(hub, t);
}
