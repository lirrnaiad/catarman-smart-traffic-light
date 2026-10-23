import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { seed } from "../scripts/db-seed.ts";
import { config } from "../src/config.ts";
import { createPool, pingDb } from "../src/db/pool.ts";
import { resetDb } from "./reset-db.ts";

// Hits the real stl_test database (migrated by globalSetup).
const pool = createPool(config.DATABASE_URL, { multipleStatements: true });
const TABLES = [
  "breach_crop",
  "breach_event",
  "override_command",
  "signal_state_change",
  "vehicle_count",
];

async function count(table: string): Promise<number> {
  const [rows] = await pool.query(`SELECT COUNT(*) AS n FROM ${table}`);
  return Number((rows as Array<{ n: number }>)[0].n);
}

const insertOverride = (commandId: string) =>
  `INSERT INTO override_command (command_id, mode, status, requested_at)
   VALUES ('${commandId}', 'NONE', 'REQUESTED', UTC_TIMESTAMP(3));`;

beforeEach(() => resetDb(pool));
afterAll(async () => {
  await resetDb(pool);
  await pool.end();
});

describe("pool", () => {
  it("pings and runs every connection in UTC", async () => {
    expect(await pingDb(pool)).toBe(true);
    const [rows] = await pool.query("SELECT @@session.time_zone AS tz");
    expect((rows as Array<{ tz: string }>)[0].tz).toBe("+00:00");
  });

  it("reads DATETIME(3) back as the same UTC instant", async () => {
    const at = new Date("2026-10-23T08:00:00.123Z");
    await pool.query(
      `INSERT INTO override_command (command_id, mode, status, requested_at)
       VALUES ('00000000-0000-4000-8000-000000000005', 'NONE', 'REQUESTED', ?)`,
      [at],
    );
    const [rows] = await pool.query(
      "SELECT requested_at FROM override_command",
    );
    expect(
      (rows as Array<{ requested_at: Date }>)[0].requested_at.toISOString(),
    ).toBe(at.toISOString());
  });

  it("pingDb resolves false instead of throwing when the database is unreachable", async () => {
    const dead = createPool("mysql://stl:stl@127.0.0.1:1/stl_test");
    expect(await pingDb(dead)).toBe(false);
    await dead.end();
  });
});

describe("resetDb", () => {
  it("empties every table, crops included", async () => {
    await pool.query(
      `INSERT INTO breach_event (event_id, approach, vehicle_class, centroid_x, centroid_y, occurred_at, received_at)
       VALUES ('00000000-0000-4000-8000-000000000001', 'N', 'car', 0.5, 0.5, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
    );
    await pool.query(
      `INSERT INTO breach_crop (breach_event_id, mime, data)
       SELECT id, 'image/jpeg', x'FF' FROM breach_event`,
    );
    await pool.query(insertOverride("00000000-0000-4000-8000-000000000002"));
    await pool.query(
      `INSERT INTO signal_state_change (level, signal_ns, signal_ew, flood, fault, received_at)
       VALUES ('L3', 'GREEN', 'RED', 'DRY', false, UTC_TIMESTAMP(3))`,
    );
    await pool.query(
      `INSERT INTO vehicle_count (msg_id, approach, vehicle_class, count, occurred_at, received_at)
       VALUES ('00000000-0000-4000-8000-000000000003', 'N', 'car', 1, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
    );
    for (const t of TABLES) expect(await count(t)).toBe(1);
    await resetDb(pool);
    for (const t of TABLES) expect(await count(t)).toBe(0);
  });
});

describe("seed", () => {
  const dir = mkdtempSync(join(tmpdir(), "stl-seed-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("does nothing when there are no seed files", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await seed(pool, join(dir, "missing"))).toEqual([]);
  });

  it("applies each .sql file in lexical order", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const id = "00000000-0000-4000-8000-000000000004";
    // 02 only works if 01 ran first.
    writeFileSync(
      join(dir, "02-update.sql"),
      `UPDATE override_command SET status = 'APPLIED' WHERE command_id = '${id}';
       UPDATE override_command SET reason = 'SEEDED' WHERE command_id = '${id}';`,
    );
    writeFileSync(join(dir, "01-insert.sql"), insertOverride(id));
    writeFileSync(join(dir, "notes.txt"), "not sql");
    expect(await seed(pool, dir)).toEqual(["01-insert.sql", "02-update.sql"]);
    const [rows] = await pool.query(
      "SELECT status, reason FROM override_command",
    );
    expect(rows).toEqual([{ status: "APPLIED", reason: "SEEDED" }]);
  });

  it("rejects on a SQL error", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    writeFileSync(join(dir, "03-bad.sql"), "SELECT FROM nowhere;");
    await expect(seed(pool, dir)).rejects.toThrow();
  });
});
