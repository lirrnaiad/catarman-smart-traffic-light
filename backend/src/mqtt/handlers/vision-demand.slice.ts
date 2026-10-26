import { writeDemand } from "../../services/demand.ts";
import type { HandlerFor } from "./index.ts";

export default {
  topic: "vision/demand",
  handle: (payload, { hub, receivedAt }) =>
    writeDemand(hub, payload.pcu, receivedAt),
} satisfies HandlerFor<"vision/demand">;
