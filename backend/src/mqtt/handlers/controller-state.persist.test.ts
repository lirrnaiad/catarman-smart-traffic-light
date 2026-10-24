import type { ControllerState } from "@stl/contracts";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { resetDb } from "../../../test/reset-db.ts";
import { config } from "../../config.ts";
import { createPool } from "../../db/pool.ts";
import { insertStateChange } from "../../db/repositories/signal_state_change.insert.ts";
import { type JobCtx, jobs } from "../../jobs/index.ts";
import stateDedupPreload from "../../jobs/state-dedup-preload.ts";
import persist, { preloadStateDedup } from "./controller-state.persist.ts";
import { type HandlerCtx, handlers } from "./index.ts";

// Hits the real stl_test database (migrated by globalSetup).
const pool = createPool(config.DATABASE_URL);
const T = Date.parse("2026-10-24T06:00:00.000Z");
const CMD = "00000000-0000-4000-8000-0000000000c1";

const base: ControllerState = {
  v: 1,
  level: "L1",
  signals: { NS: "GREEN", EW: "RED" },
  flood: "DRY",
  fault: false,
};

const deliver = (state: ControllerState, receivedAt = T, retained = false) =>
  persist.handle(state, { pool, receivedAt, retained } as HandlerCtx);

async function rows() {
  const [r] = await pool.query(
    `SELECT level, signal_ns, signal_ew, flood, fault, override_mode,
            override_phase, override_command_id, received_at
     FROM signal_state_change ORDER BY id`,
  );
  return r as Array<Record<string, unknown>>;
}

beforeEach(async () => {
  await resetDb(pool);
  await preloadStateDedup(pool); // empty table: the first state always inserts
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await resetDb(pool);
  await pool.end();
});

describe("controller-state.persist", () => {
  it("is registered for controller/state, and its preload job runs at boot", () => {
    expect(handlers).toContain(persist);
    expect(persist.topic).toBe("controller/state");
    expect(jobs).toContain(stateDedupPreload);
  });

  it("first state: one row, absent override as three NULLs, received_at = receivedAt", async () => {
    await deliver({ ...base, remainingS: 9, power: "USB" });
    expect(await rows()).toEqual([
      {
        level: "L1",
        signal_ns: "GREEN",
        signal_ew: "RED",
        flood: "DRY",
        fault: 0,
        override_mode: null,
        override_phase: null,
        override_command_id: null,
        received_at: new Date(T),
      },
    ]);
  });

  it("republish: the same state, retained or not, with remainingS or power differing, adds no row", async () => {
    await deliver(base);
    await deliver({ ...base, remainingS: 3 }, T + 2_000, true);
    await deliver({ ...base, power: "BATTERY" }, T + 4_000);
    expect(await rows()).toHaveLength(1);
  });

  it.each<[string, Partial<ControllerState>]>([
    ["level", { level: "L2" }],
    ["signal_ns", { signals: { NS: "YELLOW", EW: "RED" } }],
    ["signal_ew", { signals: { NS: "GREEN", EW: "GREEN" } }],
    ["flood", { flood: "WET" }],
    ["fault", { fault: true }],
    ["override_mode", { override: { mode: "NONE" } }],
  ])("change: %s differing adds one row", async (_field, patch) => {
    await deliver(base);
    await deliver({ ...base, ...patch }, T + 1_000);
    const stored = await rows();
    expect(stored).toHaveLength(2);
    expect(stored[1].received_at).toEqual(new Date(T + 1_000));
  });

  it("change: override phase and commandId each count, and are stored", async () => {
    const corridor = (phase: "NS" | "EW", commandId: string) => ({
      ...base,
      override: { mode: "CORRIDOR" as const, phase, commandId },
    });
    await deliver(corridor("NS", CMD));
    await deliver(corridor("EW", CMD), T + 1);
    await deliver(corridor("EW", CMD.replace("c1", "c2")), T + 2);
    await deliver(corridor("EW", CMD.replace("c1", "c2")), T + 3);
    const stored = await rows();
    expect(
      stored.map((r) => [r.override_phase, r.override_command_id]),
    ).toEqual([
      ["NS", CMD],
      ["EW", CMD],
      ["EW", CMD.replace("c1", "c2")],
    ]);
  });

  it("restart: after the preload job reads row X, a state equal to X adds no row", async () => {
    const x: ControllerState = {
      ...base,
      level: "L4",
      flood: "FLOODED",
      override: { mode: "CORRIDOR", phase: "NS", commandId: CMD },
    };
    // Row X from before the restart; the memory still says "empty table".
    await insertStateChange(
      pool,
      { ...x, override: x.override ?? null },
      new Date(T),
    );
    await stateDedupPreload.start({ pool } as JobCtx);
    await deliver(x, T + 5_000, true);
    expect(await rows()).toHaveLength(1);

    // A boot-time NONE without commandId round-trips too.
    const none: ControllerState = { ...base, override: { mode: "NONE" } };
    await insertStateChange(
      pool,
      { ...none, override: { mode: "NONE" } },
      new Date(T + 6_000),
    );
    await stateDedupPreload.start({ pool } as JobCtx);
    await deliver(none, T + 7_000);
    expect(await rows()).toHaveLength(2);
  });

  it("restart: the preload takes the last inserted row even if the clock stepped back", async () => {
    const y: ControllerState = { ...base, level: "L2" };
    await insertStateChange(pool, { ...base, override: null }, new Date(T));
    await insertStateChange(
      pool,
      { ...y, override: null },
      new Date(T - 60_000),
    );
    await stateDedupPreload.start({ pool } as JobCtx);
    await deliver(y, T + 1_000);
    expect(await rows()).toHaveLength(2);
  });

  it("unloaded memory: the handler loads the latest row itself before comparing", async () => {
    // A fresh module copy whose memory was never preloaded.
    vi.resetModules();
    const fresh = (await import("./controller-state.persist.ts")).default;
    await insertStateChange(pool, { ...base, override: null }, new Date(T));
    await fresh.handle(base, {
      pool,
      receivedAt: T + 1_000,
      retained: true,
    } as HandlerCtx);
    expect(await rows()).toHaveLength(1);
  });

  it("burst: concurrent different states give 2 rows, a concurrent repeat of the latest gives none", async () => {
    const b: ControllerState = {
      ...base,
      signals: { NS: "YELLOW", EW: "RED" },
    };
    await Promise.all([deliver(base), deliver(b, T + 1), deliver(b, T + 2)]);
    expect(await rows()).toHaveLength(2);
    await Promise.all([deliver(b, T + 3), deliver(b, T + 4)]);
    expect(await rows()).toHaveLength(2);
  });

  it("insert fails: logged, not thrown, and the next identical state inserts", async () => {
    await deliver(base);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const b: ControllerState = { ...base, level: "L3" };
    vi.spyOn(pool, "query").mockRejectedValueOnce(new Error("db down"));
    await expect(deliver(b, T + 1)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "[mqtt] state change not stored:",
      expect.any(Error),
    );
    expect(await rows()).toHaveLength(1);
    await deliver(b, T + 2);
    const stored = await rows();
    expect(stored).toHaveLength(2);
    expect(stored[1]).toMatchObject({
      level: "L3",
      received_at: new Date(T + 2),
    });
  });

  it("preload failure is logged by the job, never thrown", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(pool, "query").mockRejectedValueOnce(new Error("db down"));
    await expect(
      stateDedupPreload.start({ pool } as JobCtx),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      "[job] state dedup preload failed:",
      expect.any(Error),
    );
  });
});
