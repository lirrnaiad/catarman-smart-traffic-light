import { type StateChangeItem, StateOverride } from "@stl/contracts";
import type { RowDataPacket } from "mysql2/promise";
import type { Pool } from "../pool.ts";

/** The eight compared fields of a stored change (AD-5); `remainingS` and `power` are never stored. */
export type StoredState = Pick<
  StateChangeItem,
  "level" | "signals" | "flood" | "fault" | "override"
>;

export type Row = RowDataPacket & {
  level: StateChangeItem["level"];
  signal_ns: StateChangeItem["signals"]["NS"];
  signal_ew: StateChangeItem["signals"]["EW"];
  flood: StateChangeItem["flood"];
  fault: number;
  override_mode: string | null;
  override_phase: string | null;
  override_command_id: string | null;
  received_at: Date;
};

export const COLUMNS =
  "level, signal_ns, signal_ew, flood, fault, override_mode, override_phase, override_command_id, received_at";

/** A row as a stored state plus its ISO UTC `receivedAt` (AD-6); three NULLs are no override. */
export function toState(row: Row): StoredState & { receivedAt: string } {
  const mode = row.override_mode;
  const phase = row.override_phase;
  const commandId = row.override_command_id;
  return {
    receivedAt: row.received_at.toISOString(),
    level: row.level,
    signals: { NS: row.signal_ns, EW: row.signal_ew },
    flood: row.flood,
    fault: Boolean(row.fault),
    override:
      mode === null
        ? null
        : StateOverride.parse({
            mode,
            ...(phase !== null && { phase }),
            ...(commandId !== null && { commandId }),
          }),
  };
}

// shortcut: the cursor carries only received_at (no row id may leave the backend), so two changes
// in the same millisecond on either side of a page boundary lose one; add a public id if that ever matters.
/** Newest first by received_at, strictly older than `before`. */
export async function listStateChanges(
  pool: Pool,
  limit: number,
  before?: Date,
): Promise<Array<StoredState & { receivedAt: string }>> {
  const [rows] = await pool.query<Row[]>(
    `SELECT ${COLUMNS} FROM signal_state_change
     ${before ? "WHERE received_at < ?" : ""}
     ORDER BY received_at DESC, id DESC LIMIT ?`,
    before ? [before, limit] : [limit],
  );
  return rows.map(toState);
}
