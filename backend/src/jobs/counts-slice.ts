import { refreshCounts } from "../services/counts.ts";
import type { Job } from "./index.ts";

const HOUR_MS = 3_600_000;

let timer: NodeJS.Timeout | undefined;
let pending: Promise<void> | undefined;
let running = false;

/** Seeds the `counts` slice at boot, then pushes the new Manila hour at each boundary (+50 ms). */
export default {
  async start(ctx) {
    running = true;
    await refreshCounts(ctx, new Date());
    const schedule = () => {
      if (!running) return;
      timer = setTimeout(
        async () => {
          pending = refreshCounts(ctx, new Date());
          await pending;
          pending = undefined;
          schedule();
        },
        HOUR_MS - (Date.now() % HOUR_MS) + 50,
      );
    };
    schedule();
  },
  async stop() {
    running = false;
    clearTimeout(timer);
    timer = undefined;
    await pending;
  },
} satisfies Job;
