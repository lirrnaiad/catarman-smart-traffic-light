import type {
  ControllerState,
  LinkSlice,
  OverrideCommand,
} from "@stl/contracts";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { resetDb } from "../../test/reset-db.ts";
import { config } from "../config.ts";
import { createPool } from "../db/pool.ts";
import { findOverride } from "../db/repositories/override_command.list.ts";
import { type JobCtx, jobs } from "../jobs/index.ts";
import overrideTimeouts from "../jobs/override-timeouts.ts";
import { dispatch } from "../mqtt/client.ts";
import { handlers } from "../mqtt/handlers/index.ts";
import type { Publisher } from "../mqtt/publisher.ts";
import { createHub, initialLink } from "../sse/hub.ts";
import { createLink } from "./link.ts";
import {
  requestOverride,
  resolveOverride,
  timeoutOverrides,
} from "./overrides.ts";

// Hits the real stl_test database (migrated by globalSetup).
const pool = createPool(config.DATABASE_URL);
const online: LinkSlice = {
  ...initialLink,
  broker: "CONNECTED",
  controller: { status: "ONLINE", source: "sim", bootCount: 0 },
};

function setup(controller: LinkSlice = online) {
  const hub = createHub({ validate: "throw" });
  const emit = vi.spyOn(hub, "emit");
  const publish = vi.fn<Publisher["publish"]>(async () => {});
  const deps = { pool, hub, publisher: { publish }, getLink: () => controller };
  return { deps, hub, emit, publish };
}

const sent = (emit: ReturnType<typeof setup>["emit"]) =>
  emit.mock.calls.map(([, cmd]) => cmd as OverrideCommand);
const emitted = (emit: ReturnType<typeof setup>["emit"]) =>
  sent(emit).map((cmd) => cmd.status);

async function insertRequested(commandId: string, requestedAt: Date) {
  await pool.query(
    `INSERT INTO override_command (command_id, mode, phase, status, requested_at)
     VALUES (?, 'CORRIDOR', 'NS', 'REQUESTED', ?)`,
    [commandId, requestedAt],
  );
}

/** One inbound MQTT message through the real dispatch and handler registry. */
async function deliver(
  deps: ReturnType<typeof setup>["deps"],
  topic: string,
  payload: unknown,
  retained = false,
) {
  await dispatch(
    `stl/${config.INTERSECTION_ID}/${topic}`,
    Buffer.from(JSON.stringify(payload)),
    retained,
    {
      ...deps,
      link: createLink(deps.hub),
      iid: config.INTERSECTION_ID,
      handlers,
    },
  );
}

const state = (commandId: string): ControllerState => ({
  v: 1,
  level: "L1",
  signals: { NS: "GREEN", EW: "RED" },
  flood: "DRY",
  fault: false,
  override: { mode: "CORRIDOR", phase: "NS", commandId },
});

beforeEach(() => resetDb(pool));
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await resetDb(pool);
  await pool.end();
});

describe("requestOverride", () => {
  it("applied: inserts REQUESTED, publishes, emits; the ack makes it APPLIED", async () => {
    const { deps, emit, publish } = setup();
    // The REQUESTED frame must already be out when the command is published.
    publish.mockImplementation(async (_t, p) => {
      expect(emit).toHaveBeenCalledWith(
        "override",
        expect.objectContaining({
          commandId: p.commandId,
          status: "REQUESTED",
        }),
      );
    });
    const cmd = await requestOverride(deps, { mode: "CORRIDOR", phase: "NS" });
    expect(cmd).toMatchObject({
      mode: "CORRIDOR",
      phase: "NS",
      status: "REQUESTED",
      reason: null,
      resolvedAt: null,
    });
    expect(await findOverride(pool, cmd.commandId)).toEqual(cmd);
    expect(publish).toHaveBeenCalledWith("controller/override/cmd", {
      v: 1,
      commandId: cmd.commandId,
      ts: Date.parse(cmd.requestedAt),
      mode: "CORRIDOR",
      phase: "NS",
    });
    expect(emit).toHaveBeenCalledWith("override", cmd);

    const at = Date.parse(cmd.requestedAt) + 400;
    vi.spyOn(Date, "now").mockReturnValue(at);
    await deliver(deps, "controller/override/ack", {
      v: 1,
      commandId: cmd.commandId,
      result: "APPLIED",
    });
    const row = await findOverride(pool, cmd.commandId);
    expect(row).toEqual({
      ...cmd,
      status: "APPLIED",
      resolvedAt: new Date(at).toISOString(),
    });
    expect(emit).toHaveBeenLastCalledWith("override", row);
  });

  it("publishes no phase for FLASHING_AMBER and stores phase null", async () => {
    const { deps, publish } = setup();
    const cmd = await requestOverride(deps, { mode: "FLASHING_AMBER" });
    expect(cmd.phase).toBeNull();
    expect(publish.mock.calls[0][1]).not.toHaveProperty("phase");
  });

  it.each(["STALE", "OFFLINE"] as const)(
    "controller %s: REJECTED CONTROLLER_OFFLINE, emitted, nothing published",
    async (status) => {
      vi.spyOn(console, "info").mockImplementation(() => {});
      const { deps, emit, publish } = setup({
        ...online,
        controller: { ...online.controller, status },
      });
      await expect(
        requestOverride(deps, { mode: "CORRIDOR", phase: "NS" }),
      ).rejects.toMatchObject({ code: "CONTROLLER_OFFLINE" });
      expect(publish).not.toHaveBeenCalled();
      const [cmd] = sent(emit);
      expect(cmd).toMatchObject({
        status: "REJECTED",
        reason: "CONTROLLER_OFFLINE",
      });
      expect(cmd.resolvedAt).toBe(cmd.requestedAt);
      expect(await findOverride(pool, cmd.commandId)).toEqual(cmd);
    },
  );

  it("publish fails: the row ends REJECTED CONTROLLER_OFFLINE", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { deps, emit, publish } = setup();
    publish.mockRejectedValue(new Error("[mqtt] not connected"));
    await expect(requestOverride(deps, { mode: "NONE" })).rejects.toMatchObject(
      { code: "CONTROLLER_OFFLINE" },
    );
    expect(emitted(emit)).toEqual(["REQUESTED", "REJECTED"]);
    const last = sent(emit).at(-1);
    expect(last).toMatchObject({
      status: "REJECTED",
      reason: "CONTROLLER_OFFLINE",
    });
    expect(last?.resolvedAt).not.toBeNull();
    expect(await findOverride(pool, last?.commandId ?? "")).toEqual(last);
  });

  it("bad body: a ZodError and no row", async () => {
    const { deps, emit } = setup();
    await expect(
      requestOverride(deps, { mode: "CORRIDOR" }),
    ).rejects.toMatchObject({ name: "ZodError" });
    const [rows] = await pool.query("SELECT * FROM override_command");
    expect(rows).toEqual([]);
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("resolution", () => {
  const id = "00000000-0000-4000-8000-0000000000a1";
  const T = Date.parse("2026-10-23T06:00:00.000Z");

  it("rejected: an ack REJECTED CONFLICT_FAULT gives REJECTED with that reason", async () => {
    const { deps, emit } = setup();
    await insertRequested(id, new Date(T));
    vi.spyOn(Date, "now").mockReturnValue(T + 300);
    await deliver(deps, "controller/override/ack", {
      v: 1,
      commandId: id,
      result: "REJECTED",
      reason: "CONFLICT_FAULT",
    });
    expect(await findOverride(pool, id)).toMatchObject({
      status: "REJECTED",
      reason: "CONFLICT_FAULT",
      resolvedAt: new Date(T + 300).toISOString(),
    });
    expect(emitted(emit)).toEqual(["REJECTED"]);
  });

  it.each([false, true])(
    "by state (retained %s): a matching override.commandId gives APPLIED",
    async (retained) => {
      const { deps, emit } = setup();
      await insertRequested(id, new Date(T));
      vi.spyOn(Date, "now").mockReturnValue(T + 900);
      await deliver(deps, "controller/state", state(id), retained);
      expect(await findOverride(pool, id)).toMatchObject({
        status: "APPLIED",
        resolvedAt: new Date(T + 900).toISOString(),
      });
      expect(emitted(emit)).toEqual(["APPLIED"]);
    },
  );

  it("late answer: an ack after TIMEOUT still gives APPLIED", async () => {
    const { deps, emit } = setup();
    await insertRequested(id, new Date(T));
    await timeoutOverrides(deps, T + 5_000);
    await resolveOverride(deps, id, "APPLIED", null, T + 8_000);
    expect(await findOverride(pool, id)).toMatchObject({
      status: "APPLIED",
      resolvedAt: new Date(T + 8_000).toISOString(),
    });
    expect(emitted(emit)).toEqual(["TIMEOUT", "APPLIED"]);
  });

  it("terminal: a second ack or state for an APPLIED row changes nothing and emits nothing", async () => {
    const { deps, emit } = setup();
    await insertRequested(id, new Date(T));
    await resolveOverride(deps, id, "APPLIED", null, T + 100);
    const applied = await findOverride(pool, id);
    emit.mockClear();
    await resolveOverride(deps, id, "REJECTED", "CONFLICT_FAULT", T + 200);
    await deliver(deps, "controller/state", state(id));
    expect(await findOverride(pool, id)).toEqual(applied);
    expect(emit).not.toHaveBeenCalled();
  });

  it("ignores unknown ids", async () => {
    const { deps, emit } = setup();
    await resolveOverride(deps, id, "APPLIED", null, T);
    await deliver(deps, "controller/state", state(id));
    expect(emit).not.toHaveBeenCalled();
  });
});

describe("timeouts", () => {
  const T = Date.parse("2026-10-23T06:00:00.000Z");
  const a = "00000000-0000-4000-8000-0000000000b1";
  const b = "00000000-0000-4000-8000-0000000000b2";

  it("turns a REQUESTED row TIMEOUT at 5 s, resolvedAt null, and emits once", async () => {
    const { deps, emit } = setup();
    await insertRequested(a, new Date(T));
    await timeoutOverrides(deps, T + 4_999);
    expect((await findOverride(pool, a))?.status).toBe("REQUESTED");
    await timeoutOverrides(deps, T + 5_000);
    await timeoutOverrides(deps, T + 6_000);
    expect(await findOverride(pool, a)).toMatchObject({
      status: "TIMEOUT",
      resolvedAt: null,
    });
    expect(emit.mock.calls).toEqual([
      ["override", await findOverride(pool, a)],
    ]);
  });

  it("boot: the job's first run at start marks a 10 s old REQUESTED row TIMEOUT", async () => {
    const { deps, emit } = setup();
    await insertRequested(a, new Date(Date.now() - 10_000));
    await insertRequested(b, new Date(Date.now()));
    await overrideTimeouts.start(deps as unknown as JobCtx);
    await overrideTimeouts.stop();
    expect((await findOverride(pool, a))?.status).toBe("TIMEOUT");
    expect((await findOverride(pool, b))?.status).toBe("REQUESTED");
    expect(emitted(emit)).toEqual(["TIMEOUT"]);
    expect(jobs).toContain(overrideTimeouts);
  });

  describe("job timer (fake setInterval and Date; the database is real)", () => {
    beforeEach(() =>
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] }),
    );
    afterEach(async () => {
      await overrideTimeouts.stop();
      vi.useRealTimers();
    });

    it("marks a fresh REQUESTED row TIMEOUT once 5 s have passed", async () => {
      const { deps } = setup();
      await overrideTimeouts.start(deps as unknown as JobCtx);
      await insertRequested(a, new Date(Date.now()));
      await vi.advanceTimersByTimeAsync(500);
      await overrideTimeouts.stop(); // waits for the tick's query
      expect((await findOverride(pool, a))?.status).toBe("REQUESTED");

      await overrideTimeouts.start(deps as unknown as JobCtx);
      vi.setSystemTime(Date.now() + 5_000);
      await vi.advanceTimersByTimeAsync(500);
      await overrideTimeouts.stop();
      expect((await findOverride(pool, a))?.status).toBe("TIMEOUT");
    });

    it("stop() during the first run creates no interval and waits for it", async () => {
      const { deps } = setup();
      await insertRequested(a, new Date(Date.now() - 10_000));
      const started = overrideTimeouts.start(deps as unknown as JobCtx);
      await overrideTimeouts.stop();
      expect((await findOverride(pool, a))?.status).toBe("TIMEOUT");
      await started;
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
