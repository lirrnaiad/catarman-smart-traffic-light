import type { HandlerFor } from "./index.ts";

export default {
  topic: "controller/status",
  handle: (payload, { link, retained }) =>
    link.onStatus("controller", payload, retained),
} satisfies HandlerFor<"controller/status">;
