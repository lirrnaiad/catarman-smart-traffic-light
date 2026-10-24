import type { OverrideCommand } from "@stl/contracts";
import type { RowDataPacket } from "mysql2/promise";
import type { Pool } from "../pool.ts";

export type Row = RowDataPacket & {
  command_id: string;
  mode: OverrideCommand["mode"];
  phase: OverrideCommand["phase"];
  status: OverrideCommand["status"];
  reason: string | null;
  requested_at: Date;
  resolved_at: Date | null;
};

export const COLUMNS =
  "command_id, mode, phase, status, reason, requested_at, resolved_at";

/** A row as the `OverrideCommand` DTO, times as ISO UTC (AD-6). */
export function toCommand(row: Row): OverrideCommand {
  return {
    commandId: row.command_id,
    mode: row.mode,
    phase: row.phase,
    status: row.status,
    reason: row.reason,
    requestedAt: row.requested_at.toISOString(),
    resolvedAt: row.resolved_at?.toISOString() ?? null,
  };
}

export async function findOverride(
  pool: Pool,
  commandId: string,
): Promise<OverrideCommand | null> {
  const [rows] = await pool.query<Row[]>(
    `SELECT ${COLUMNS} FROM override_command WHERE command_id = ?`,
    [commandId],
  );
  return rows[0] ? toCommand(rows[0]) : null;
}

/** Newest first by (requested_at, command_id), both descending, strictly after `after`. */
export async function listOverrides(
  pool: Pool,
  limit: number,
  after?: { requestedAt: Date; commandId: string },
): Promise<OverrideCommand[]> {
  const where = after
    ? "WHERE requested_at < ? OR (requested_at = ? AND command_id < ?)"
    : "";
  const params = after
    ? [after.requestedAt, after.requestedAt, after.commandId, limit]
    : [limit];
  const [rows] = await pool.query<Row[]>(
    `SELECT ${COLUMNS} FROM override_command ${where}
     ORDER BY requested_at DESC, command_id DESC LIMIT ?`,
    params,
  );
  return rows.map(toCommand);
}
