import { OverrideCommand } from "@stl/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiRequestError, apiGet, apiList, apiPost, apiUrl } from "./client.ts";

function respond(status: number, body: string) {
  const fetchMock = vi.fn(async () => new Response(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("apiUrl", () => {
  it("is same-origin with an empty base", () => {
    expect(apiUrl("/api/breaches/x/crop")).toBe("/api/breaches/x/crop");
  });

  it("prefixes the configured base", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:4000");
    vi.resetModules();
    const client = await import("./client.ts");
    expect(client.apiUrl("/api/breaches/x/crop")).toBe(
      "http://127.0.0.1:4000/api/breaches/x/crop",
    );
  });
});

describe("errors", () => {
  it("carries the ApiError code", async () => {
    respond(
      409,
      JSON.stringify({
        error: { code: "CONTROLLER_OFFLINE", message: "Controller offline" },
      }),
    );
    const err = await apiPost(
      "/api/overrides",
      { mode: "NONE" },
      OverrideCommand,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({
      code: "CONTROLLER_OFFLINE",
      message: "Controller offline",
      status: 409,
    });
  });

  it("is INTERNAL when the body is not an ApiError", async () => {
    respond(500, "<html>oops</html>");
    await expect(apiGet("/api/health", z.object({}))).rejects.toMatchObject({
      code: "INTERNAL",
      status: 500,
    });
  });

  it("is INTERNAL when a 2xx body fails its schema", async () => {
    respond(200, JSON.stringify({ ok: "yes" }));
    await expect(
      apiGet("/api/health", z.object({ ok: z.boolean() })),
    ).rejects.toMatchObject({
      code: "INTERNAL",
      message: expect.stringContaining("ok"),
    });
  });

  it("is INTERNAL with status 0 when fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const err = await apiGet("/api/health", z.object({})).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ code: "INTERNAL", status: 0 });
  });
});

describe("requests", () => {
  it("apiPost sends JSON and parses the response", async () => {
    const fetchMock = respond(200, JSON.stringify({ ok: true }));
    await expect(
      apiPost("/api/x", { mode: "NONE" }, z.object({ ok: z.boolean() })),
    ).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"mode":"NONE"}',
    });
  });

  it("apiList adds limit and cursor and parses a Page", async () => {
    const fetchMock = respond(
      200,
      JSON.stringify({ items: [1, 2], nextCursor: null }),
    );
    await expect(
      apiList("/api/breaches", z.number(), { limit: 1, cursor: "abc" }),
    ).resolves.toEqual({ items: [1, 2], nextCursor: null });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/breaches?limit=1&cursor=abc",
      undefined,
    );
  });

  it("apiList appends to a path that already has a query", async () => {
    const fetchMock = respond(
      200,
      JSON.stringify({ items: [], nextCursor: null }),
    );
    await apiList("/api/breaches?approach=N", z.number(), { limit: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/breaches?approach=N&limit=1",
      undefined,
    );
  });
});
