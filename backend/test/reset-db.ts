import type { Pool } from "../src/db/pool.ts";

/** Empties every M1 table; deletes rows, never truncates (AD-10). breach_crop goes first. */
export async function resetDb(pool: Pool): Promise<void> {
  // An exported DATABASE_URL beats .env.test, so refuse to wipe anything but stl_test.
  const [rows] = await pool.query("SELECT DATABASE() AS db");
  const db = (rows as Array<{ db: string | null }>)[0].db;
  if (db !== "stl_test") throw new Error(`resetDb refuses to run on ${db}`);
  for (const table of [
    "breach_crop",
    "breach_event",
    "override_command",
    "signal_state_change",
    "vehicle_count",
  ]) {
    await pool.query(`DELETE FROM ${table}`);
  }
}
