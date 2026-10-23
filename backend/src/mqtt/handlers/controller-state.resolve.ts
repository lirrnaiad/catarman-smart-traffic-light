import { resolveOverride } from "../../services/overrides.ts";
import type { HandlerFor } from "./index.ts";

/** A state reporting the command's id means it was applied, retained or not (AD-7 rule 5). */
export default {
  topic: "controller/state",
  handle: async ({ override }, ctx) => {
    if (override?.commandId === undefined) return;
    await resolveOverride(
      ctx,
      override.commandId,
      "APPLIED",
      null,
      ctx.receivedAt,
    );
  },
} satisfies HandlerFor<"controller/state">;
