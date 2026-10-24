import type { OverrideCommand } from "@stl/contracts";
import type { Pool } from "../pool.ts";

export async function insertOverride(
  pool: Pool,
  cmd: OverrideCommand,
): Promise<void> {
  await pool.query(
    `INSERT INTO override_command
       (command_id, mode, phase, status, reason, requested_at, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      cmd.commandId,
      cmd.mode,
      cmd.phase,
      cmd.status,
      cmd.reason,
      new Date(cmd.requestedAt),
      cmd.resolvedAt === null ? null : new Date(cmd.resolvedAt),
    ],
  );
}
