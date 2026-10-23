import type { Pool } from "../db/pool.ts";
import type { Hub } from "../sse/hub.ts";

/** Core dependencies only (AD-16); entry 3 adds `publisher` and `getLink`. */
export type JobCtx = { pool: Pool; hub: Hub };

export type Job = {
  start(ctx: JobCtx): void | Promise<void>;
  stop(): void | Promise<void>;
};

/** Every startup task or timer. One line per file, alphabetical (AD-14). */
export const jobs: Job[] = [];
