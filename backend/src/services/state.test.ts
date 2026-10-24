import type { ControllerState } from "@stl/contracts";
import { describe, expect, it, vi } from "vitest";
import { createHub } from "../sse/hub.ts";
import { writeState } from "./state.ts";

const T = 1_800_000_000_000;
const payload: ControllerState = {
  v: 1,
  level: "L1",
  signals: { NS: "GREEN", EW: "RED" },
  flood: "DRY",
  fault: false,
  override: { mode: "NONE" },
  remainingS: 7,
};
const { v: _v, ...withoutV } = payload;

function setup() {
  const hub = createHub({ validate: "throw" });
  return { hub, setSlice: vi.spyOn(hub, "setSlice") };
}

describe("state service", () => {
  it("writes a fresh state without v, with remainingS and receivedAt", () => {
    const { hub, setSlice } = setup();
    writeState(hub, payload, T, false);
    const expected = { ...withoutV, receivedAt: new Date(T).toISOString() };
    expect(setSlice).toHaveBeenCalledWith("state", expected);
    expect(hub.getSlice("state")).toEqual(expected);
  });

  it("writes a repeated state every time", () => {
    const { hub, setSlice } = setup();
    writeState(hub, payload, T, false);
    writeState(hub, payload, T + 2_000, false);
    expect(setSlice).toHaveBeenCalledTimes(2);
    expect(hub.getSlice("state")?.receivedAt).toBe(
      new Date(T + 2_000).toISOString(),
    );
  });

  it("keeps a fresh remainingS of 0", () => {
    const { hub } = setup();
    writeState(hub, { ...payload, remainingS: 0 }, T, false);
    expect(hub.getSlice("state")?.remainingS).toBe(0);
  });

  it("writes no remainingS for a fresh state without one", () => {
    const { hub } = setup();
    const { remainingS: _r, ...untimed } = payload;
    writeState(hub, untimed, T, false);
    expect(hub.getSlice("state")).not.toHaveProperty("remainingS");
  });

  it("drops remainingS from a retained copy", () => {
    const { hub } = setup();
    writeState(hub, payload, T, true);
    const { remainingS: _r, ...rest } = withoutV;
    expect(hub.getSlice("state")).toEqual({
      ...rest,
      receivedAt: new Date(T).toISOString(),
    });
  });
});
