import type { LinkSlice } from "@stl/contracts";
import request from "supertest";
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
import { createApp } from "../../app.ts";
import { config } from "../../config.ts";
import { createPool } from "../../db/pool.ts";
import type { Publisher } from "../../mqtt/publisher.ts";
import { createHub, initialLink } from "../../sse/hub.ts";

// Real stl_test pool; fake publisher and a validating hub.
const pool = createPool(config.DATABASE_URL);
const online: LinkSlice = {
  ...initialLink,
  broker: "CONNECTED",
  controller: { status: "ONLINE", source: "sim", bootCount: 0 },
};

function app(link: LinkSlice = online) {
  const hub = createHub({ validate: "throw" });
  const emit = vi.spyOn(hub, "emit");
  const publish = vi.fn<Publisher["publish"]>(async () => {});
  return {
    app: createApp({ pool, hub, publisher: { publish }, getLink: () => link }),
    emit,
    publish,
  };
}

beforeEach(() => resetDb(pool));
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await resetDb(pool);
  await pool.end();
});

describe("POST /api/overrides", () => {
  it("answers 202 with the REQUESTED command and publishes it", async () => {
    const { app: a, emit, publish } = app();
    const res = await request(a)
      .post("/api/overrides")
      .send({ mode: "CORRIDOR", phase: "NS" });
    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({
      mode: "CORRIDOR",
      phase: "NS",
      status: "REQUESTED",
    });
    expect(publish).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith("override", res.body);
  });

  it("answers 409 CONTROLLER_OFFLINE while the controller is not ONLINE", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { app: a, publish } = app({
      ...online,
      controller: { ...online.controller, status: "STALE" },
    });
    const res = await request(a)
      .post("/api/overrides")
      .send({ mode: "FLASHING_AMBER" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONTROLLER_OFFLINE");
    expect(publish).not.toHaveBeenCalled();
  });

  it("answers 409 when the publish throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { app: a, publish } = app();
    publish.mockRejectedValue(new Error("not connected"));
    const res = await request(a).post("/api/overrides").send({ mode: "NONE" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONTROLLER_OFFLINE");
  });

  it("answers 400 VALIDATION_FAILED for CORRIDOR without phase, and stores nothing", async () => {
    const { app: a, publish } = app();
    const res = await request(a)
      .post("/api/overrides")
      .send({ mode: "CORRIDOR" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(publish).not.toHaveBeenCalled();
    const [rows] = await pool.query("SELECT * FROM override_command");
    expect(rows).toEqual([]);
  });
});

describe("GET /api/overrides", () => {
  const ids = [
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
    "00000000-0000-4000-8000-000000000003",
  ];

  beforeEach(async () => {
    // Two rows share a requested_at, so command_id breaks the tie.
    const at = [
      "2026-10-23T06:00:00.000Z",
      "2026-10-23T06:00:01.000Z",
      "2026-10-23T06:00:01.000Z",
    ];
    for (const [i, id] of ids.entries()) {
      await pool.query(
        `INSERT INTO override_command (command_id, mode, status, requested_at)
         VALUES (?, 'NONE', 'APPLIED', ?)`,
        [id, new Date(at[i])],
      );
    }
  });

  it("pages newest first by requestedAt, then commandId, descending", async () => {
    const { app: a } = app();
    const first = await request(a).get("/api/overrides?limit=2");
    expect(first.status).toBe(200);
    expect(
      first.body.items.map((c: { commandId: string }) => c.commandId),
    ).toEqual([ids[2], ids[1]]);
    expect(first.body.items[0]).toEqual({
      commandId: ids[2],
      mode: "NONE",
      phase: null,
      status: "APPLIED",
      reason: null,
      requestedAt: "2026-10-23T06:00:01.000Z",
      resolvedAt: null,
    });
    expect(first.body.nextCursor).toEqual(expect.any(String));

    const next = await request(a).get(
      `/api/overrides?limit=2&cursor=${first.body.nextCursor}`,
    );
    expect(
      next.body.items.map((c: { commandId: string }) => c.commandId),
    ).toEqual([ids[0]]);
    expect(next.body.nextCursor).toBeNull();
  });

  it("defaults to 50 and returns nextCursor null when everything fits", async () => {
    const res = await request(app().app).get("/api/overrides");
    expect(res.body.items).toHaveLength(3);
    expect(res.body.nextCursor).toBeNull();
  });

  it.each([
    "limit=0",
    "limit=201",
    "cursor=nope",
    `cursor=${Buffer.from('["x","y"]').toString("base64url")}`,
  ])("answers 400 VALIDATION_FAILED for %s", async (qs) => {
    const res = await request(app().app).get(`/api/overrides?${qs}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });
});
