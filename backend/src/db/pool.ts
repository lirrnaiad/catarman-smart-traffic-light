import mysql, { type Pool, type PoolOptions } from "mysql2/promise";

export type { Pool };

/** The one mysql2 pool (AD-10), UTC on both sides (AD-6). */
export function createPool(url: string, opts: PoolOptions = {}): Pool {
  const pool = mysql.createPool({ uri: url, timezone: "Z", ...opts });
  // Queries on one connection run in order, so this lands before the first real query.
  pool.pool.on("connection", (conn) => {
    conn.query("SET time_zone = '+00:00'", (err) => {
      if (!err) return;
      console.error("[db] SET time_zone failed:", err.message);
      conn.destroy();
    });
  });
  return pool;
}

/** True when the database answers; never throws. */
export async function pingDb(pool: Pool): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
