import type { BreachItem, LinkSlice } from "@stl/contracts";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLive, useLiveEvent, useLiveness, useStreamEpoch } from "./hooks.ts";
import { LiveProvider } from "./live-provider.tsx";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static CLOSED = 2;
  readyState = 0;
  readonly url: string;
  closed = false;
  private listeners = new Map<string, ((e: Event) => void)[]>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, fn: (e: Event) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  close() {
    this.closed = true;
  }
  fire(type: string, data?: string) {
    const event =
      data === undefined ? new Event(type) : new MessageEvent(type, { data });
    act(() => {
      for (const fn of this.listeners.get(type) ?? []) fn(event);
    });
  }
  frame(name: string, value: unknown) {
    this.fire(name, JSON.stringify(value));
  }
  listenerCount(type: string) {
    return this.listeners.get(type)?.length ?? 0;
  }
}

const link = (
  controller: LinkSlice["controller"]["status"],
  vision: LinkSlice["vision"]["status"],
  broker: LinkSlice["broker"] = "CONNECTED",
): LinkSlice => ({
  broker,
  controller: { status: controller, source: "sim", bootCount: 1 },
  vision: { status: vision, source: "sim" },
});

const counts = {
  hourStart: "2026-10-23T06:00:00.000Z",
  total: 3,
  byApproach: { N: { car: 3 }, S: {}, E: {}, W: {} },
};
const demand = (n: number) => ({
  pcu: { N: n, S: 0, E: 0, W: 0 },
  receivedAt: "2026-10-23T06:32:08.000Z",
});
const breach: BreachItem = {
  id: "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60",
  occurredAt: "2026-10-23T06:32:08.000Z",
  receivedAt: "2026-10-23T06:32:08.100Z",
  approach: "E",
  vehicleClass: "motorcycle",
  centroid: { x: 0.5, y: 0.5 },
  cropUrl: null,
};

function Probe() {
  return (
    <pre data-testid="probe">
      {JSON.stringify({
        epoch: useStreamEpoch(),
        link: useLive("link"),
        state: useLive("state"),
        counts: useLive("counts"),
        demand: useLive("demand"),
        controller: useLiveness("controller"),
        vision: useLiveness("vision"),
      })}
    </pre>
  );
}
const listener = { renders: 0, a: vi.fn(), b: vi.fn() };
function Listener() {
  listener.renders++;
  useLiveEvent("breach", listener.a);
  useLiveEvent("breach", listener.b);
  return <Probe />;
}

const probe = () => JSON.parse(screen.getByTestId("probe").textContent ?? "");

let es: FakeEventSource;
beforeEach(() => {
  FakeEventSource.instances = [];
  listener.a.mockClear();
  listener.b.mockClear();
  vi.stubGlobal("EventSource", FakeEventSource);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(children = <Probe />) {
  const view = render(<LiveProvider>{children}</LiveProvider>);
  es = FakeEventSource.instances[0] as FakeEventSource;
  return view;
}

function connect() {
  es.fire("open");
  es.frame("link", link("ONLINE", "STALE"));
  es.frame("state", null);
  es.frame("counts", counts);
  es.frame("demand", demand(1));
}

describe("LiveProvider", () => {
  it("opens one EventSource on /api/stream with one listener per stream event", () => {
    mount();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(es.url).toBe("/api/stream");
    for (const name of [
      "link",
      "state",
      "counts",
      "demand",
      "breach",
      "override",
      "speedAlert",
    ]) {
      expect(es.listenerCount(name)).toBe(1);
    }
  });

  it("is STALE with no value before the first frames", () => {
    mount();
    expect(probe()).toEqual({ epoch: 0, controller: "STALE", vision: "STALE" });
    es.fire("open");
    expect(probe().controller).toBe("STALE"); // open, but no link yet
  });

  it("connect: epoch 1 and each parsed slice, with state null", () => {
    mount();
    connect();
    expect(probe()).toEqual({
      epoch: 1,
      link: link("ONLINE", "STALE"),
      state: null,
      counts,
      demand: demand(1),
      controller: "LIVE",
      vision: "STALE",
    });
  });

  it("replaces a slice on a new frame, never merges", () => {
    mount();
    connect();
    es.frame("demand", {
      pcu: { N: 0, S: 2, E: 0, W: 0 },
      receivedAt: "2026-10-23T06:32:09.000Z",
    });
    expect(probe().demand).toEqual({
      pcu: { N: 0, S: 2, E: 0, W: 0 },
      receivedAt: "2026-10-23T06:32:09.000Z",
    });
  });

  it("delivers an occurrence once to each handler without re-rendering", () => {
    mount(<Listener />);
    const before = listener.renders;
    es.frame("breach", breach);
    expect(listener.a).toHaveBeenCalledTimes(1);
    expect(listener.a).toHaveBeenCalledWith(breach);
    expect(listener.b).toHaveBeenCalledTimes(1);
    expect(listener.renders).toBe(before);
  });

  it("drops invalid JSON and schema failures with a warning, keeping the last value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mount(<Listener />);
    connect();

    es.fire("demand", "{not json");
    expect(warn).toHaveBeenLastCalledWith(
      "[sse] dropped demand frame: invalid JSON",
    );

    es.frame("demand", {
      pcu: { N: "secret", S: 0, E: 0, W: 0 },
      receivedAt: "x",
    });
    expect(warn).toHaveBeenLastCalledWith(
      "[sse] dropped demand frame: invalid at pcu.N, receivedAt",
    );
    expect(String(warn.mock.lastCall)).not.toContain("secret");

    es.frame("breach", { ...breach, id: "nope" });
    expect(warn).toHaveBeenLastCalledWith(
      "[sse] dropped breach frame: invalid at id",
    );
    expect(listener.a).not.toHaveBeenCalled();
    expect(probe().demand).toEqual(demand(1));
  });

  it("reconnect: STALE while closed, epoch 2 after reopen, slices kept", () => {
    mount();
    connect();
    es.fire("error");
    expect(probe()).toMatchObject({
      epoch: 1,
      controller: "STALE",
      vision: "STALE",
      counts,
    });
    es.fire("open");
    expect(probe()).toMatchObject({
      epoch: 2,
      controller: "LIVE",
      counts,
      demand: demand(1),
    });
  });

  it("reopens a new EventSource 2 s after the browser closes it for good", () => {
    vi.useFakeTimers();
    try {
      mount();
      connect();
      es.readyState = FakeEventSource.CLOSED;
      es.fire("error");
      expect(es.closed).toBe(true);
      expect(probe().controller).toBe("STALE");
      act(() => vi.advanceTimersByTime(1999));
      expect(FakeEventSource.instances).toHaveLength(1);
      act(() => vi.advanceTimersByTime(1));
      expect(FakeEventSource.instances).toHaveLength(2);
      const next = FakeEventSource.instances[1] as FakeEventSource;
      expect(next.url).toBe("/api/stream");
      expect(next.listenerCount("link")).toBe(1);
      next.fire("open");
      expect(probe()).toMatchObject({ epoch: 2, controller: "LIVE", counts });
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels a pending reopen and closes the source on unmount", () => {
    vi.useFakeTimers();
    try {
      const view = mount();
      es.readyState = FakeEventSource.CLOSED;
      es.fire("error");
      view.unmount();
      vi.advanceTimersByTime(2000);
      expect(FakeEventSource.instances).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("liveness: STALE for both roles when the broker is DISCONNECTED", () => {
    mount();
    es.fire("open");
    es.frame("link", link("ONLINE", "ONLINE"));
    expect(probe()).toMatchObject({ controller: "LIVE", vision: "LIVE" });
    es.frame("link", link("ONLINE", "ONLINE", "DISCONNECTED"));
    expect(probe()).toMatchObject({ controller: "STALE", vision: "STALE" });
  });

  it("closes the EventSource on unmount", () => {
    const view = mount();
    view.unmount();
    expect(es.closed).toBe(true);
  });
});
