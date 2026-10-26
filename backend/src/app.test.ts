import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import vehicleClasses from "@stl/contracts/vehicle-classes.json" with {
  type: "json",
};
import express from "express";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { z } from "zod";
import { type AppDeps, createApp, dashboardOut } from "./app.ts";
import type { Pool } from "./db/pool.ts";
import { errorMiddleware } from "./http/error-middleware.ts";
import type { Publisher } from "./mqtt/publisher.ts";
import { AppError } from "./services/errors.ts";
import { createHub, initialLink } from "./sse/hub.ts";

const upPool = { query: async () => [[], []] } as unknown as Pool;
const downPool = {
  query: async () => {
    throw new Error("ECONNREFUSED");
  },
} as unknown as Pool;

const publisher: Publisher = { publish: async () => {} };

function deps(pool: Pool = upPool, broker = initialLink.broker): AppDeps {
  return {
    pool,
    hub: createHub({ validate: "throw" }),
    publisher,
    getLink: () => ({ ...initialLink, broker }),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("GET /api/health", () => {
  it("reports ok when the database answers and the broker is connected", async () => {
    const res = await request(createApp(deps(upPool, "CONNECTED"))).get(
      "/api/health",
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, db: true, broker: true });
  });

  it("reports broker false and not ok while the broker is disconnected", async () => {
    const res = await request(createApp(deps())).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, db: true, broker: false });
  });

  it("reports db false, never 500, when the database is down", async () => {
    const res = await request(createApp(deps(downPool))).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, db: false, broker: false });
  });
});

describe("GET /api/vehicle-classes", () => {
  it("returns the five classes in file order", async () => {
    const res = await request(createApp(deps())).get("/api/vehicle-classes");
    expect(res.status).toBe(200);
    expect(res.body).toEqual(vehicleClasses);
    expect(res.body.map((c: { id: string }) => c.id)).toEqual([
      "car",
      "tricycle",
      "motorcycle",
      "jeepney",
      "utility_van",
    ]);
  });
});

describe("GET /api/stream", () => {
  it("sends SSE headers and the connect sequence", async () => {
    const d = deps();
    const hub = d.hub;
    // End the stream right after the connect sequence so the request completes.
    const app = createApp({
      ...d,
      hub: {
        ...hub,
        attach: (res) => {
          hub.attach(res);
          hub.close();
        },
      },
    });
    const res = await request(app).get("/api/stream");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^text\/event-stream/);
    expect(res.headers["cache-control"]).toBe("no-cache");
    expect(res.text).toBe(
      "retry: 2000\n\n" +
        `event: link\ndata: ${JSON.stringify(initialLink)}\n\n` +
        "event: state\ndata: null\n\n" +
        "event: counts\ndata: null\n\n" +
        "event: demand\ndata: null\n\n",
    );
  });
});

describe("errors", () => {
  it("returns 404 NOT_FOUND for an unknown API path", async () => {
    const res = await request(createApp(deps())).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 VALIDATION_FAILED for a malformed JSON body", async () => {
    const res = await request(createApp(deps()))
      .post("/api/nope")
      .set("Content-Type", "application/json")
      .send("{bad");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("returns 400 VALIDATION_FAILED for an oversized JSON body", async () => {
    const res = await request(createApp(deps()))
      .post("/api/nope")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ pad: "x".repeat(200_000) }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });

  const app = express()
    .get("/app-error", () => {
      throw new AppError("CONTROLLER_OFFLINE", "controller offline");
    })
    .get("/zod-error", () => {
      z.object({ limit: z.number() }).parse({});
    })
    .get("/other", () => {
      throw new Error("boom");
    })
    .use(errorMiddleware);

  it("maps AppError to its status", async () => {
    const res = await request(app).get("/app-error");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: "CONTROLLER_OFFLINE", message: "controller offline" },
    });
  });

  it("maps ZodError to 400 VALIDATION_FAILED", async () => {
    const res = await request(app).get("/zod-error");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.message).toContain("limit");
  });

  it("maps anything else to 500 INTERNAL and logs [http] with the stack", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(app).get("/other");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: "INTERNAL", message: "Internal server error" },
    });
    expect(error.mock.calls[0][0]).toMatch(/^\[http\]/);
    expect((error.mock.calls[0][1] as Error).stack).toContain("boom");
  });
});

describe("static dashboard", () => {
  const html = "<!doctype html><title>stl test</title>";
  let dir: string;

  // A file at api/nope proves the API 404 is mounted before the static files.
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "stl-static-"));
    writeFileSync(join(dir, "index.html"), html);
    mkdirSync(join(dir, "api"));
    writeFileSync(join(dir, "api", "nope"), "static file, not the API");
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("serves index.html at /", async () => {
    const res = await request(createApp(deps(), dir)).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^text\/html/);
    expect(res.text).toBe(html);
  });

  it("still answers /api/nope with the JSON 404, not the static file", async () => {
    const res = await request(createApp(deps(), dir)).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("defaults to <repo>/dashboard/out/", () => {
    expect(dashboardOut.endsWith(`${sep}dashboard${sep}out${sep}`)).toBe(true);
    const pkg = (path: string) => JSON.parse(readFileSync(path, "utf8")).name;
    expect(pkg(join(dashboardOut, "..", "package.json"))).toBe(
      "@stl/dashboard",
    );
    expect(pkg(join(dashboardOut, "..", "..", "package.json"))).toBe(
      "smart-traffic-light",
    );
  });
});

describe("CORS", () => {
  const origin = "http://localhost:3000";

  it("echoes an allow-listed origin", async () => {
    const res = await request(createApp(deps()))
      .get("/api/health")
      .set("Origin", origin);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
  });

  it("answers an allow-listed preflight with 204", async () => {
    const res = await request(createApp(deps()))
      .options("/api/overrides")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "POST");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(origin);
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
    expect(res.headers["access-control-allow-headers"]).toMatch(
      /content-type/i,
    );
  });

  it("sends no CORS headers for other origins", async () => {
    const res = await request(createApp(deps()))
      .get("/api/health")
      .set("Origin", "http://evil.example");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
