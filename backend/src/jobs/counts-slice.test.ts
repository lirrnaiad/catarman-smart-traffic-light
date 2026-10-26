import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import countsSlice from "./counts-slice.ts";
import type { JobCtx } from "./index.ts";

describe("counts slice job", () => {
  beforeEach(() =>
    vi.useFakeTimers({ now: new Date("2026-10-24T03:59:58.000Z") }),
  );
  afterEach(async () => {
    await countsSlice.stop();
    vi.useRealTimers();
  });

  it("sets the slice at start, pushes each new hour, and stops", async () => {
    const setSlice = vi.fn();
    const params: unknown[] = [];
    const pool = {
      query: async (_sql: string, p: unknown) => {
        params.push(p);
        return [[]];
      },
    };
    await countsSlice.start({ pool, hub: { setSlice } } as unknown as JobCtx);
    const hours = () => setSlice.mock.calls.map((c) => c[1].hourStart);
    expect(hours()).toEqual(["2026-10-24T03:00:00.000Z"]);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(hours()).toHaveLength(1); // not before the boundary + 50 ms
    await vi.advanceTimersByTimeAsync(50);
    expect(hours()).toEqual([
      "2026-10-24T03:00:00.000Z",
      "2026-10-24T04:00:00.000Z",
    ]);
    expect(setSlice.mock.calls[1][1].total).toBe(0);
    // The boundary refresh reads [new hour start, +1 h), not the old hour.
    expect(params[1]).toEqual([
      new Date("2026-10-24T04:00:00.000Z"),
      new Date("2026-10-24T05:00:00.000Z"),
    ]);

    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(hours()).toHaveLength(3);

    await countsSlice.stop();
    await vi.advanceTimersByTimeAsync(10 * 3_600_000);
    expect(hours()).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(0);
  });
});
