import type { Approach } from "@stl/contracts";
import type { ResultSetHeader } from "mysql2";
import type { Pool } from "../pool.ts";

export type VehicleCountRow = {
  msgId: string;
  approach: Approach;
  vehicleClass: string;
  count: number;
  occurredAt: Date;
  receivedAt: Date;
};

/**
 * One multi-row insert; a redelivered (msg_id, approach, class) is a no-op.
 * Returns whether any row was added. mysql2 connects with CLIENT_FOUND_ROWS, so
 * `affectedRows` counts a no-op duplicate as 1; `insertId` is 0 only when nothing was inserted.
 */
export async function insertVehicleCounts(
  pool: Pool,
  rows: VehicleCountRow[],
): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO vehicle_count (msg_id, approach, vehicle_class, count, occurred_at, received_at)
     VALUES ? ON DUPLICATE KEY UPDATE id = id`,
    [
      rows.map((r) => [
        r.msgId,
        r.approach,
        r.vehicleClass,
        r.count,
        r.occurredAt,
        r.receivedAt,
      ]),
    ],
  );
  return result.insertId > 0;
}
