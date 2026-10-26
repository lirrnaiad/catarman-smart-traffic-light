import { fileURLToPath } from "node:url";
import vehicleClasses from "@stl/contracts/vehicle-classes.json" with {
  type: "json",
};
import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { seed } from "../scripts/db-seed.ts";
import { config } from "../src/config.ts";
import { createPool } from "../src/db/pool.ts";
import { resetDb } from "./reset-db.ts";

// Applies the real backend/db/seed files to stl_test.
const pool = createPool(config.DATABASE_URL, { multipleStatements: true });
const dir = fileURLToPath(new URL("../db/seed/", import.meta.url));

beforeEach(() => resetDb(pool));
afterAll(async () => {
  await resetDb(pool);
  await pool.end();
});

async function one<T>(sql: string): Promise<T[]> {
  const [rows] = await pool.query(sql);
  return rows as T[];
}

it("loads ~24 h of counts and replaces them on a second run", async () => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  await seed(pool, dir);
  const stats = () =>
    one<Record<string, unknown>>(
      `SELECT COUNT(*) AS n, COUNT(DISTINCT approach) AS approaches,
              COUNT(DISTINCT vehicle_class) AS classes,
              TIMESTAMPDIFF(MINUTE, MIN(occurred_at), MAX(occurred_at)) AS span
       FROM vehicle_count`,
    );
  const [first] = await stats();
  expect(Number(first.n)).toBe(288 * 4 * 5);
  expect(Number(first.approaches)).toBe(4);
  expect(Number(first.classes)).toBe(5);
  const ids = await one<{ c: string }>(
    "SELECT DISTINCT vehicle_class AS c FROM vehicle_count",
  );
  expect(ids.map((r) => r.c).sort()).toEqual(
    vehicleClasses.map((c) => c.id).sort(),
  );
  expect(Number(first.span)).toBe(23 * 60 + 55);

  await seed(pool, dir);
  expect(Number((await stats())[0].n)).toBe(Number(first.n));

  // Motorcycles and tricycles dominate; the 07:00 and 17:00 Manila hours beat 03:00.
  const byClass = await one<{ c: string }>(
    `SELECT vehicle_class AS c, SUM(count) AS n FROM vehicle_count
     GROUP BY vehicle_class ORDER BY n DESC`,
  );
  expect(byClass.slice(0, 2).map((r) => r.c)).toEqual([
    "motorcycle",
    "tricycle",
  ]);
  const byHour = await one<{ h: number; n: string }>(
    `SELECT HOUR(CONVERT_TZ(occurred_at, '+00:00', '+08:00')) AS h, SUM(count) AS n
     FROM vehicle_count GROUP BY h`,
  );
  const n = (h: number) => Number(byHour.find((r) => r.h === h)?.n);
  expect(n(7)).toBeGreaterThan(3 * n(3));
  expect(n(17)).toBeGreaterThan(3 * n(3));
});
