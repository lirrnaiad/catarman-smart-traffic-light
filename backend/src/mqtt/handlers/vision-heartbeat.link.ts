import type { HandlerFor } from "./index.ts";

export default {
  topic: "vision/heartbeat",
  handle: (_payload, { link, receivedAt, retained }) =>
    link.onFresh("vision", receivedAt, retained),
} satisfies HandlerFor<"vision/heartbeat">;
