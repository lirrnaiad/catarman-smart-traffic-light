import type { Pool } from "../pool.ts";
import type { StoredState } from "./signal_state_change.list.ts";

/** An absent override stores three NULLs (AD-5). */
export async function insertStateChange(
  pool: Pool,
  state: StoredState,
  receivedAt: Date,
): Promise<void> {
  const o = state.override;
  await pool.query(
    `INSERT INTO signal_state_change
       (level, signal_ns, signal_ew, flood, fault,
        override_mode, override_phase, override_command_id, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      state.level,
      state.signals.NS,
      state.signals.EW,
      state.flood,
      state.fault,
      o?.mode ?? null,
      o?.mode === "CORRIDOR" ? o.phase : null,
      o?.commandId ?? null,
      receivedAt,
    ],
  );
}
