import { resolveOverride } from "../../services/overrides.ts";
import type { HandlerFor } from "./index.ts";

export default {
  topic: "controller/override/ack",
  handle: (ack, ctx) =>
    resolveOverride(
      ctx,
      ack.commandId,
      ack.result,
      ack.result === "REJECTED" ? ack.reason : null,
      ctx.receivedAt,
    ),
} satisfies HandlerFor<"controller/override/ack">;
