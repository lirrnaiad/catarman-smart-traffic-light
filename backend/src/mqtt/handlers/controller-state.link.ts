import type { HandlerFor } from "./index.ts";

export default {
  topic: "controller/state",
  handle: (_payload, { link, receivedAt, retained }) =>
    link.onFresh("controller", receivedAt, retained),
} satisfies HandlerFor<"controller/state">;
