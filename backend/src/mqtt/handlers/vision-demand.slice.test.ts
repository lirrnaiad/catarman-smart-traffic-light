import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Pool } from "../../db/pool.ts";
import { createLink } from "../../services/link.ts";
import { createHub } from "../../sse/hub.ts";
import { dispatch } from "../client.ts";
import { handlers } from "./index.ts";

beforeEach(() => vi.useFakeTimers({ now: 1_800_000_000_000 }));
afterEach(() => vi.useRealTimers());

it("writes vision/demand to the demand slice through the registry", async () => {
  const hub = createHub({ validate: "throw" });
  const link = createLink(hub);
  const pcu = { N: 2.5, S: 0, E: 1, W: 0.5 };
  await dispatch(
    "stl/int-01/vision/demand",
    JSON.stringify({ v: 1, ts: Date.now(), pcu }),
    false,
    {
      iid: "int-01",
      handlers,
      pool: {} as Pool,
      hub,
      publisher: { publish: async () => {} },
      link,
      getLink: link.get,
    },
  );
  expect(hub.getSlice("demand")).toEqual({
    pcu,
    receivedAt: new Date(Date.now()).toISOString(),
  });
});
