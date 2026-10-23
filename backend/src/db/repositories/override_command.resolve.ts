import type { ResultSetHeader } from "mysql2/promise";
import type { Pool } from "../pool.ts";

/**
 * Resolves a REQUESTED or TIMEOUT row to APPLIED or REJECTED (AD-7 rule 5).
 * False when nothing changed: an unknown id or a row already terminal.
 */
export async function resolveOverride(
  pool: Pool,
  commandId: string,
  status: "APPLIED" | "REJECTED",
  reason: string | null,
  resolvedAt: Date,
): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE override_command SET status = ?, reason = ?, resolved_at = ?
     WHERE command_id = ? AND status IN ('REQUESTED', 'TIMEOUT')`,
    [status, reason, resolvedAt, commandId],
  );
  return result.affectedRows > 0;
}
