import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { StateChangeItem } from "../src/index.ts";
import { UUID_A } from "./fixtures.ts";

const item: StateChangeItem = {
  receivedAt: "2026-10-24T06:00:00.000Z",
  level: "L4",
  signals: { NS: "GREEN", EW: "RED" },
  flood: "FLOODED",
  fault: false,
  override: { mode: "CORRIDOR", phase: "NS", commandId: UUID_A },
  overrideEnded: false,
};

describe("StateChangeItem", () => {
  it("parses a stored change, and strips an extra key such as a row id", () => {
    expect(StateChangeItem.parse({ ...item, id: 7 })).toEqual(item);
  });

  it.each([null, { mode: "NONE" }, { mode: "NONE", commandId: UUID_A }])(
    "accepts override %j",
    (override) => {
      expect(StateChangeItem.parse({ ...item, override }).override).toEqual(
        override,
      );
    },
  );

  it.each([
    { override: { mode: "CORRIDOR", commandId: UUID_A } },
    { override: undefined },
    { overrideEnded: undefined },
    { receivedAt: "2026-10-24 06:00:00" },
    { fault: "false" },
  ])("rejects %j", (patch) => {
    expect(() => StateChangeItem.parse({ ...item, ...patch })).toThrow(
      ZodError,
    );
  });
});
