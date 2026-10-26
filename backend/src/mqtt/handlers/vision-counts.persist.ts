import { insertVehicleCounts } from "../../db/repositories/vehicle_count.insert.ts";
import { refreshCounts } from "../../services/counts.ts";
import { occurredAt } from "../../services/occurred-at.ts";
import type { HandlerFor } from "./index.ts";

/** Stores each crossing once per message id (AD-5); refreshes the slice only when rows were added. */
export default {
  topic: "vision/counts",
  async handle(payload, ctx) {
    const receivedAt = new Date(ctx.receivedAt);
    const at = occurredAt(payload.ts, receivedAt);
    let added: boolean;
    try {
      added = await insertVehicleCounts(
        ctx.pool,
        payload.crossings.map((c) => ({
          msgId: payload.id,
          approach: c.approach,
          vehicleClass: c.vehicleClass,
          count: c.count,
          occurredAt: at,
          receivedAt,
        })),
      );
    } catch (err) {
      console.error(
        `[mqtt] vision/counts ${payload.id} not stored:`,
        (err as Error).message,
      );
      return;
    }
    if (added) await refreshCounts(ctx, new Date());
  },
} satisfies HandlerFor<"vision/counts">;
