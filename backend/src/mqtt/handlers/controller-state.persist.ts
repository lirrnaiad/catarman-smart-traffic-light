import type { Pool } from "../../db/pool.ts";
import { insertStateChange } from "../../db/repositories/signal_state_change.insert.ts";
import { latestStateChange } from "../../db/repositories/signal_state_change.latest.ts";
import type { StoredState } from "../../db/repositories/signal_state_change.list.ts";
import type { HandlerFor } from "./index.ts";

/** The dedup memory: undefined = not loaded, null = empty table, else the last persisted key. */
let last: string | null | undefined;

const keyOf = ({ level, signals, flood, fault, override: o }: StoredState) =>
  JSON.stringify([
    level,
    signals.NS,
    signals.EW,
    flood,
    fault,
    o?.mode ?? null,
    o?.mode === "CORRIDOR" ? o.phase : null,
    o?.commandId ?? null,
  ]);

async function loadKey(pool: Pool): Promise<string | null> {
  const latest = await latestStateChange(pool);
  return latest ? keyOf(latest) : null;
}

/** Fills the dedup memory from the latest row; the preload job calls it before handlers register. */
export async function preloadStateDedup(pool: Pool): Promise<void> {
  last = await loadKey(pool);
}

/** Stores a `controller/state` only when one of the eight fields changed (AD-5). Never throws. */
export default {
  topic: "controller/state",
  handle: async (payload, { pool, receivedAt }) => {
    try {
      if (last === undefined) {
        // The boot order prevents this; a message that beats the preload loads it itself.
        const loaded = await loadKey(pool);
        if (last === undefined) last = loaded;
      }
      const state: StoredState = {
        level: payload.level,
        signals: payload.signals,
        flood: payload.flood,
        fault: payload.fault,
        override: payload.override ?? null,
      };
      const key = keyOf(state);
      // Compared and updated before any await: messages are dispatched concurrently.
      if (key === last) return;
      const prev = last;
      last = key;
      try {
        await insertStateChange(pool, state, new Date(receivedAt));
      } catch (err) {
        if (last === key) last = prev; // so the next identical state retries
        throw err;
      }
    } catch (err) {
      console.error("[mqtt] state change not stored:", err);
    }
  },
} satisfies HandlerFor<"controller/state">;
