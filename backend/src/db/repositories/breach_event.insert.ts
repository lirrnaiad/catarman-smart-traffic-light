import type { Approach } from "@stl/contracts";
import type { ResultSetHeader } from "mysql2";
import type { Pool } from "../pool.ts";

export type BreachEventRow = {
  eventId: string;
  approach: Approach;
  vehicleClass: string;
  centroid: { x: number; y: number };
  occurredAt: Date;
  receivedAt: Date;
  /** Already checked (AD-11); stored as-is, never re-encoded. */
  crop?: { mime: string; data: Buffer };
};

/**
 * The event, then its crop, in one transaction (AD-11). A redelivered event_id is a
 * no-op and writes no crop. Returns whether the event was added: mysql2 connects with
 * CLIENT_FOUND_ROWS, so `insertId` is the signal (0 only when nothing was inserted).
 */
export async function insertBreachEvent(
  pool: Pool,
  row: BreachEventRow,
): Promise<boolean> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO breach_event (event_id, approach, vehicle_class, centroid_x, centroid_y, occurred_at, received_at)
       VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id`,
      [
        row.eventId,
        row.approach,
        row.vehicleClass,
        row.centroid.x,
        row.centroid.y,
        row.occurredAt,
        row.receivedAt,
      ],
    );
    const added = result.insertId > 0;
    if (added && row.crop) {
      await conn.query(
        "INSERT INTO breach_crop (breach_event_id, mime, data) VALUES (?, ?, ?)",
        [result.insertId, row.crop.mime, row.crop.data],
      );
    }
    await conn.commit();
    return added;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}
