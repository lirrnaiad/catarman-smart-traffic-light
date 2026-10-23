import { afterEach, expect, it, vi } from "vitest";
import { ApiRequestError } from "./client.ts";
import { listOverrides, postOverride } from "./overrides.ts";

const cmd = {
  commandId: "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60",
  mode: "CORRIDOR",
  phase: "NS",
  status: "REQUESTED",
  reason: null,
  requestedAt: "2026-10-23T06:32:08.000Z",
  resolvedAt: null,
};

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

it("postOverride sends the request and returns the OverrideCommand", async () => {
  const fetchMock = respond(202, cmd);
  expect(await postOverride({ mode: "CORRIDOR", phase: "NS" })).toEqual(cmd);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/overrides");
  expect(init?.method).toBe("POST");
  expect(JSON.parse(String(init?.body))).toEqual({
    mode: "CORRIDOR",
    phase: "NS",
  });
});

it("postOverride rejects with CONTROLLER_OFFLINE on 409", async () => {
  respond(409, {
    error: { code: "CONTROLLER_OFFLINE", message: "Controller offline" },
  });
  const err = await postOverride({ mode: "NONE" }).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiRequestError);
  expect(err).toMatchObject({ code: "CONTROLLER_OFFLINE", status: 409 });
});

it("listOverrides returns a Page and passes limit and cursor", async () => {
  const fetchMock = respond(200, { items: [cmd], nextCursor: "abc" });
  expect(await listOverrides({ limit: 50, cursor: "xyz" })).toEqual({
    items: [cmd],
    nextCursor: "abc",
  });
  expect(fetchMock.mock.calls[0][0]).toBe("/api/overrides?limit=50&cursor=xyz");
});
