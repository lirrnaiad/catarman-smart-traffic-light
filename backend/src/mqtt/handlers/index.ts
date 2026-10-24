import type { LinkSlice, TopicName, Topics } from "@stl/contracts";
import type { z } from "zod";
import type { Pool } from "../../db/pool.ts";
import type { Link } from "../../services/link.ts";
import type { Hub } from "../../sse/hub.ts";
import type { Publisher } from "../publisher.ts";
import controllerStateLink from "./controller-state.link.ts";
import controllerStateSlice from "./controller-state.slice.ts";
import controllerStatusLink from "./controller-status.link.ts";
import visionHeartbeatLink from "./vision-heartbeat.link.ts";
import visionStatusLink from "./vision-status.link.ts";

/** Core dependencies only (AD-16); `retained` is the message's retain flag. */
export type HandlerCtx = {
  receivedAt: number;
  retained: boolean;
  pool: Pool;
  hub: Hub;
  publisher: Publisher;
  link: Link;
  getLink: () => LinkSlice;
};

export type HandlerFor<T extends TopicName> = {
  topic: T;
  handle(
    payload: z.infer<Topics[T]["schema"]>,
    ctx: HandlerCtx,
  ): void | Promise<void>;
};

export type Handler = { [T in TopicName]: HandlerFor<T> }[TopicName];

/** Every MQTT handler; several may share a topic (fan-out). One line per file, alphabetical (AD-14). */
export const handlers: Handler[] = [
  controllerStateLink,
  controllerStateSlice,
  controllerStatusLink,
  visionHeartbeatLink,
  visionStatusLink,
];
