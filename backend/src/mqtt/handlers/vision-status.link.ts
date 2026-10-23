import type { HandlerFor } from "./index.ts";

export default {
  topic: "vision/status",
  handle: (payload, { link, retained }) =>
    link.onStatus("vision", payload, retained),
} satisfies HandlerFor<"vision/status">;
