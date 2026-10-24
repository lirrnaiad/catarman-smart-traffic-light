import request from "supertest";
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
import { createApp } from "../../app.ts";
import { config } from "../../config.ts";
import { createPool } from "../../db/pool.ts";
import { insertVehicleCounts } from "../../db/repositories/vehicle_count.insert.ts";
import { createHub, initialLink } from "../../sse/hub.ts";

// Hits the real stl_test database.
const pool = createPool(config.DATABASE_URL);
const app = createApp({
  pool,
  hub: createHub({ validate: "throw" }),
  publisher: { publish: async () => {} },
  getLink: () => initialLink,
});

const row = (
  n: number,
  iso: string,
  approach: "N" | "S" | "E" | "W",
  vehicleClass: string,
  count: number,
) => ({
  msgId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  approach,
  vehicleClass,
  count,
  occurredAt: new Date(iso),
  receivedAt: new Date(iso),
});

beforeEach(() => resetDb(pool));
afterEach(() => vi.useRealTimers());
afterAll(async () => {
  await resetDb(pool);
  await pool.end();
});

describe("GET /api/counts/hourly", () => {
  it("returns 24 buckets whose totals are the Manila-hour sums of the day", async () => {
    await insertVehicleCounts(pool, [
      // Manila 2026-10-22 07:10 and 07:50 (UTC 23:10 and 23:50 the day before).
      row(1, "2026-10-21T23:10:00Z", "N", "car", 3),
      row(2, "2026-10-21T23:50:00Z", "S", "tricycle", 4),
      // Manila 17:30.
      row(3, "2026-10-22T09:30:00Z", "E", "car", 6),
      // Manila 2026-10-21 23:59 and 2026-10-23 00:00: outside the day.
      row(4, "2026-10-21T15:59:00Z", "N", "car", 50),
      row(5, "2026-10-22T16:00:00Z", "N", "car", 50),
    ]);
    const res = await request(app).get("/api/counts/hourly?date=2026-10-22");
    expect(res.status).toBe(200);
    expect(res.body.date).toBe("2026-10-22");
    expect(res.body.buckets).toHaveLength(24);
    const totals = res.body.buckets.map((b: { total: number }) => b.total);
    expect(totals).toEqual(
      Array.from({ length: 24 }, (_, h) => (h === 7 ? 7 : h === 17 ? 6 : 0)),
    );
    expect(res.body.buckets[0].hourStart).toBe("2026-10-21T16:00:00.000Z");
    expect(res.body.buckets[7].byApproach.S.tricycle).toBe(4);
  });

  it("defaults to today in Asia/Manila", async () => {
    // UTC 2026-10-24 17:00 is already 2026-10-25 01:00 in Manila.
    vi.useFakeTimers({
      now: new Date("2026-10-24T17:00:00Z"),
      toFake: ["Date"],
    });
    const res = await request(app).get("/api/counts/hourly");
    expect(res.status).toBe(200);
    expect(res.body.date).toBe("2026-10-25");
  });

  it("rejects a bad date with 400 VALIDATION_FAILED", async () => {
    const res = await request(app).get("/api/counts/hourly?date=2026-13-40");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });
});
