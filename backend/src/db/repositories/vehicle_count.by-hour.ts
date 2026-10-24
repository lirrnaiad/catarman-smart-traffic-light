import type { Approach } from "@stl/contracts";
import type { RowDataPacket } from "mysql2";
import type { Pool } from "../pool.ts";

export type HourSum = {
  /** Asia/Manila hour of day, 0-23; unique within a range of at most one Manila day. */
  hour: number;
  approach: Approach;
  vehicleClass: string;
  count: number;
};

/** Sums `count` by Asia/Manila hour, approach and class for `from <= occurred_at < to` (AD-6). */
export async function vehicleCountsByHour(
  pool: Pool,
  from: Date,
  to: Date,
): Promise<HourSum[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT HOUR(CONVERT_TZ(occurred_at, '+00:00', '+08:00')) AS hour,
            approach, vehicle_class AS vehicleClass, SUM(count) AS count
     FROM vehicle_count
     WHERE occurred_at >= ? AND occurred_at < ?
     GROUP BY hour, approach, vehicle_class
     ORDER BY hour, vehicle_class`,
    [from, to],
  );
  // SUM comes back as a DECIMAL string.
  return rows.map((r) => ({
    hour: Number(r.hour),
    approach: r.approach,
    vehicleClass: r.vehicleClass,
    count: Number(r.count),
  }));
}
