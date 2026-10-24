import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHub, initialLink } from "../sse/hub.ts";
import { createLink } from "./link.ts";

function setup() {
  const hub = createHub({ validate: "throw" });
  const setSlice = vi.spyOn(hub, "setSlice");
  return { hub, setSlice, link: createLink(hub) };
}

describe("link service", () => {
  beforeEach(() => vi.useFakeTimers({ now: 1_800_000_000_000 }));
  afterEach(() => vi.useRealTimers());

  it("starts all offline and broker disconnected", () => {
    const { link, hub } = setup();
    expect(link.get()).toEqual(initialLink);
    expect(hub.getSlice("link")).toEqual(initialLink);
  });

  it("follows the broker and writes only real changes", () => {
    const { link, hub, setSlice } = setup();
    link.setBroker("CONNECTED");
    link.setBroker("CONNECTED");
    expect(setSlice).toHaveBeenCalledTimes(1);
    expect(hub.getSlice("link").broker).toBe("CONNECTED");
    link.setBroker("DISCONNECTED");
    expect(link.get().broker).toBe("DISCONNECTED");
    expect(setSlice).toHaveBeenCalledTimes(2);
  });

  it("goes ONLINE on fresh messages and STALE after 5 s / 3 s of silence", () => {
    const { link } = setup();
    const t0 = Date.now();
    link.onFresh("controller", t0, false);
    link.onFresh("vision", t0, false);
    expect(link.get().controller.status).toBe("ONLINE");
    expect(link.get().vision.status).toBe("ONLINE");

    link.tick(t0 + 3_000);
    expect(link.get().vision.status).toBe("ONLINE");
    link.tick(t0 + 3_001);
    expect(link.get().vision.status).toBe("STALE");
    expect(link.get().controller.status).toBe("ONLINE");
    link.tick(t0 + 5_001);
    expect(link.get().controller.status).toBe("STALE");

    link.onFresh("controller", t0 + 6_000, false);
    expect(link.get().controller.status).toBe("ONLINE");
  });

  it("never counts a retained copy as liveness", () => {
    const { link, setSlice } = setup();
    link.onFresh("controller", Date.now(), true);
    expect(link.get().controller.status).toBe("OFFLINE");
    expect(setSlice).not.toHaveBeenCalled();
  });

  it("takes only source and bootCount from a retained status", () => {
    const { link } = setup();
    link.onFresh("vision", Date.now(), false);
    link.onStatus(
      "controller",
      { v: 1, online: false, source: "sim", bootCount: 3 },
      true,
    );
    link.onStatus("vision", { v: 1, online: false, source: "live" }, true);
    expect(link.get().controller).toEqual({
      status: "OFFLINE",
      source: "sim",
      bootCount: 3,
    });
    expect(link.get().vision).toEqual({ status: "ONLINE", source: "live" });
  });

  it("sets source, and bootCount null when absent, from a fresh online status", () => {
    const { link } = setup();
    link.onFresh("controller", Date.now(), false);
    link.onStatus(
      "controller",
      { v: 1, online: true, source: "sim", bootCount: 7 },
      false,
    );
    link.onStatus("controller", { v: 1, online: true, source: "live" }, false);
    expect(link.get().controller).toEqual({
      status: "ONLINE",
      source: "live",
      bootCount: null,
    });
  });

  it("goes OFFLINE on a fresh online:false until the next fresh message", () => {
    const { link } = setup();
    const t0 = Date.now();
    link.onFresh("vision", t0, false);
    link.onStatus("vision", { v: 1, online: false, source: "sim" }, false);
    expect(link.get().vision.status).toBe("OFFLINE");
    link.tick(t0 + 60_000);
    expect(link.get().vision.status).toBe("OFFLINE");
    link.onFresh("vision", t0 + 60_000, false);
    expect(link.get().vision.status).toBe("ONLINE");
  });

  it("leaves roles alone when the broker drops", () => {
    const { link } = setup();
    link.onFresh("controller", Date.now(), false);
    link.setBroker("DISCONNECTED");
    expect(link.get().controller.status).toBe("ONLINE");
  });
});
