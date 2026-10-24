import type { Pool } from "../pool.ts";
import {
  COLUMNS,
  type Row,
  type StoredState,
  toState,
} from "./signal_state_change.list.ts";

/** The last persisted row (by id, so a clock step back can't pick another), or null on an empty table. */
export async function latestStateChange(
  pool: Pool,
): Promise<StoredState | null> {
  const [rows] = await pool.query<Row[]>(
    `SELECT ${COLUMNS} FROM signal_state_change
     ORDER BY id DESC LIMIT 1`,
  );
  return rows[0] ? toState(rows[0]) : null;
}
