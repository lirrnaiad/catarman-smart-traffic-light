import { z } from "zod";
import { vehicleClassId } from "../scalars.ts";

export const ErrorCode = z.enum([
  "VALIDATION_FAILED",
  "NOT_FOUND",
  "CONTROLLER_OFFLINE",
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** Every error response: 400 VALIDATION_FAILED, 404 NOT_FOUND, 409 CONTROLLER_OFFLINE, 500 INTERNAL. */
export const ApiError = z.object({
  error: z.object({ code: ErrorCode, message: z.string() }),
});
export type ApiError = z.infer<typeof ApiError>;

/**
 * List query string: `limit` 1 to 200 (default 50), coerced from the query
 * string; `cursor` is opaque and encodes the last item's sort-key values.
 */
export const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});
export type ListQuery = z.infer<typeof ListQuery>;

/** A list response, newest first. `nextCursor` is null on the last page. */
export const Page = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });
export type Page<T> = { items: T[]; nextCursor: string | null };

export const Health = z.object({
  ok: z.boolean(),
  db: z.boolean(),
  broker: z.boolean(),
});
export type Health = z.infer<typeof Health>;

/** One row of `contracts/vehicle-classes.json` (AD-12). */
export const VehicleClass = z.object({
  id: vehicleClassId,
  label: z.string().min(1),
  pcu: z.number().positive(),
});
export type VehicleClass = z.infer<typeof VehicleClass>;
