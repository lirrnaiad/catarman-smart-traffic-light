import { writeState } from "../../services/state.ts";
import type { HandlerFor } from "./index.ts";

export default {
  topic: "controller/state",
  handle: (payload, { hub, receivedAt, retained }) =>
    writeState(hub, payload, receivedAt, retained),
} satisfies HandlerFor<"controller/state">;
