import { z } from "zod";

/** Integer epoch milliseconds (AD-4). Rejects epoch seconds. */
export const epochMs = z.number().int().min(1.6e12).max(4.1e12);

/** A publisher-minted UUID (Public ids convention). */
export const uuid = z.uuid();

/** An ISO-8601 UTC string ending in `Z` (AD-6). */
export const isoUtc = z.iso.datetime();

/** A lower snake_case vehicle-class id (AD-12). Unknown ids that match are accepted. */
export const vehicleClassId = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/);

/**
 * An UPPER_SNAKE rejection code (AD-7). Known: CONTROLLER_OFFLINE (backend) and
 * CONFLICT_FAULT (controller). Deliberately not an enum, so new codes parse.
 */
export const rejectionReason = z.string().regex(/^[A-Z][A-Z0-9_]{0,31}$/);
