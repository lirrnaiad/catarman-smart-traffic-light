import { randomUUID } from "node:crypto";
import { BreachItem, Page } from "@stl/contracts";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { placeholder } from "../../../test/jpeg.ts";
import { resetDb } from "../../../test/reset-db.ts";
import { createApp } from "../../app.ts";
import { config } from "../../config.ts";
import { createPool } from "../../db/pool.ts";
import { insertBreachEvent } from "../../db/repositories/breach_event.insert.ts";
import { createHub, initialLink } from "../../sse/hub.ts";

// Real stl_test rows behind the real routes.
const pool = createPool(config.DATABASE_URL);
const app = createApp({
  pool,
  hub: createHub({ validate: "throw" }),
  publisher: { publish: async () => {} },
  getLink: () => initialLink,
});
const T0 = Date.parse("2026-10-23T06:00:00.000Z");

function store(id: string, receivedMs: number, withCrop = false) {
  return insertBreachEvent(pool, {
    eventId: id,
    approach: "N",
    vehicleClass: "car",
    centroid: { x: 0.1, y: 0.9 },
    // Older than received, so the list must order by receivedAt.
    occurredAt: new Date(T0 - 3 * 3_600_000 - receivedMs),
    receivedAt: new Date(T0 + receivedMs),
    crop: withCrop ? { mime: "image/jpeg", data: placeholder } : undefined,
  });
}

beforeEach(() => resetDb(pool));
afterAll(async () => {
  await resetDb(pool);
  await pool.end();
});

describe("GET /api/breaches", () => {
  it("pages newest first by receivedAt, ties by id, until nextCursor is null", async () => {
    const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()].sort();
    await store(a, 1000);
    await store(b, 1000, true); // ties with a; b > a, so b comes first
    await store(c, 2000);

    const first = await request(app).get("/api/breaches?limit=2");
    expect(first.status).toBe(200);
    const p1 = Page(BreachItem).parse(first.body);
    expect(p1.items.map((i) => i.id)).toEqual([c, b]);
    expect(p1.items[1].cropUrl).toBe(`/api/breaches/${b}/crop`);
    expect(p1.items[0].cropUrl).toBeNull();
    expect(p1.items[0]).not.toHaveProperty("data");
    expect(p1.items[0].occurredAt < p1.items[0].receivedAt).toBe(true);
    expect(p1.nextCursor).toEqual(expect.any(String));

    const second = await request(app).get(
      `/api/breaches?limit=2&cursor=${encodeURIComponent(p1.nextCursor ?? "")}`,
    );
    expect(second.status).toBe(200);
    expect(second.body.items.map((i: BreachItem) => i.id)).toEqual([a]);
    expect(second.body.nextCursor).toBeNull();
  });

  it("returns an empty page with no rows", async () => {
    const res = await request(app).get("/api/breaches");
    expect(res.body).toEqual({ items: [], nextCursor: null });
  });

  it.each(["xyz", Buffer.from('["nope","x"]').toString("base64url")])(
    "rejects the undecodable cursor %s with 400",
    async (cursor) => {
      const res = await request(app).get(`/api/breaches?cursor=${cursor}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    },
  );

  it("rejects an out-of-range limit with 400", async () => {
    const res = await request(app).get("/api/breaches?limit=0");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("GET /api/breaches/:id/crop", () => {
  it("serves the bytes as image/jpeg, no-store", async () => {
    const id = randomUUID();
    await store(id, 0, true);
    const res = await request(app).get(`/api/breaches/${id}/crop`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/jpeg");
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(Buffer.from(res.body).equals(placeholder)).toBe(true);
  });

  it("is 404 for a breach without a crop and for an unknown id", async () => {
    const id = randomUUID();
    await store(id, 0);
    for (const target of [id, randomUUID()]) {
      const res = await request(app).get(`/api/breaches/${target}/crop`);
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
  });

  it("is 400 for a non-UUID id", async () => {
    const res = await request(app).get("/api/breaches/not-a-uuid/crop");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });
});
