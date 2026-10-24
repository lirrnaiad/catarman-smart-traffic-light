import type { StateOverride } from "@stl/contracts";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb } from "../../../test/reset-db.ts";
import { createApp } from "../../app.ts";
import { config } from "../../config.ts";
import { createPool } from "../../db/pool.ts";
import { insertStateChange } from "../../db/repositories/signal_state_change.insert.ts";
import type { Publisher } from "../../mqtt/publisher.ts";
import { createHub, initialLink } from "../../sse/hub.ts";

// Real stl_test pool; fake publisher and a validating hub.
const pool = createPool(config.DATABASE_URL);
const app = createApp({
  pool,
  hub: createHub({ validate: "throw" }),
  publisher: { publish: vi.fn<Publisher["publish"]>(async () => {}) },
  getLink: () => initialLink,
});

const A = "00000000-0000-4000-8000-0000000000a1"; // a CORRIDOR command
const R = "00000000-0000-4000-8000-0000000000a2"; // a release (NONE) command
const M = "00000000-0000-4000-8000-0000000000a3"; // missing from override_command

async function insertCommand(commandId: string, mode: string) {
  await pool.query(
    `INSERT INTO override_command (command_id, mode, phase, status, requested_at)
     VALUES (?, ?, ?, 'APPLIED', ?)`,
    [commandId, mode, mode === "CORRIDOR" ? "NS" : null, new Date()],
  );
}

const at = (s: number) =>
  new Date(Date.parse("2026-10-24T06:00:00.000Z") + s * 1000);

function insertState(s: number, override: StateOverride | null) {
  return insertStateChange(
    pool,
    {
      level: "L4",
      signals: { NS: "FLASHING_AMBER", EW: "FLASHING_AMBER" },
      flood: "FLOODED",
      fault: false,
      override,
    },
    at(s),
  );
}

beforeEach(() => resetDb(pool));
afterAll(async () => {
  await resetDb(pool);
  await pool.end();
});

describe("GET /api/state-changes", () => {
  it("maps rows and computes overrideEnded with the override_command rows", async () => {
    await insertCommand(A, "CORRIDOR");
    await insertCommand(R, "NONE");
    await insertState(1, null);
    await insertState(2, { mode: "NONE" });
    await insertState(3, { mode: "CORRIDOR", phase: "NS", commandId: A });
    await insertState(4, { mode: "NONE", commandId: A });
    await insertState(5, { mode: "NONE", commandId: R });
    await insertState(6, { mode: "NONE", commandId: M });

    const res = await request(app).get("/api/state-changes");
    expect(res.status).toBe(200);
    expect(res.body.nextCursor).toBeNull();
    expect(res.body.items[0]).toEqual({
      receivedAt: at(6).toISOString(),
      level: "L4",
      signals: { NS: "FLASHING_AMBER", EW: "FLASHING_AMBER" },
      flood: "FLOODED",
      fault: false,
      override: { mode: "NONE", commandId: M },
      overrideEnded: true,
    });
    expect(
      res.body.items.map((i: { override: unknown; overrideEnded: boolean }) => [
        i.override,
        i.overrideEnded,
      ]),
    ).toEqual([
      [{ mode: "NONE", commandId: M }, true], // missing id: ended
      [{ mode: "NONE", commandId: R }, false], // release
      [{ mode: "NONE", commandId: A }, true], // corridor ended on its own
      [{ mode: "CORRIDOR", phase: "NS", commandId: A }, false],
      [{ mode: "NONE" }, false], // boot NONE
      [null, false], // no override
    ]);
  });

  it("pages newest first; the cursor gives the rest and nextCursor null", async () => {
    for (const s of [1, 2, 3]) await insertState(s, null);
    const first = await request(app).get("/api/state-changes?limit=2");
    expect(
      first.body.items.map((i: { receivedAt: string }) => i.receivedAt),
    ).toEqual([at(3).toISOString(), at(2).toISOString()]);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    expect(first.body.items[0]).not.toHaveProperty("id");

    const next = await request(app).get(
      `/api/state-changes?limit=2&cursor=${first.body.nextCursor}`,
    );
    expect(
      next.body.items.map((i: { receivedAt: string }) => i.receivedAt),
    ).toEqual([at(1).toISOString()]);
    expect(next.body.nextCursor).toBeNull();
  });

  it("returns an empty page", async () => {
    const res = await request(app).get("/api/state-changes");
    expect(res.body).toEqual({ items: [], nextCursor: null });
  });

  it.each([
    "limit=0",
    "limit=201",
    "cursor=nope",
    `cursor=${Buffer.from('["x"]').toString("base64url")}`,
  ])("answers 400 VALIDATION_FAILED for %s", async (qs) => {
    const res = await request(app).get(`/api/state-changes?${qs}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });
});
