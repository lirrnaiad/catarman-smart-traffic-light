import { preloadStateDedup } from "../mqtt/handlers/controller-state.persist.ts";
import type { Job } from "./index.ts";

/** Loads the latest stored state into the dedup memory before handlers register (AD-5). */
export default {
  async start({ pool }) {
    try {
      await preloadStateDedup(pool);
    } catch (err) {
      // The handler then loads the memory itself on its first message.
      console.error("[job] state dedup preload failed:", err);
    }
  },
  stop() {},
} satisfies Job;
