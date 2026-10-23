import type { OverrideCommand } from "@stl/contracts";
import type { ResultSetHeader } from "mysql2/promise";
import type { Pool } from "../pool.ts";
import { COLUMNS, type Row, toCommand } from "./override_command.list.ts";

/** REQUESTED rows requested at or before `cutoff`. */
export async function listRequestedBefore(
  pool: Pool,
  cutoff: Date,
): Promise<OverrideCommand[]> {
  const [rows] = await pool.query<Row[]>(
    `SELECT ${COLUMNS} FROM override_command
     WHERE status = 'REQUESTED' AND requested_at <= ?`,
    [cutoff],
  );
  return rows.map(toCommand);
}

/** REQUESTED → TIMEOUT, `resolved_at` left null. False if the row was no longer REQUESTED. */
export async function markTimeout(
  pool: Pool,
  commandId: string,
): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE override_command SET status = 'TIMEOUT'
     WHERE command_id = ? AND status = 'REQUESTED'`,
    [commandId],
  );
  return result.affectedRows > 0;
}
