import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { resetDb } from "../../../test/reset-db.ts";
import { config } from "../../config.ts";
import { createPool, type Pool } from "../../db/pool.ts";
import { hourlyCounts } from "../../services/counts.ts";
import { createLink } from "../../services/link.ts";
import { createHub, type Hub } from "../../sse/hub.ts";
import { dispatch } from "../client.ts";
import { handlers } from "./index.ts";

// Hits the real stl_test database through dispatch and the real registry.
const pool = createPool(config.DATABASE_URL);
const TOPIC = "stl/int-01/vision/counts";
const HOUR_MS = 3_600_000;

let hub: Hub;
function send(msg: object, p: Pool = pool) {
  const link = createLink(hub);
  return dispatch(TOPIC, JSON.stringify({ v: 1, ...msg }), false, {
    iid: "int-01",
    handlers,
    pool: p,
    hub,
    publisher: { publish: async () => {} },
    link,
    getLink: link.get,
  });
}

type Row = {
  msg_id: string;
  approach: string;
  vehicle_class: string;
  count: number;
  occurred_at: Date;
  received_at: Date;
};

async function rows(): Promise<Row[]> {
  const [r] = await pool.query(
    "SELECT msg_id, approach, vehicle_class, count, occurred_at, received_at FROM vehicle_count ORDER BY id",
  );
  return r as Row[];
}

const two = [
  { approach: "N", vehicleClass: "car", count: 2 },
  { approach: "E", vehicleClass: "tricycle", count: 3 },
];

beforeEach(async () => {
  await resetDb(pool);
  hub = createHub({ validate: "throw" });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await resetDb(pool);
  await pool.end();
});

describe("vision/counts persist", () => {
  it("stores each crossing and refreshes the slice with them", async () => {
    const id = randomUUID();
    await send({ id, crossings: two });
    const stored = await rows();
    expect(
      stored.map((r) => [r.msg_id, r.approach, r.vehicle_class, r.count]),
    ).toEqual([
      [id, "N", "car", 2],
      [id, "E", "tricycle", 3],
    ]);
    // No ts: occurred_at falls back to receivedAt.
    expect(stored[0].occurred_at).toEqual(stored[0].received_at);
    const slice = hub.getSlice("counts");
    expect(slice?.total).toBe(5);
    expect(slice?.byApproach.N.car).toBe(2);
    expect(slice?.byApproach.E.tricycle).toBe(3);
  });

  it("ignores a redelivery: no new rows, no refresh", async () => {
    const id = randomUUID();
    await send({ id, crossings: two });
    const setSlice = vi.spyOn(hub, "setSlice");
    await send({ id, crossings: two });
    expect(await rows()).toHaveLength(2);
    expect(setSlice).not.toHaveBeenCalled();
  });

  it("stores an unknown class and shows it beside the dense configured ids", async () => {
    await send({
      id: randomUUID(),
      crossings: [{ approach: "W", vehicleClass: "kalesa", count: 1 }],
    });
    expect((await rows())[0].vehicle_class).toBe("kalesa");
    const slice = hub.getSlice("counts");
    expect(Object.keys(slice?.byApproach.W ?? {})).toEqual([
      "car",
      "tricycle",
      "motorcycle",
      "jeepney",
      "utility_van",
      "kalesa",
    ]);
    expect(slice?.byApproach.W.kalesa).toBe(1);
    expect(slice?.byApproach.N.kalesa).toBe(0);
  });

  it("keeps an old ts: out of the current-hour slice, in its hourly bucket", async () => {
    const ts = Date.now() - 3 * HOUR_MS;
    await send({ id: randomUUID(), ts, crossings: two });
    expect((await rows())[0].occurred_at.getTime()).toBe(ts);
    expect(hub.getSlice("counts")?.total).toBe(0);
    const manila = new Date(ts + 8 * HOUR_MS);
    const day = await hourlyCounts(pool, manila.toISOString().slice(0, 10));
    expect(day.buckets[manila.getUTCHours()].total).toBe(5);
  });

  it("uses receivedAt and warns when ts is 2 days off", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await send({
      id: randomUUID(),
      ts: Date.now() - 48 * HOUR_MS,
      crossings: two,
    });
    const [r] = await rows();
    expect(r.occurred_at).toEqual(r.received_at);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[mqtt]"));
  });

  it("logs an insert failure without throwing or refreshing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const setSlice = vi.spyOn(hub, "setSlice");
    const broken = {
      query: async () => {
        throw new Error("db down");
      },
    } as unknown as Pool;
    await send({ id: randomUUID(), crossings: two }, broken);
    expect(setSlice).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[mqtt] vision/counts"),
      "db down",
    );
  });

  it("handles a burst: at most 2 concurrent reads, final slice has all 5", async () => {
    let active = 0;
    let peak = 0;
    const query = pool.query.bind(pool) as (...a: unknown[]) => unknown;
    vi.spyOn(pool, "query").mockImplementation((async (...args: unknown[]) => {
      const read = String(args[0]).includes("GROUP BY");
      if (read) peak = Math.max(peak, ++active);
      try {
        return await query(...args);
      } finally {
        if (read) active--;
      }
    }) as typeof pool.query);
    await Promise.all(
      Array.from({ length: 5 }, () =>
        send({
          id: randomUUID(),
          crossings: [{ approach: "S", vehicleClass: "motorcycle", count: 1 }],
        }),
      ),
    );
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThanOrEqual(2);
    expect(hub.getSlice("counts")?.byApproach.S.motorcycle).toBe(5);
  });
});
