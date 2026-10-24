import { EventEmitter } from "node:events";
import { topics, type VisionHeartbeat } from "@stl/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type Controller,
  createController,
  parsePayload,
  startControllerRole,
} from "./controller-role.ts";

// A fake link for the wiring tests; the core tests never touch it.
const fake = vi.hoisted(() => ({
  client: undefined as unknown,
  opts: undefined as unknown,
}));
vi.mock("mqtt", () => ({
  default: {
    connect: (_url: string, opts: unknown) => {
      fake.opts = opts;
      const c = Object.assign(new EventEmitter(), {
        connected: false,
        // Calls a trailing callback, as MQTT.js does once a QoS 0 publish is written.
        publish: vi.fn((...args: unknown[]) => {
          const cb = args.at(-1);
          if (typeof cb === "function") cb();
        }),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        end: vi.fn((_f: boolean, _o: object, cb: () => void) => cb()),
      });
      fake.client = c;
      return c;
    },
  },
}));

const hb = (ok = true): VisionHeartbeat => ({
  v: 1,
  ts: 1.7e12,
  seq: 0,
  ok,
  confidence: 1,
  fps: 10,
});
const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const corridor = (phase: "NS" | "EW", commandId = ID1) =>
  ({ v: 1, commandId, ts: 1.7e12, mode: "CORRIDOR", phase }) as const;
const flashing = (commandId = ID1) =>
  ({ v: 1, commandId, ts: 1.7e12, mode: "FLASHING_AMBER" }) as const;
const release = (commandId = ID2) =>
  ({ v: 1, commandId, ts: 1.7e12, mode: "NONE" }) as const;

/** Steps every 100 ms over [from, to]; feeds an ok heartbeat each second when `beats`. */
function run(c: Controller, from: number, to: number, beats = false) {
  for (let t = from; t <= to; t += 100) {
    if (beats && t % 1000 === 0) c.onHeartbeat(hb(), false, t);
    c.step(t);
  }
}
const sig = (c: Controller) => c.state().signals;

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const FA = { NS: "FLASHING_AMBER", EW: "FLASHING_AMBER" };
const RED = { NS: "RED", EW: "RED" };

describe("cycle", () => {
  it("runs NS G10 Y3 R2, EW G10 Y3 R2 with the opposing phase red", () => {
    const c = createController(0);
    const at = (t: number) => {
      run(c, t, t);
      return sig(c);
    };
    expect(at(0)).toEqual({ NS: "GREEN", EW: "RED" });
    expect(at(9900)).toEqual({ NS: "GREEN", EW: "RED" });
    expect(at(10000)).toEqual({ NS: "YELLOW", EW: "RED" });
    expect(at(13000)).toEqual(RED);
    expect(at(15000)).toEqual({ NS: "RED", EW: "GREEN" });
    expect(at(25000)).toEqual({ NS: "RED", EW: "YELLOW" });
    expect(at(28000)).toEqual(RED);
    expect(at(30000)).toEqual({ NS: "GREEN", EW: "RED" });
  });

  it("starts at L2 with no override field when alone", () => {
    const s = createController(0).state();
    expect(s).toEqual({
      v: 1,
      level: "L2",
      signals: { NS: "GREEN", EW: "RED" },
      flood: "DRY",
      fault: false,
    });
    expect(topics["controller/state"].schema.safeParse(s).success).toBe(true);
  });
});

describe("vision loss", () => {
  it("climbs to L1 at the first all-red after 5 s healthy, drops at once after 3 s silent", () => {
    const c = createController(0);
    run(c, 0, 12900, true);
    expect(c.state().level).toBe("L2"); // healthy 5 s, but NS still green/yellow
    run(c, 13000, 13000, true);
    expect(c.state().level).toBe("L1");
    run(c, 13100, 20000, true); // last heartbeat at 20 000
    run(c, 20100, 22900);
    expect(c.state().level).toBe("L1");
    run(c, 23000, 23000);
    expect(c.state().level).toBe("L2");
  });

  it("ignores retained and ok:false heartbeats", () => {
    const c = createController(0);
    for (let t = 0; t <= 30000; t += 100) {
      if (t % 1000 === 0) {
        c.onHeartbeat(hb(), true, t);
        c.onHeartbeat(hb(false), false, t);
      }
      c.step(t);
    }
    expect(c.state().level).toBe("L2");
  });
});

describe("sensor fault", () => {
  it("drops to L3 at once and climbs back after 5 s, at all-red", () => {
    const c = createController(0);
    c.setSensorFault(true, 1000);
    expect(c.state().level).toBe("L3");
    c.setSensorFault(false, 2000);
    run(c, 2000, 12900);
    expect(c.state().level).toBe("L3");
    run(c, 13000, 13000);
    expect(c.state().level).toBe("L2");
  });
});

describe("flood", () => {
  it("goes WET, then FLOODED and L4 after 5 s, then DRY after 30 s dry and resumes at all-red", () => {
    const c = createController(0);
    c.setFlood(true, 1000);
    expect(c.state().flood).toBe("WET");
    run(c, 1000, 5900);
    expect(c.state()).toMatchObject({ flood: "WET", level: "L2" });
    run(c, 6000, 6000);
    expect(c.state()).toMatchObject({
      flood: "FLOODED",
      level: "L4",
      signals: FA,
    });
    c.setFlood(false, 7000);
    run(c, 7000, 36900);
    expect(c.state()).toMatchObject({
      flood: "FLOODED",
      level: "L4",
      signals: FA,
    });
    run(c, 37000, 37000);
    expect(c.state()).toMatchObject({
      flood: "DRY",
      level: "L2",
      signals: RED,
    });
    run(c, 37100, 39000);
    expect(sig(c)).toEqual({ NS: "RED", EW: "GREEN" });
  });

  it("returns to DRY with no L4 when wet under 5 s", () => {
    const c = createController(0);
    c.setFlood(true, 0);
    c.setFlood(false, 3000);
    expect(c.state().flood).toBe("DRY");
    run(c, 3000, 20000);
    expect(c.state()).toMatchObject({ flood: "DRY", level: "L2" });
  });
});

describe("conflict fault", () => {
  it("latches flashing amber with the level unchanged until reset, then resumes at all-red", () => {
    const c = createController(0);
    c.raiseConflict(1000);
    expect(c.state()).toMatchObject({ fault: true, level: "L2", signals: FA });
    run(c, 1000, 60000);
    expect(c.state()).toMatchObject({ fault: true, signals: FA });
    c.resetConflict(60000);
    expect(c.state()).toMatchObject({ fault: false, signals: RED });
    run(c, 60100, 62000);
    expect(sig(c)).toEqual({ NS: "RED", EW: "GREEN" });
  });
});

describe("overrides", () => {
  it("CORRIDOR: applies at once, runs NS out through yellow and all-red, then holds EW green", () => {
    const c = createController(0);
    expect(c.onCommand(corridor("EW"), 1000)).toEqual({
      v: 1,
      commandId: ID1,
      result: "APPLIED",
    });
    expect(c.state().override).toEqual({
      mode: "CORRIDOR",
      phase: "EW",
      commandId: ID1,
    });
    expect(sig(c)).toEqual({ NS: "YELLOW", EW: "RED" });
    run(c, 1000, 4000);
    expect(sig(c)).toEqual(RED);
    run(c, 4100, 6000);
    expect(sig(c)).toEqual({ NS: "RED", EW: "GREEN" });
    run(c, 6100, 100000);
    expect(sig(c)).toEqual({ NS: "RED", EW: "GREEN" });
  });

  it("CORRIDOR on the green phase holds it without a transition", () => {
    const c = createController(0);
    c.onCommand(corridor("NS"), 1000);
    run(c, 1000, 60000);
    expect(sig(c)).toEqual({ NS: "GREEN", EW: "RED" });
  });

  it("CORRIDOR during a fault is REJECTED CONFLICT_FAULT with the state unchanged", () => {
    const c = createController(0);
    c.raiseConflict(0);
    const before = c.state();
    expect(c.onCommand(corridor("EW"), 1000)).toEqual({
      v: 1,
      commandId: ID1,
      result: "REJECTED",
      reason: "CONFLICT_FAULT",
    });
    expect(c.state()).toEqual(before);
  });

  it("FLASHING_AMBER applies in a fault, outranks every level and survives a reset", () => {
    const c = createController(0);
    c.raiseConflict(0);
    expect(c.onCommand(flashing(), 1000).result).toBe("APPLIED");
    expect(sig(c)).toEqual(FA);
    c.resetConflict(2000);
    run(c, 2000, 30000);
    expect(sig(c)).toEqual(FA);
    for (const l of ["L1", "L2", "L3", "L4"] as const) {
      c.setForcedLevel(l, 30000);
      expect(sig(c)).toEqual(FA);
    }
  });

  it("NONE releases a corridor through yellow and all-red, then the normal cycle", () => {
    const c = createController(0);
    c.onCommand(corridor("EW"), 1000);
    run(c, 1000, 20000);
    expect(c.onCommand(release(), 20000).result).toBe("APPLIED");
    expect(c.state().override).toEqual({ mode: "NONE", commandId: ID2 });
    expect(sig(c)).toEqual({ NS: "RED", EW: "YELLOW" });
    run(c, 20100, 23000);
    expect(sig(c)).toEqual(RED);
    run(c, 23100, 25000);
    expect(sig(c)).toEqual({ NS: "GREEN", EW: "RED" });
    run(c, 25100, 35000);
    expect(sig(c)).toEqual({ NS: "YELLOW", EW: "RED" });
  });

  it("NONE releases flashing amber through all-red", () => {
    const c = createController(0);
    c.onCommand(flashing(), 1000);
    c.onCommand(release(), 5000);
    expect(sig(c)).toEqual(RED);
    run(c, 5100, 7000);
    expect(sig(c)).toEqual({ NS: "RED", EW: "GREEN" });
  });

  it("a fault ends a corridor, which does not resume after the reset", () => {
    const c = createController(0);
    c.onCommand(corridor("EW"), 1000);
    run(c, 1000, 10000);
    c.raiseConflict(10000);
    expect(c.state().override).toEqual({ mode: "NONE", commandId: ID1 });
    expect(sig(c)).toEqual(FA);
    c.resetConflict(20000);
    run(c, 20000, 22000);
    expect(sig(c)).toEqual({ NS: "GREEN", EW: "RED" });
    run(c, 22100, 32000);
    expect(sig(c)).toEqual({ NS: "YELLOW", EW: "RED" });
  });
});

describe("corridor vs L4", () => {
  it("a CORRIDOR outranks L4; on release it runs out through yellow and all-red, then L4 flashes", () => {
    const c = createController(0);
    c.setForcedLevel("L4", 0);
    expect(sig(c)).toEqual(FA);
    c.onCommand(corridor("EW"), 1000);
    expect(sig(c)).toEqual(RED);
    run(c, 1100, 4000);
    expect(c.state()).toMatchObject({
      level: "L4",
      signals: { NS: "RED", EW: "GREEN" },
    });
    c.onCommand(release(), 5000);
    expect(sig(c)).toEqual({ NS: "RED", EW: "YELLOW" });
    run(c, 5100, 8000);
    expect(sig(c)).toEqual(RED);
    run(c, 8100, 10000);
    expect(c.state()).toMatchObject({ level: "L4", signals: FA });
  });

  it("the link-loss release also runs out before L4 flashes", () => {
    const c = createController(0);
    c.setForcedLevel("L4", 0);
    c.onCommand(corridor("EW"), 1000);
    c.setLinkUp(false, 5000);
    run(c, 1100, 65000);
    expect(sig(c)).toEqual({ NS: "RED", EW: "YELLOW" });
    run(c, 65100, 68000);
    expect(sig(c)).toEqual(RED);
    run(c, 68100, 70000);
    expect(sig(c)).toEqual(FA);
  });
});

describe("climbing without an all-red", () => {
  it("climbs after 5 s clear during a held corridor green", () => {
    const c = createController(0);
    c.onCommand(corridor("NS"), 1000);
    c.setSensorFault(true, 2000);
    c.setSensorFault(false, 3000);
    run(c, 3000, 7900);
    expect(c.state().level).toBe("L3");
    run(c, 8000, 8000);
    expect(c.state()).toMatchObject({
      level: "L2",
      signals: { NS: "GREEN", EW: "RED" },
    });
  });

  it("climbs after 5 s clear while flashing for a fault", () => {
    const c = createController(0);
    c.raiseConflict(1000);
    c.setSensorFault(true, 2000);
    c.setSensorFault(false, 3000);
    run(c, 3000, 8000);
    expect(c.state()).toMatchObject({ level: "L2", fault: true, signals: FA });
  });
});

describe("link drop", () => {
  it("releases a corridor 60 s after the link is lost, through yellow and all-red", () => {
    const c = createController(0);
    c.onCommand(corridor("EW"), 1000);
    run(c, 1000, 10000);
    c.setLinkUp(false, 10000);
    run(c, 10000, 30000);
    c.setLinkUp(false, 30000); // repeated close events keep the first loss time
    run(c, 30000, 69900);
    expect(c.state().override?.mode).toBe("CORRIDOR");
    expect(sig(c)).toEqual({ NS: "RED", EW: "GREEN" });
    run(c, 70000, 70000);
    expect(c.state().override).toEqual({ mode: "NONE", commandId: ID1 });
    expect(sig(c)).toEqual({ NS: "RED", EW: "YELLOW" });
    run(c, 70100, 75000);
    expect(sig(c)).toEqual({ NS: "GREEN", EW: "RED" });
  });

  it("changes nothing when the link returns before 60 s", () => {
    const c = createController(0);
    c.onCommand(corridor("EW"), 1000);
    c.setLinkUp(false, 10000);
    c.setLinkUp(true, 50000);
    run(c, 1000, 200000);
    expect(c.state().override?.mode).toBe("CORRIDOR");
    expect(sig(c)).toEqual({ NS: "RED", EW: "GREEN" });
  });

  it("holds flashing amber while the link is down", () => {
    const c = createController(0);
    c.onCommand(flashing(), 1000);
    c.setLinkUp(false, 2000);
    run(c, 2000, 200000);
    expect(c.state().override?.mode).toBe("FLASHING_AMBER");
    expect(sig(c)).toEqual(FA);
  });
});

describe("forced level", () => {
  it("reports the forced level; a forced L4 flashes; auto returns", () => {
    const c = createController(0);
    c.setForcedLevel("L1", 0);
    expect(c.state().level).toBe("L1");
    c.setForcedLevel("L4", 1000);
    expect(c.state()).toMatchObject({ level: "L4", signals: FA });
    c.setForcedLevel(undefined, 2000);
    expect(c.state()).toMatchObject({ level: "L2", signals: RED });
  });
});

describe("behaviors", () => {
  it("merges behavior state extras", () => {
    const c = createController(0, [
      { name: "t", state: () => ({ flood: "WET" }) },
    ]);
    expect(c.state().flood).toBe("WET");
  });
});

describe("parsePayload", () => {
  const schema = topics["controller/override/cmd"].schema;
  const topic = "stl/int-01/controller/override/cmd";

  it("drops bad JSON and invalid shapes with a [sim] warning naming paths, not the body", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(parsePayload(schema, topic, Buffer.from("{nope"))).toBeUndefined();
    expect(warn).toHaveBeenLastCalledWith(
      `[sim] dropped ${topic}: invalid JSON`,
    );
    const bad = Buffer.from(
      JSON.stringify({ ...corridor("EW"), phase: "SECRET" }),
    );
    expect(parsePayload(schema, topic, bad)).toBeUndefined();
    const msg = String(warn.mock.lastCall?.[0]);
    expect(msg).toMatch(/^\[sim\] dropped .*: invalid phase/);
    expect(msg).not.toContain("SECRET");
  });

  it("skips a zero-length payload and returns valid data", () => {
    expect(parsePayload(schema, topic, Buffer.alloc(0))).toBeUndefined();
    const ok = Buffer.from(JSON.stringify(corridor("EW")));
    expect(parsePayload(schema, topic, ok)).toEqual(corridor("EW"));
  });
});

describe("start check", () => {
  type Fake = EventEmitter & {
    connected: boolean;
    publish: ReturnType<typeof vi.fn>;
  };
  const config = {
    MQTT_URL: "mqtt://127.0.0.1:1883",
    INTERSECTION_ID: "int-01",
    MQTT_PASSWORD: undefined,
  };
  const stateTopic = "stl/int-01/controller/state";
  const statusTopic = "stl/int-01/controller/status";
  const start = (force: boolean) => {
    const role = startControllerRole({ config, force, behaviors: [] });
    const c = fake.client as Fake;
    c.connected = true;
    c.emit("connect");
    return { role, c };
  };

  it("exits 1 with nothing published when a live state arrives within 5 s", () => {
    vi.useFakeTimers();
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { c } = start(false);
    vi.advanceTimersByTime(1000);
    c.emit("message", stateTopic, Buffer.from("{}"), { retain: true }); // retained never counts
    expect(exit).not.toHaveBeenCalled();
    c.emit("message", stateTopic, Buffer.from("{}"), { retain: false });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.lastCall?.[0]).toMatch(/^\[sim\] another controller/);
    vi.advanceTimersByTime(10000);
    expect(c.publish).not.toHaveBeenCalled();
  });

  it("goes online after 5 s quiet, and --force clears the status first", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "info").mockImplementation(() => {});
    const quiet = start(false);
    vi.advanceTimersByTime(4900);
    expect(quiet.c.publish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(quiet.c.publish.mock.calls[0]?.[0]).toBe(statusTopic);
    expect(JSON.parse(quiet.c.publish.mock.calls[0]?.[1])).toEqual({
      v: 1,
      online: true,
      source: "sim",
    });
    vi.advanceTimersByTime(200);
    expect(quiet.c.publish.mock.calls.some(([t]) => t === stateTopic)).toBe(
      true,
    );
    void quiet.role.stop();

    const forced = start(true);
    expect(forced.c.publish.mock.calls[0]).toEqual([
      statusTopic,
      "",
      { qos: 0, retain: true },
    ]);
    expect(JSON.parse(forced.c.publish.mock.calls[1]?.[1]).online).toBe(true);
    void forced.role.stop();
  });
});

describe("controller wiring", () => {
  type Fake = EventEmitter & {
    connected: boolean;
    publish: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  const config = {
    MQTT_URL: "mqtt://127.0.0.1:1883",
    INTERSECTION_ID: "int-01",
    MQTT_PASSWORD: undefined,
  };
  const statusTopic = "stl/int-01/controller/status";
  const stateTopic = "stl/int-01/controller/state";
  const ackTopic = "stl/int-01/controller/override/ack";
  const cmdTopic = "stl/int-01/controller/override/cmd";
  const hbTopic = "stl/int-01/vision/heartbeat";
  const offline = JSON.stringify({ v: 1, online: false, source: "sim" });
  const online = JSON.stringify({ v: 1, online: true, source: "sim" });
  const send = (c: Fake, topic: string, body: unknown, retain = false) =>
    c.emit("message", topic, Buffer.from(JSON.stringify(body)), { retain });
  const acks = (c: Fake) =>
    c.publish.mock.calls.filter(([t]) => t === ackTopic);

  /** Connects; `pass` also runs the 5 s start check out. */
  function start(pass = true) {
    vi.useFakeTimers();
    vi.spyOn(console, "info").mockImplementation(() => {});
    const role = startControllerRole({ config, force: false, behaviors: [] });
    const c = fake.client as Fake;
    c.connected = true;
    c.emit("connect");
    if (pass) vi.advanceTimersByTime(5100);
    return { role, c };
  }

  it("registers the retained online:false status as the will", () => {
    const { role } = start(false);
    expect((fake.opts as { will: unknown }).will).toEqual({
      topic: statusTopic,
      payload: Buffer.from(offline),
      qos: 0,
      retain: true,
    });
    void role.stop();
  });

  it("acks a valid cmd APPLIED after the check, and not at all during it", () => {
    const { role, c } = start(false);
    send(c, cmdTopic, corridor("EW"));
    vi.advanceTimersByTime(5100);
    expect(acks(c)).toEqual([]);
    send(c, cmdTopic, corridor("EW", ID2));
    expect(acks(c)).toEqual([
      [
        ackTopic,
        JSON.stringify({ v: 1, commandId: ID2, result: "APPLIED" }),
        { qos: 0, retain: false },
      ],
    ]);
    void role.stop();
  });

  it("ignores retained heartbeats and lifts to L1 at an all-red on fresh ok ones", () => {
    const retained = start();
    for (let i = 0; i < 20; i++) {
      send(retained.c, hbTopic, hb(), true);
      vi.advanceTimersByTime(1000);
    }
    expect(retained.role.controller.state().level).toBe("L2");
    void retained.role.stop();

    const fresh = start(); // created at T0; NS green runs out at T0 + 10 s
    for (let i = 0; i < 6; i++) {
      send(fresh.c, hbTopic, hb());
      vi.advanceTimersByTime(1000);
    }
    expect(fresh.role.controller.state().level).toBe("L2"); // still green
    for (let i = 0; i < 2; i++) {
      send(fresh.c, hbTopic, hb()); // to T0 + 13.1 s, inside the all-red
      vi.advanceTimersByTime(1000);
    }
    expect(fresh.role.controller.state()).toMatchObject({
      level: "L1",
      signals: RED,
    });
    void fresh.role.stop();
  });

  it("releases a corridor 60 s after the link closes", () => {
    const { role, c } = start();
    send(c, cmdTopic, corridor("EW"));
    c.connected = false;
    c.emit("close");
    vi.advanceTimersByTime(59_900);
    expect(role.controller.state().override?.mode).toBe("CORRIDOR");
    vi.advanceTimersByTime(200);
    expect(role.controller.state().override).toEqual({
      mode: "NONE",
      commandId: ID1,
    });
    void role.stop();
  });

  it("republishes state at least every 2 s during a green", () => {
    const { role, c } = start(); // T0 + 5.1 s; NS green until T0 + 10 s
    c.publish.mockClear();
    const times: number[] = [];
    for (let i = 0; i < 47; i++) {
      vi.advanceTimersByTime(100);
      const n = c.publish.mock.calls.filter(([t]) => t === stateTopic).length;
      if (n > times.length) times.push(Date.now());
    }
    expect(times.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < times.length; i++)
      expect(times[i] - times[i - 1]).toBeLessThanOrEqual(2000);
    void role.stop();
  });

  it("republishes a retained online:true on reconnect", () => {
    const { role, c } = start();
    c.publish.mockClear();
    c.connected = false;
    c.emit("close");
    c.connected = true;
    c.emit("connect");
    expect(c.publish.mock.calls[0]).toEqual([
      statusTopic,
      online,
      { qos: 0, retain: true },
    ]);
    void role.stop();
  });

  it("stop() publishes a retained online:false, then ends the link", async () => {
    const { role, c } = start();
    c.publish.mockClear();
    await role.stop();
    expect(c.publish).toHaveBeenCalledOnce();
    expect(c.publish.mock.calls[0]?.slice(0, 3)).toEqual([
      statusTopic,
      offline,
      { qos: 0, retain: true },
    ]);
    expect(c.end).toHaveBeenCalledOnce();
    expect(c.end.mock.invocationCallOrder[0]).toBeGreaterThan(
      c.publish.mock.invocationCallOrder[0] ?? Infinity,
    );
  });
});
