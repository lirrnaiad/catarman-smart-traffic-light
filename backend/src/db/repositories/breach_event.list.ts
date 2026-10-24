import type { Approach } from "@stl/contracts";
import type { RowDataPacket } from "mysql2";
import type { Pool } from "../pool.ts";

export type BreachListRow = {
  eventId: string;
  approach: Approach;
  vehicleClass: string;
  centroid: { x: number; y: number };
  occurredAt: Date;
  receivedAt: Date;
  hasCrop: boolean;
};

/** Keyset page, newest first by (received_at, event_id), both descending; `after` is the last row seen. */
export async function listBreachEvents(
  pool: Pool,
  limit: number,
  after?: { receivedAt: Date; eventId: string },
): Promise<BreachListRow[]> {
  const where = after
    ? "WHERE e.received_at < ? OR (e.received_at = ? AND e.event_id < ?)"
    : "";
  const params = after
    ? [after.receivedAt, after.receivedAt, after.eventId, limit]
    : [limit];
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT e.event_id, e.approach, e.vehicle_class, e.centroid_x, e.centroid_y,
            e.occurred_at, e.received_at, c.breach_event_id IS NOT NULL AS has_crop
     FROM breach_event e LEFT JOIN breach_crop c ON c.breach_event_id = e.id
     ${where}
     ORDER BY e.received_at DESC, e.event_id DESC
     LIMIT ?`,
    params,
  );
  return rows.map((r) => ({
    eventId: r.event_id,
    approach: r.approach,
    vehicleClass: r.vehicle_class,
    centroid: { x: r.centroid_x, y: r.centroid_y },
    occurredAt: r.occurred_at,
    receivedAt: r.received_at,
    hasCrop: Boolean(r.has_crop),
  }));
}
