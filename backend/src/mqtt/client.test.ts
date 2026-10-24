import { EventEmitter } from "node:events";
import { topicNames, topics } from "@stl/contracts";
import type { MqttClient } from "mqtt";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Pool } from "../db/pool.ts";
import { createLink } from "../services/link.ts";
import { createHub } from "../sse/hub.ts";
import { connectMqtt, type DispatchDeps, dispatch } from "./client.ts";
import {
  type Handler,
  type HandlerCtx,
  handlers as registry,
} from "./handlers/index.ts";

const state = {
  v: 1,
  level: "L1",
  signals: { NS: "GREEN", EW: "RED" },
  flood: "DRY",
  fault: false,
};
const STATE_TOPIC = "stl/int-01/controller/state";

function deps(handlers: Handler[]): DispatchDeps {
  const hub = createHub({ validate: "throw" });
  const link = createLink(hub);
  return {
    iid: "int-01",
    handlers,
    pool: {} as Pool,
    hub,
    publisher: { publish: async () => {} },
    link,
    getLink: link.get,
  };
}

function spyHandler(fn: (ctx: HandlerCtx) => void = () => {}) {
  const handle = vi.fn((_p: unknown, ctx: HandlerCtx) => fn(ctx));
  return { handler: { topic: "controller/state", handle } as Handler, handle };
}

afterEach(() => vi.restoreAllMocks());

describe("dispatch", () => {
  it("passes the parsed payload, receivedAt and the retained flag", async () => {
    const { handler, handle } = spyHandler();
    const before = Date.now();
    const raw = Buffer.from(JSON.stringify({ ...state, extra: 1 }));
    await dispatch(STATE_TOPIC, raw, true, deps([handler]));
    expect(handle).toHaveBeenCalledTimes(1);
    const [payload, ctx] = handle.mock.calls[0];
    expect(payload).toEqual(state);
    expect(ctx.retained).toBe(true);
    expect(ctx.receivedAt).toBeGreaterThanOrEqual(before);
  });

  it("ignores another intersection's topics and topics outside the table", async () => {
    const { handler, handle } = spyHandler();
    const raw = JSON.stringify(state);
    await dispatch("stl/int-02/controller/state", raw, false, deps([handler]));
    await dispatch("stl/int-01/nope", raw, false, deps([handler]));
    expect(handle).not.toHaveBeenCalled();
  });

  it("drops bad JSON and schema failures with a body-free [mqtt] warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { handler, handle } = spyHandler();
    await dispatch(STATE_TOPIC, "{secret-crop", false, deps([handler]));
    const bad = JSON.stringify({ ...state, level: "secret-L9" });
    await dispatch(STATE_TOPIC, bad, false, deps([handler]));
    expect(handle).not.toHaveBeenCalled();
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      `[mqtt] dropped ${STATE_TOPIC}: invalid JSON`,
      `[mqtt] dropped ${STATE_TOPIC}: invalid level`,
    ]);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("secret");
  });

  it("runs every handler of a topic even when one throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const a = spyHandler(() => {
      throw new Error("boom");
    });
    const b = spyHandler();
    const c: Handler = {
      topic: "controller/state",
      handle: async () => {
        throw new Error("async boom");
      },
    };
    const raw = JSON.stringify(state);
    await dispatch(STATE_TOPIC, raw, false, deps([a.handler, c, b.handler]));
    expect(b.handle).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(2);
    expect(error.mock.calls[0][0]).toMatch(/^\[mqtt\]/);
  });

  it("writes the link frame to SSE within 250 ms of receivedAt", async () => {
    let receivedAt = 0;
    const capture: Handler = {
      topic: "controller/state",
      handle: (_p, ctx) => {
        receivedAt = ctx.receivedAt;
      },
    };
    const d = deps([capture, ...registry]);
    const writes: Array<{ at: number; chunk: string }> = [];
    const res = Object.assign(new EventEmitter(), {
      write: (chunk: string) => writes.push({ at: Date.now(), chunk }),
      end: () => {},
    });
    d.hub.attach(res);
    await dispatch(STATE_TOPIC, JSON.stringify(state), false, d);
    const frame = writes.find(
      (w) =>
        w.chunk.startsWith("event: link") &&
        w.chunk.includes('"controller":{"status":"ONLINE"'),
    );
    expect(receivedAt).toBeGreaterThan(0);
    expect(frame).toBeDefined();
    expect((frame?.at ?? Infinity) - receivedAt).toBeLessThanOrEqual(250);
    d.hub.close();
  });
});

describe("dispatch through the link handlers", () => {
  const heartbeat = {
    v: 1,
    ts: 1_800_000_000_000,
    seq: 1,
    ok: true,
    confidence: 0.9,
    fps: 15,
  };
  const status = (online: boolean) => ({ v: 1, online, source: "sim" });
  const cases = [
    {
      topic: "vision/heartbeat",
      payload: heartbeat,
      retained: false,
      expected: { vision: { status: "ONLINE", source: null } },
    },
    {
      topic: "controller/status",
      payload: { ...status(true), bootCount: 4 },
      retained: false,
      expected: {
        controller: { status: "OFFLINE", source: "sim", bootCount: 4 },
      },
    },
    {
      topic: "controller/status",
      payload: status(false),
      retained: true,
      expected: {
        controller: { status: "OFFLINE", source: "sim", bootCount: null },
      },
    },
    {
      topic: "vision/status",
      payload: status(true),
      retained: true,
      expected: { vision: { status: "OFFLINE", source: "sim" } },
    },
    {
      topic: "vision/status",
      payload: status(false),
      retained: false,
      expected: { vision: { status: "OFFLINE", source: "sim" } },
    },
  ];

  it.each(cases)(
    "$topic (retained $retained) updates the link slice",
    async ({ topic, payload, retained, expected }) => {
      const d = deps(registry);
      const raw = JSON.stringify(payload);
      await dispatch(`stl/int-01/${topic}`, raw, retained, d);
      expect(d.link.get()).toMatchObject(expected);
    },
  );

  it("a fresh offline status overrides earlier heartbeats", async () => {
    const d = deps(registry);
    await dispatch(
      "stl/int-01/vision/heartbeat",
      JSON.stringify(heartbeat),
      false,
      d,
    );
    expect(d.link.get().vision.status).toBe("ONLINE");
    await dispatch(
      "stl/int-01/vision/status",
      JSON.stringify(status(false)),
      false,
      d,
    );
    expect(d.link.get().vision.status).toBe("OFFLINE");
  });

  it("ignores an empty payload (a cleared retained topic) without a warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const d = deps(registry);
    const before = d.link.get();
    await dispatch("stl/int-01/controller/status", Buffer.alloc(0), true, d);
    expect(warn).not.toHaveBeenCalled();
    expect(d.link.get()).toBe(before);
  });
});

describe("connectMqtt", () => {
  function fakeClient() {
    return Object.assign(new EventEmitter(), {
      subscribe: vi.fn(),
      connect: vi.fn(),
    });
  }

  it("tracks the broker, subscribes to non-gateway topics and dispatches messages", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { handler, handle } = spyHandler();
    const d = deps([handler]);
    const client = fakeClient();
    connectMqtt(client as unknown as MqttClient, d);
    expect(client.connect).toHaveBeenCalledTimes(1);

    client.emit("connect");
    expect(d.link.get().broker).toBe("CONNECTED");
    const subscribed = client.subscribe.mock.calls[0][0];
    const expected = Object.fromEntries(
      topicNames
        .filter((n) => n !== "controller/override/cmd")
        .map((n) => [topics[n].build("int-01"), { qos: topics[n].qos }]),
    );
    expect(subscribed).toEqual(expected);
    expect(subscribed).not.toHaveProperty("stl/int-01/controller/override/cmd");

    client.emit("message", STATE_TOPIC, Buffer.from(JSON.stringify(state)), {
      retain: true,
    });
    await vi.waitFor(() => expect(handle).toHaveBeenCalledTimes(1));
    expect(handle.mock.calls[0][1].retained).toBe(true);

    client.emit("close");
    expect(d.link.get().broker).toBe("DISCONNECTED");
  });
});
