import type { RowDataPacket } from "mysql2";
import type { Pool } from "../pool.ts";

/** The crop bytes for a breach's public id, or null when the breach or its crop is missing. */
export async function getBreachCrop(
  pool: Pool,
  eventId: string,
): Promise<Buffer | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.data FROM breach_crop c
     JOIN breach_event e ON e.id = c.breach_event_id
     WHERE e.event_id = ?`,
    [eventId],
  );
  return rows[0]?.data ?? null;
}
