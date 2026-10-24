import type { LinkSlice } from "@stl/contracts";
import type { Pool } from "../db/pool.ts";
import type { Publisher } from "../mqtt/publisher.ts";
import type { Link } from "../services/link.ts";
import type { Hub } from "../sse/hub.ts";
import linkWatchdog from "./link-watchdog.ts";
import overrideTimeouts from "./override-timeouts.ts";
import stateDedupPreload from "./state-dedup-preload.ts";

/** Core dependencies only (AD-16). `link` is for the link watchdog; CAP jobs read `getLink`. */
export type JobCtx = {
  pool: Pool;
  hub: Hub;
  publisher: Publisher;
  link: Link;
  getLink: () => LinkSlice;
};

export type Job = {
  start(ctx: JobCtx): void | Promise<void>;
  stop(): void | Promise<void>;
};

/** Every startup task or timer. One line per file, alphabetical (AD-14). */
export const jobs: Job[] = [linkWatchdog, overrideTimeouts, stateDedupPreload];
