import type { RowDataPacket } from "mysql2/promise";
import type { Pool } from "../pool.ts";

/** Read-only: which of `ids` are release (mode NONE) commands. One query per page. */
export async function releaseCommandIds(
  pool: Pool,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const [rows] = await pool.query<
    Array<RowDataPacket & { command_id: string }>
  >(
    `SELECT command_id FROM override_command
     WHERE mode = 'NONE' AND command_id IN (?)`,
    [ids],
  );
  return new Set(rows.map((r) => r.command_id));
}
