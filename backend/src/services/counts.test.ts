import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb } from "../../test/reset-db.ts";
import { config } from "../config.ts";
import { createPool, type Pool } from "../db/pool.ts";
import { insertVehicleCounts } from "../db/repositories/vehicle_count.insert.ts";
import { createHub } from "../sse/hub.ts";
import { hourlyCounts, refreshCounts } from "./counts.ts";

// Hits the real stl_test database.
const pool = createPool(config.DATABASE_URL);
const CONFIGURED = ["car", "tricycle", "motorcycle", "jeepney", "utility_van"];
const zeros = Object.fromEntries(CONFIGURED.map((id) => [id, 0]));

const row = (msgId: string, iso: string, count: number) => ({
  msgId,
  approach: "N" as const,
  vehicleClass: "car",
  count,
  occurredAt: new Date(iso),
  receivedAt: new Date(iso),
});

beforeEach(() => resetDb(pool));
afterAll(async () => {
  await resetDb(pool);
  await pool.end();
});

describe("refreshCounts", () => {
  it("writes a dense all-zero hour when there are no rows", async () => {
    const hub = createHub({ validate: "throw" });
    await refreshCounts({ pool, hub }, new Date("2026-10-24T03:27:00.000Z"));
    expect(hub.getSlice("counts")).toEqual({
      hourStart: "2026-10-24T03:00:00.000Z",
      total: 0,
      byApproach: { N: zeros, S: zeros, E: zeros, W: zeros },
    });
  });

  it("counts only the Manila hour containing now", async () => {
    await insertVehicleCounts(pool, [
      row("00000000-0000-4000-8000-000000000001", "2026-10-24T03:00:00Z", 2),
      row(
        "00000000-0000-4000-8000-000000000002",
        "2026-10-24T03:59:59.999Z",
        3,
      ),
      row(
        "00000000-0000-4000-8000-000000000003",
        "2026-10-24T02:59:59.999Z",
        9,
      ),
      row("00000000-0000-4000-8000-000000000004", "2026-10-24T04:00:00Z", 9),
    ]);
    const hub = createHub({ validate: "throw" });
    await refreshCounts({ pool, hub }, new Date("2026-10-24T03:27:00.000Z"));
    expect(hub.getSlice("counts")?.total).toBe(5);
    expect(hub.getSlice("counts")?.byApproach.N.car).toBe(5);
  });
});

describe("refreshCounts on a failed read", () => {
  it("resolves, logs, and keeps the previous slice", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const hub = createHub({ validate: "throw" });
    const now = new Date("2026-10-24T03:27:00.000Z");
    await refreshCounts({ pool, hub }, now);
    const before = hub.getSlice("counts");
    const broken = {
      query: async () => {
        throw new Error("db down");
      },
    } as unknown as Pool;
    await expect(refreshCounts({ pool: broken, hub }, now)).resolves.toBe(
      undefined,
    );
    expect(error).toHaveBeenCalledWith(
      "[job] counts refresh failed:",
      "db down",
    );
    expect(hub.getSlice("counts")).toBe(before);
    error.mockRestore();
  });
});

describe("hourlyCounts", () => {
  it("returns 24 buckets with rows at Manila 07:xx and 17:xx in their hours", async () => {
    await insertVehicleCounts(pool, [
      row(
        "00000000-0000-4000-8000-000000000001",
        "2026-10-24T07:15:00+08:00",
        4,
      ),
      row(
        "00000000-0000-4000-8000-000000000002",
        "2026-10-24T17:59:59.999+08:00",
        6,
      ),
      // The neighbouring Manila dates stay out.
      row(
        "00000000-0000-4000-8000-000000000003",
        "2026-10-23T23:59:59.999+08:00",
        9,
      ),
      row(
        "00000000-0000-4000-8000-000000000004",
        "2026-10-25T00:00:00+08:00",
        9,
      ),
    ]);
    const day = await hourlyCounts(pool, "2026-10-24");
    expect(day.date).toBe("2026-10-24");
    expect(day.buckets).toHaveLength(24);
    expect(day.buckets[0].hourStart).toBe("2026-10-23T16:00:00.000Z");
    expect(day.buckets[7].hourStart).toBe("2026-10-23T23:00:00.000Z");
    expect(day.buckets.map((b) => b.total)).toEqual(
      Array.from({ length: 24 }, (_, h) => (h === 7 ? 4 : h === 17 ? 6 : 0)),
    );
    expect(day.buckets[3].byApproach.W).toEqual(zeros);
  });
});
