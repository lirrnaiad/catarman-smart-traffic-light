import { EventEmitter } from "node:events";
import type { BreachItem, HourCounts, StreamData } from "@stl/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHub, initialLink, PING_MS } from "./hub.ts";

class FakeRes extends EventEmitter {
  chunks: string[] = [];
  ended = false;
  write(chunk: string) {
    this.chunks.push(chunk);
    return true;
  }
  end() {
    this.ended = true;
  }
  get text() {
    return this.chunks.join("");
  }
}

const counts: HourCounts = {
  hourStart: "2026-10-23T00:00:00.000Z",
  total: 0,
  byApproach: { N: {}, S: {}, E: {}, W: {} },
};
const breach: BreachItem = {
  id: "6f1c1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f",
  occurredAt: "2026-10-23T00:00:00.000Z",
  receivedAt: "2026-10-23T00:00:00.100Z",
  approach: "N",
  vehicleClass: "car",
  centroid: { x: 0.5, y: 0.5 },
  cropUrl: null,
};

describe("sse hub", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("writes retry then the four slices in order on connect", () => {
    const hub = createHub({ validate: "throw" });
    const res = new FakeRes();
    hub.attach(res);
    expect(res.text).toBe(
      "retry: 2000\n\n" +
        `event: link\ndata: ${JSON.stringify(initialLink)}\n\n` +
        "event: state\ndata: null\n\n" +
        "event: counts\ndata: null\n\n" +
        "event: demand\ndata: null\n\n",
    );
    hub.close();
  });

  it("pings every 15 s and stops after close", () => {
    vi.useFakeTimers();
    const hub = createHub({ validate: "throw" });
    const res = new FakeRes();
    hub.attach(res);
    const before = res.chunks.length;
    vi.advanceTimersByTime(PING_MS);
    expect(res.chunks.slice(before)).toEqual([": ping\n\n"]);
    res.emit("close");
    vi.advanceTimersByTime(PING_MS * 3);
    expect(res.chunks.length).toBe(before + 1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("sends slices and occurrences to every open client and keeps the last slice", () => {
    const hub = createHub({ validate: "throw" });
    const a = new FakeRes();
    const b = new FakeRes();
    hub.attach(a);
    hub.attach(b);
    hub.setSlice("counts", counts);
    hub.emit("breach", breach);
    for (const res of [a, b]) {
      expect(res.chunks.slice(-2)).toEqual([
        `event: counts\ndata: ${JSON.stringify(counts)}\n\n`,
        `event: breach\ndata: ${JSON.stringify(breach)}\n\n`,
      ]);
    }
    expect(hub.getSlice("counts")).toEqual(counts);
    expect(hub.getSlice("state")).toBeNull();

    // A late client gets the current slice on connect.
    const late = new FakeRes();
    hub.attach(late);
    expect(late.text).toContain(
      `event: counts\ndata: ${JSON.stringify(counts)}\n\n`,
    );

    // A closed client gets nothing further.
    a.emit("close");
    hub.setSlice("counts", null);
    expect(a.chunks.at(-1)).toContain("event: breach");
    expect(b.chunks.at(-1)).toBe("event: counts\ndata: null\n\n");
    hub.close();
    expect(b.ended && late.ended).toBe(true);
  });

  it("ends a client that attaches after close without writing", () => {
    vi.useFakeTimers();
    const hub = createHub({ validate: "throw" });
    hub.close();
    const res = new FakeRes();
    hub.attach(res);
    expect(res.chunks).toEqual([]);
    expect(res.ended).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("throws on an invalid payload in throw mode", () => {
    const hub = createHub({ validate: "throw" });
    const res = new FakeRes();
    hub.attach(res);
    const before = res.chunks.length;
    const bad = { ...breach, approach: "X" } as unknown as StreamData<"breach">;
    expect(() => hub.emit("breach", bad)).toThrow();
    expect(res.chunks.length).toBe(before);
    hub.close();
  });

  it("logs [sse] and drops an invalid payload in log mode", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const hub = createHub({ validate: "log" });
    const res = new FakeRes();
    hub.attach(res);
    const before = res.chunks.length;
    hub.setSlice("counts", { total: -1 } as unknown as HourCounts);
    expect(res.chunks.length).toBe(before);
    expect(hub.getSlice("counts")).toBeNull();
    expect(error.mock.calls[0][0]).toMatch(/^\[sse\]/);
    hub.close();
  });
});
