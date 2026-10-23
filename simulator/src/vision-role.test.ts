import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { type Approach, topics, type VehicleClass } from "@stl/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createController } from "./controller-role.ts";
import {
  APPROACHES,
  createVision,
  startVisionRole,
  type Vision,
} from "./vision-role.ts";

// A fake link per mqtt.connect, as in controller-role.test.ts.
type Fake = EventEmitter & {
  connected: boolean;
  publish: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
};
const fake = vi.hoisted(() => ({
  clients: [] as unknown[],
  opts: [] as unknown[],
}));
vi.mock("mqtt", () => ({
  default: {
    connect: (_url: string, opts: unknown) => {
      fake.opts.push(opts);
      const c = Object.assign(new EventEmitter(), {
        connected: false,
        publish: vi.fn((...args: unknown[]) => {
          const cb = args.at(-1);
          if (typeof cb === "function") cb();
        }),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        end: vi.fn((_f: boolean, _o: object, cb: () => void) => {
          c.connected = false;
          c.emit("close");
          cb();
        }),
      });
      fake.clients.push(c);
      return c;
    },
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  fake.clients.length = 0;
  fake.opts.length = 0;
});

const CLASSES: VehicleClass[] = [
  { id: "car", label: "Car", pcu: 1 },
  { id: "motorcycle", label: "Motorcycle", pcu: 0.25 },
];
const CAR = 0;
const MOTO = 1;
const P = 100 / 6000; // arrival chance per approach per 100 ms step
type Plan = Record<number, Partial<Record<Approach, number>>>;
/** A rand for `run` from t = 100: `plan[t][approach]` is the class index arriving then. */
function scripted(plan: Plan) {
  let i = 0;
  return () => {
    const t = (Math.floor(i / 4) + 1) * 100;
    const a = APPROACHES[i++ % 4]; // before ?. so every call counts
    const k = plan[t]?.[a];
    return k === undefined ? 0.999 : (P * (k + 0.5)) / CLASSES.length;
  };
}
const vision = (plan: Plan) =>
  createVision(0, { rand: scripted(plan), classes: CLASSES });
/** Steps every 100 ms over [from, to]. */
function run(v: Vision, from: number, to: number, signals?: Signals) {
  for (let t = from; t <= to; t += 100) v.step(t, signals);
}
type Signals = Parameters<Vision["step"]>[1];
const GREEN_NS = { NS: "GREEN", EW: "RED" } as const;
const ALL_RED = { NS: "RED", EW: "RED" } as const;
const FLASH = { NS: "FLASHING_AMBER", EW: "FLASHING_AMBER" } as const;
const four = { N: CAR, S: CAR, E: CAR, W: CAR };

describe("traffic", () => {
  it("drains N and S one every 1.5 s on NS green while E and W only grow", () => {
    const v = vision({
      100: four,
      200: four,
      300: four,
      400: four,
      2000: { E: CAR },
    });
    run(v, 100, 1500, GREEN_NS);
    expect(v.demand().pcu).toEqual({ N: 4, S: 4, E: 4, W: 4 });
    run(v, 1600, 1600, GREEN_NS); // first leave 1.5 s after green found a queue
    expect(v.demand().pcu).toEqual({ N: 3, S: 3, E: 4, W: 4 });
    run(v, 1700, 3000, GREEN_NS);
    expect(v.demand().pcu).toEqual({ N: 3, S: 3, E: 5, W: 4 });
    run(v, 3100, 6100, GREEN_NS);
    expect(v.demand().pcu).toEqual({ N: 0, S: 0, E: 5, W: 4 });
  });

  it("holds every queue on all-red and drains one every 3 s with no controller", () => {
    const v = vision({ 100: { N: CAR }, 200: { N: CAR } });
    run(v, 100, 10_000, ALL_RED);
    expect(v.demand().pcu.N).toBe(2);
    run(v, 10_100, 13_000);
    expect(v.demand().pcu.N).toBe(2);
    run(v, 13_100, 13_100);
    expect(v.demand().pcu.N).toBe(1);
    run(v, 13_200, 16_100);
    expect(v.demand().pcu.N).toBe(0);
  });

  it("weights demand by PCU from vehicle-classes", () => {
    const v = vision({ 100: { N: MOTO }, 200: { N: MOTO, E: CAR } });
    run(v, 100, 200, ALL_RED);
    expect(v.demand().pcu).toEqual({ N: 0.5, S: 0, E: 1, W: 0 });
  });

  it("is the same traffic for the same rand", () => {
    const seeded = () => {
      let s = 7;
      return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
      };
    };
    const once = () => {
      const v = createVision(0, { rand: seeded() });
      run(v, 100, 60_000, GREEN_NS);
      return v.demand().pcu;
    };
    expect(once()).toEqual(once());
  });
});

describe("counts", () => {
  it("sums crossings per approach and class, then nothing until more cross", () => {
    const v = vision({
      100: { N: CAR },
      200: { N: CAR },
      300: { N: MOTO },
      400: { N: CAR },
    });
    run(v, 100, 400, ALL_RED);
    expect(v.takeCounts(1.7e12)).toBeUndefined(); // none crossed
    run(v, 500, 12_500, FLASH); // leaves at 3.5, 6.5, 9.5 and 12.5 s
    const c = v.takeCounts(1.7e12);
    expect(c?.crossings).toEqual([
      { approach: "N", vehicleClass: "car", count: 3 },
      { approach: "N", vehicleClass: "motorcycle", count: 1 },
    ]);
    expect(topics["vision/counts"].schema.safeParse(c).success).toBe(true);
    expect(v.takeCounts(1.7e12)).toBeUndefined();
  });
});

describe("heartbeat and breach", () => {
  it("counts seq up with ok, confidence 0.9 and fps 15", () => {
    const v = createVision(0);
    const ts = 1.7e12;
    expect(v.heartbeat(ts)).toEqual({
      v: 1,
      ts,
      seq: 0,
      ok: true,
      confidence: 0.9,
      fps: 15,
    });
    expect(v.heartbeat(ts + 1000).seq).toBe(1);
    expect(v.heartbeat(ts + 2000).seq).toBe(2);
  });

  it("builds a schema-valid breach with the placeholder crop and new ids", () => {
    const v = createVision(0);
    const a = v.breach(1.7e12);
    const b = v.breach(1.7e12, "E", "tricycle");
    expect(topics["vision/breach"].schema.safeParse(a).success).toBe(true);
    expect(b).toMatchObject({ approach: "E", vehicleClass: "tricycle" });
    expect(a.id).not.toBe(b.id);
    expect(a.crop?.mime).toBe("image/jpeg");
    expect(a.centroid.x).toBeGreaterThanOrEqual(0);
    expect(a.centroid.x).toBeLessThanOrEqual(1);
  });
});

describe("placeholder crop", () => {
  it("is a baseline JPEG with no APP1 and a long side of 64 px or less", () => {
    const b = readFileSync(
      new URL("../assets/placeholder-crop.jpg", import.meta.url),
    );
    expect([b[0], b[1]]).toEqual([0xff, 0xd8]);
    expect(b[3]).toBe(0xe0); // APP0 JFIF first
    const markers: number[] = [];
    let size: [number, number] | undefined;
    for (let i = 2; i < b.length && b[i + 1] !== 0xda; ) {
      const m = b[i + 1];
      markers.push(m);
      if (m === 0xc0) size = [b.readUInt16BE(i + 5), b.readUInt16BE(i + 7)];
      i += 2 + b.readUInt16BE(i + 2);
    }
    expect(markers).not.toContain(0xe1); // no EXIF
    expect(markers).toContain(0xc0); // baseline
    expect(
      markers.filter(
        (m) => m >= 0xc1 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc,
      ),
    ).toEqual([]);
    expect(Math.max(...(size ?? [Infinity]))).toBeLessThanOrEqual(64);
  });
});

describe("vision wiring", () => {
  const config = {
    MQTT_URL: "mqtt://127.0.0.1:1883",
    INTERSECTION_ID: "int-01",
    MQTT_PASSWORD: undefined,
  };
  const vt = (s: string) => `stl/int-01/vision/${s}`;
  const online = JSON.stringify({ v: 1, online: true, source: "sim" });
  const offline = JSON.stringify({ v: 1, online: false, source: "sim" });
  const on = (c: Fake, topic: string) =>
    c.publish.mock.calls.filter(([t]) => t === topic);
  const last = () => fake.clients.at(-1) as Fake;

  function start(
    force = false,
    pass = true,
    controller?: ReturnType<typeof createController>,
  ) {
    vi.useFakeTimers();
    vi.spyOn(console, "info").mockImplementation(() => {});
    const role = startVisionRole({ config, force, controller });
    const c = last();
    c.connected = true;
    c.emit("connect");
    if (pass && !force) vi.advanceTimersByTime(3000);
    return { role, c };
  }

  it("uses the vision link options and a retained online:false will", () => {
    const { role } = start(false, false);
    expect(fake.opts[0]).toMatchObject({
      clientId: "stl-sim-vision",
      username: "stl-sim-vision",
      clean: true,
      keepalive: 5,
      protocolVersion: 4,
      reconnectOnConnackError: true,
      will: {
        topic: vt("status"),
        payload: Buffer.from(offline),
        qos: 1,
        retain: true,
      },
    });
    void role.stop();
  });

  it("start check: a live heartbeat exits 1 with nothing published", () => {
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { c } = start(false, false);
    expect(c.subscribe.mock.calls[0]?.[0]).toEqual({
      [vt("heartbeat")]: { qos: 0 },
    });
    const hb = Buffer.from(JSON.stringify(createVision(0).heartbeat(1.7e12)));
    c.emit("message", vt("heartbeat"), hb, { retain: true }); // retained never counts
    expect(exit).not.toHaveBeenCalled();
    c.emit("message", vt("heartbeat"), hb, { retain: false });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err.mock.lastCall?.[0]).toMatch(/^\[sim\] another vision node/);
    vi.advanceTimersByTime(10_000);
    expect(c.publish).not.toHaveBeenCalled();
  });

  it("start check: the link closing in the window exits 1", () => {
    const exit = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { c } = start(false, false);
    c.connected = false;
    c.emit("close");
    expect(exit).toHaveBeenCalledWith(1);
    vi.advanceTimersByTime(10_000);
    expect(c.publish).not.toHaveBeenCalled();
  });

  it("goes online after 3 s quiet, unsubscribes, and beats at 1 Hz from seq 0", () => {
    const { role, c } = start(false, false);
    vi.advanceTimersByTime(2900);
    expect(c.publish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(c.publish.mock.calls[0]).toEqual([
      vt("status"),
      online,
      { qos: 1, retain: true },
    ]);
    expect(c.unsubscribe).toHaveBeenCalledWith(vt("heartbeat"));
    vi.advanceTimersByTime(3000);
    const beats = on(c, vt("heartbeat")).map(([, b]) => JSON.parse(b));
    expect(beats.map((b) => b.seq)).toEqual([0, 1, 2, 3]);
    expect(
      beats.every(
        (b) => topics["vision/heartbeat"].schema.safeParse(b).success,
      ),
    ).toBe(true);
    vi.advanceTimersByTime(7000);
    expect(on(c, vt("status")).length).toBe(2); // again 10 s later
    void role.stop();
  });

  it("--force clears the retained status before its own online:true", () => {
    const { role, c } = start(true);
    expect(c.subscribe).not.toHaveBeenCalled();
    expect(c.publish.mock.calls[0]).toEqual([
      vt("status"),
      "",
      { qos: 1, retain: true },
    ]);
    expect(c.publish.mock.calls[1]?.slice(0, 2)).toEqual([
      vt("status"),
      online,
    ]);
    void role.stop();
  });

  it("publishes demand on change at most every 100 ms, and nothing without change", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // a car on every approach every step
    const { role, c } = start(true);
    const times = [Date.now()]; // the first state goes out on going online
    expect(on(c, vt("demand")).length).toBe(1);
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(50);
      if (on(c, vt("demand")).length > times.length) times.push(Date.now());
    }
    expect(times.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < times.length; i++)
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(100);
    const d = JSON.parse(on(c, vt("demand")).at(-1)?.[1]);
    expect(topics["vision/demand"].schema.safeParse(d).success).toBe(true);
    void role.stop();

    vi.spyOn(Math, "random").mockReturnValue(0.999); // nobody arrives
    const quiet = start(true);
    vi.advanceTimersByTime(5000);
    expect(on(quiet.c, vt("demand")).length).toBe(1); // the first state only
    void quiet.role.stop();
  });

  it("holds a second demand change within 100 ms until 100 ms after the first", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { role, c } = start(true);
    const t0 = Date.now(); // the first demand went out now
    vi.setSystemTime(t0 - 50); // so the next 100 ms tick lands at t0 + 50
    vi.advanceTimersByTime(100);
    expect(on(c, vt("demand")).length).toBe(1); // changed, but held
    vi.advanceTimersByTime(50);
    const sent = on(c, vt("demand"));
    expect(sent.length).toBe(2);
    expect(JSON.parse(sent[1]?.[1]).ts).toBe(t0 + 100);
    void role.stop();
  });

  it("publishes counts with new ids once per second only when vehicles crossed", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999);
    const quiet = start(true);
    vi.advanceTimersByTime(5000);
    expect(on(quiet.c, vt("counts"))).toEqual([]);
    void quiet.role.stop();

    vi.spyOn(Math, "random").mockReturnValue(0);
    const busy = start(true); // no controller: drains one every 3 s
    vi.advanceTimersByTime(10_000);
    const counts = on(busy.c, vt("counts"));
    expect(counts.length).toBeGreaterThanOrEqual(2);
    expect(counts[0]?.[2]).toEqual({ qos: 1, retain: false });
    const ids = counts.map(([, b]) => JSON.parse(b).id);
    expect(new Set(ids).size).toBe(ids.length);
    void busy.role.stop();
  });

  it("reads the in-process controller's signals", () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0); // a car on every approach every step
    const ctrl = createController(Date.now()); // NS green for 10 s
    const { role } = start(true, true, ctrl);
    const advance = (ms: number) => {
      for (let i = 0; i < ms / 100; i++) {
        vi.advanceTimersByTime(100);
        ctrl.step(Date.now());
      }
    };
    advance(1000); // queues fill to the 12-vehicle cap
    advance(4000);
    expect(ctrl.state().signals).toEqual(GREEN_NS);
    // N and S lose one every 1.5 s and refill each step; E and W sit at the cap.
    expect(role.vision.demand().pcu).toMatchObject({ E: 12, W: 12 });
    const approaches = new Set(
      on(last(), vt("counts")).flatMap(([, b]) =>
        JSON.parse(b).crossings.map((x: { approach: string }) => x.approach),
      ),
    );
    expect([...approaches].sort()).toEqual(["N", "S"]);
    void role.stop();
  });

  it("emits a breach on QoS 1 with the crop, and none while offline", () => {
    const { role, c } = start(true);
    const b = role.emitBreach("E", "tricycle");
    const [[, body, opts]] = on(c, vt("breach"));
    expect(opts).toEqual({ qos: 1, retain: false });
    expect(JSON.parse(body)).toEqual(b);
    expect(JSON.parse(body).crop.data).toBe(
      readFileSync(
        new URL("../assets/placeholder-crop.jpg", import.meta.url),
      ).toString("base64"),
    );
    void role.stop();
    expect(role.emitBreach()).toBeUndefined();
  });

  it("a broker reconnect republishes online:true and heartbeats keep counting, with no new subscribe", () => {
    const { role, c } = start(false);
    vi.advanceTimersByTime(2000);
    const subs = c.subscribe.mock.calls.length;
    c.connected = false;
    c.emit("close");
    vi.advanceTimersByTime(2000);
    c.publish.mockClear();
    c.connected = true;
    c.emit("connect");
    expect(c.publish.mock.calls[0]).toEqual([
      vt("status"),
      online,
      { qos: 1, retain: true },
    ]);
    vi.advanceTimersByTime(2000);
    const seqs = on(c, vt("heartbeat")).map(([, b]) => JSON.parse(b).seq);
    expect(seqs.length).toBeGreaterThan(0);
    expect(seqs[0]).toBeGreaterThan(2); // 0..2 went out before the outage
    expect(seqs).toEqual([...seqs].sort((x, y) => x - y));
    expect(c.subscribe.mock.calls.length).toBe(subs);
    void role.stop();
  });

  it("keeps crossings from a broker outage, but drops those made while stopped", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // a car on every approach every step
    const total = (cl: Fake) =>
      on(cl, vt("counts")).reduce(
        (n, [, b]) =>
          n +
          JSON.parse(b).crossings.reduce(
            (m: number, x: { count: number }) => m + x.count,
            0,
          ),
        0,
      );
    const { role, c } = start(true); // no controller: one leaves every 3 s per approach
    vi.advanceTimersByTime(1000);
    c.connected = false;
    c.emit("close");
    vi.advanceTimersByTime(7000); // two departures per approach while down
    c.publish.mockClear();
    c.connected = true;
    c.emit("connect");
    vi.advanceTimersByTime(1000);
    expect(total(c)).toBeGreaterThanOrEqual(8);

    await role.stop();
    vi.advanceTimersByTime(7000); // crossings while stopped
    role.start();
    const c2 = last();
    c2.connected = true;
    c2.emit("connect");
    vi.advanceTimersByTime(1000);
    expect(total(c2)).toBe(0); // the next departures are 3 s apart; the backlog is gone
    void role.stop();
  });

  it("stop publishes a retained online:false and ends; start reconnects without a check", async () => {
    const { role, c } = start(false);
    c.publish.mockClear();
    await role.stop();
    expect(c.publish.mock.calls[0]?.slice(0, 3)).toEqual([
      vt("status"),
      offline,
      { qos: 1, retain: true },
    ]);
    expect(c.end).toHaveBeenCalledOnce();
    expect(role.running()).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(on(c, vt("heartbeat"))).toEqual([]);

    role.start();
    expect(role.running()).toBe(true);
    const c2 = last();
    expect(c2).not.toBe(c);
    c2.connected = true;
    c2.emit("connect");
    expect(c2.subscribe).not.toHaveBeenCalled();
    expect(c2.publish.mock.calls[0]).toEqual([
      vt("status"),
      online,
      { qos: 1, retain: true },
    ]);
    vi.advanceTimersByTime(1000);
    expect(on(c2, vt("heartbeat")).length).toBeGreaterThan(0);
    void role.stop();
  });

  it("the controller drops to L2 within 3 s of vision stop and climbs to L1 after a start", async () => {
    vi.useFakeTimers();
    const ctrl = createController(Date.now());
    const { role, c } = start(true, true, ctrl);
    // Feed the controller what the broker would deliver.
    const forward = (cl: Fake) =>
      cl.publish.mockImplementation(
        (topic: string, body: string, ...rest: unknown[]) => {
          if (topic === vt("heartbeat"))
            ctrl.onHeartbeat(JSON.parse(body), false, Date.now());
          const cb = rest.at(-1);
          if (typeof cb === "function") cb();
        },
      );
    forward(c);
    for (let i = 0; i < 300; i++) {
      vi.advanceTimersByTime(100);
      ctrl.step(Date.now());
    }
    expect(ctrl.state().level).toBe("L1");
    await role.stop();
    const stoppedAt = Date.now();
    while (ctrl.state().level === "L1") {
      vi.advanceTimersByTime(100);
      ctrl.step(Date.now());
    }
    expect(ctrl.state().level).toBe("L2");
    expect(Date.now() - stoppedAt).toBeLessThanOrEqual(3000);

    role.start();
    const c2 = last();
    forward(c2);
    c2.connected = true;
    c2.emit("connect");
    for (let i = 0; i < 250; i++) {
      vi.advanceTimersByTime(100);
      ctrl.step(Date.now());
    }
    expect(ctrl.state()).toMatchObject({ level: "L1" });
    void role.stop();
  });
});
