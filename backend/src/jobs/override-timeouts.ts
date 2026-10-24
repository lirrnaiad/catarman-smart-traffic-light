import { timeoutOverrides } from "../services/overrides.ts";
import type { Job, JobCtx } from "./index.ts";

let timer: NodeJS.Timeout | undefined;
let inFlight: Promise<void> | undefined;
let stopped = false;

async function tick(ctx: JobCtx): Promise<void> {
  try {
    await timeoutOverrides(ctx, Date.now());
  } catch (err) {
    console.error("[job] override timeouts failed:", err);
  }
}

function run(ctx: JobCtx): Promise<void> {
  // A slow database must not stack runs.
  inFlight ??= tick(ctx).finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}

/** REQUESTED → TIMEOUT after 5 s, checked every 500 ms; the first run at start covers rows from before a restart (AD-7). */
export default {
  async start(ctx) {
    stopped = false;
    await run(ctx);
    if (stopped) return;
    timer = setInterval(() => void run(ctx), 500);
  },
  async stop() {
    stopped = true;
    clearInterval(timer);
    timer = undefined;
    await inFlight; // never let shutdown close the pool under a running query
  },
} satisfies Job;
