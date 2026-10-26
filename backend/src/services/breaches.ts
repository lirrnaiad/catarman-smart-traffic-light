import {
  type BreachItem,
  isoUtc,
  type ListQuery,
  type Page,
  uuid,
} from "@stl/contracts";
import { z } from "zod";
import type { Pool } from "../db/pool.ts";
import { getBreachCrop } from "../db/repositories/breach_crop.get.ts";
import {
  type BreachEventRow,
  insertBreachEvent,
} from "../db/repositories/breach_event.insert.ts";
import {
  type BreachListRow,
  listBreachEvents,
} from "../db/repositories/breach_event.list.ts";
import type { Hub } from "../sse/hub.ts";
import { AppError } from "./errors.ts";

function toItem(
  r: Omit<BreachListRow, "hasCrop">,
  hasCrop: boolean,
): BreachItem {
  return {
    id: r.eventId,
    occurredAt: r.occurredAt.toISOString(),
    receivedAt: r.receivedAt.toISOString(),
    approach: r.approach,
    vehicleClass: r.vehicleClass,
    centroid: r.centroid,
    cropUrl: hasCrop ? `/api/breaches/${r.eventId}/crop` : null,
  };
}

/** Stores a breach once per id and emits one `breach` for a new row (the only `breach` emitter, AD-8). */
export async function recordBreach(
  { pool, hub }: { pool: Pool; hub: Hub },
  row: BreachEventRow,
): Promise<void> {
  if (!(await insertBreachEvent(pool, row))) return; // a redelivery
  hub.emit("breach", toItem(row, row.crop !== undefined));
}

// The opaque cursor: the last item's sort-key values, never a row reference.
const Cursor = z.tuple([isoUtc, uuid]);

function encodeCursor(r: BreachListRow): string {
  return Buffer.from(
    JSON.stringify([r.receivedAt.toISOString(), r.eventId]),
  ).toString("base64url");
}

function decodeCursor(cursor: string): { receivedAt: Date; eventId: string } {
  try {
    const [at, eventId] = Cursor.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString()),
    );
    return { receivedAt: new Date(at), eventId };
  } catch {
    throw new AppError("VALIDATION_FAILED", "cursor: invalid");
  }
}

/** `Page<BreachItem>`, newest first by `receivedAt`, ties by id. */
export async function listBreaches(
  pool: Pool,
  { limit, cursor }: ListQuery,
): Promise<Page<BreachItem>> {
  const after = cursor === undefined ? undefined : decodeCursor(cursor);
  const rows = await listBreachEvents(pool, limit + 1, after);
  const page = rows.slice(0, limit);
  return {
    items: page.map((r) => toItem(r, r.hasCrop)),
    nextCursor: rows.length > limit ? encodeCursor(page[limit - 1]) : null,
  };
}

/** The crop bytes; 404 NOT_FOUND when the breach or its crop is missing. */
export async function breachCrop(pool: Pool, id: string): Promise<Buffer> {
  const data = await getBreachCrop(pool, id);
  if (!data) throw new AppError("NOT_FOUND", "No crop for this breach");
  return data;
}
