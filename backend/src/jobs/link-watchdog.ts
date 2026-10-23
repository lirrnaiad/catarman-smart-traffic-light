import type { Job } from "./index.ts";

let timer: NodeJS.Timeout | undefined;

/** Turns a silent role STALE: 5 s controller, 3 s vision (AD-5). */
export default {
  start({ link }) {
    timer = setInterval(() => link.tick(Date.now()), 500);
  },
  stop() {
    clearInterval(timer);
    timer = undefined;
  },
} satisfies Job;
