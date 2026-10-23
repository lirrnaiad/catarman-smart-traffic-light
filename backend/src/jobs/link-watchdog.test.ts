import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLink } from "../services/link.ts";
import { createHub } from "../sse/hub.ts";
import type { JobCtx } from "./index.ts";
import linkWatchdog from "./link-watchdog.ts";

describe("link watchdog", () => {
  beforeEach(() => vi.useFakeTimers({ now: 1_800_000_000_000 }));
  afterEach(() => {
    linkWatchdog.stop();
    vi.useRealTimers();
  });

  it("turns silent roles STALE and stops ticking after stop()", () => {
    const link = createLink(createHub({ validate: "throw" }));
    linkWatchdog.start({ link } as unknown as JobCtx);
    link.onFresh("controller", Date.now(), false);
    link.onFresh("vision", Date.now(), false);

    vi.advanceTimersByTime(3_500);
    expect(link.get().vision.status).toBe("STALE");
    expect(link.get().controller.status).toBe("ONLINE");
    vi.advanceTimersByTime(2_000);
    expect(link.get().controller.status).toBe("STALE");

    linkWatchdog.stop();
    link.onFresh("controller", Date.now(), false);
    vi.advanceTimersByTime(10_000);
    expect(link.get().controller.status).toBe("ONLINE");
    expect(vi.getTimerCount()).toBe(0);
  });
});
