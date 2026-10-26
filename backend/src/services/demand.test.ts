import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHub } from "../sse/hub.ts";
import { writeDemand } from "./demand.ts";

const T = 1_800_000_000_000;
const pcu = (N: number) => ({ N, S: 0, E: 1, W: 0.5 });
const iso = (ms: number) => new Date(ms).toISOString();

function setup() {
  const hub = createHub({ validate: "throw" });
  return { hub, setSlice: vi.spyOn(hub, "setSlice") };
}

describe("demand service", () => {
  beforeEach(() => vi.useFakeTimers({ now: T }));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("writes the first demand at once, pcu as received", () => {
    const { hub, setSlice } = setup();
    writeDemand(hub, pcu(2.5), T);
    expect(setSlice).toHaveBeenCalledWith("demand", {
      pcu: pcu(2.5),
      receivedAt: iso(T),
    });
  });

  it("burst: the first at once, the latest once at the hold's end, nothing between", () => {
    const { hub, setSlice } = setup();
    for (let i = 0; i < 5; i++) {
      writeDemand(hub, pcu(i), T + i * 40);
      vi.advanceTimersByTime(40);
    }
    expect(setSlice).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(50); // 250 ms after the first
    expect(setSlice).toHaveBeenCalledTimes(2);
    expect(setSlice).toHaveBeenLastCalledWith("demand", {
      pcu: pcu(4),
      receivedAt: iso(T + 160),
    });
    vi.advanceTimersByTime(1_000);
    expect(setSlice).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("re-arms the hold after a trailing flush", () => {
    const { hub, setSlice } = setup();
    writeDemand(hub, pcu(0), T);
    vi.advanceTimersByTime(100);
    writeDemand(hub, pcu(1), T + 100);
    vi.advanceTimersByTime(150); // trailing flush at 250 ms
    expect(setSlice).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(10);
    writeDemand(hub, pcu(2), T + 260);
    expect(setSlice).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(240); // the new hold ends at 500 ms
    expect(setSlice).toHaveBeenCalledTimes(3);
    expect(setSlice).toHaveBeenLastCalledWith("demand", {
      pcu: pcu(2),
      receivedAt: iso(T + 260),
    });
  });

  it("writes an identical value again after the hold", () => {
    const { hub, setSlice } = setup();
    writeDemand(hub, pcu(1), T);
    vi.advanceTimersByTime(300);
    writeDemand(hub, pcu(1), T + 300);
    expect(setSlice).toHaveBeenCalledTimes(2);
  });

  it("holds with an unref'd timer", () => {
    const timeout = vi.spyOn(globalThis, "setTimeout");
    writeDemand(setup().hub, pcu(1), T);
    expect(timeout.mock.results[0].value.hasRef()).toBe(false);
  });
});
