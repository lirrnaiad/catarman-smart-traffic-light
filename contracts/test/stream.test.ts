import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  LinkSlice,
  type StreamName,
  sseFrame,
  streamSchemas,
} from "../src/index.ts";
import { TS, UUID_A } from "./fixtures.ts";

const ISO = "2026-10-23T01:02:03.456Z";

describe("streamSchemas", () => {
  it("has the AD-8 keys in order: slices, then occurrences", () => {
    expect(Object.keys(streamSchemas)).toEqual([
      "link",
      "state",
      "counts",
      "demand",
      "breach",
      "override",
      "speedAlert",
    ]);
  });

  it.each(["state", "counts", "demand"] as const)("%s is nullable", (name) => {
    expect(streamSchemas[name].parse(null)).toBeNull();
  });

  it.each(["link", "breach", "override", "speedAlert"] as const)(
    "%s is not nullable",
    (name: StreamName) => {
      expect(() => streamSchemas[name].parse(null)).toThrow(ZodError);
    },
  );

  it("state is controller/state without v, plus receivedAt", () => {
    const value = {
      level: "L2",
      signals: { NS: "RED", EW: "GREEN" },
      flood: "WET",
      fault: false,
      override: { mode: "CORRIDOR", phase: "EW", commandId: UUID_A },
      remainingS: 4,
      power: "BATTERY",
      receivedAt: ISO,
    };
    expect(streamSchemas.state.parse({ ...value, v: 1 })).toEqual(value);
    const { receivedAt: _r, ...withoutReceivedAt } = value;
    expect(() => streamSchemas.state.parse(withoutReceivedAt)).toThrow(
      ZodError,
    );
  });

  it("demand is {pcu, receivedAt}", () => {
    const value = { pcu: { N: 2.5, S: 0, E: 1, W: 0.5 }, receivedAt: ISO };
    expect(streamSchemas.demand.parse({ ...value, ts: TS })).toEqual(value);
  });

  it("receivedAt must be ISO UTC ending in Z", () => {
    expect(() =>
      streamSchemas.demand.parse({
        pcu: { N: 0, S: 0, E: 0, W: 0 },
        receivedAt: "2026-10-23T09:02:03.456+08:00",
      }),
    ).toThrow(ZodError);
  });
});

describe("sseFrame", () => {
  it("writes the spine's link example byte for byte", () => {
    const link = LinkSlice.parse({
      broker: "CONNECTED",
      controller: { status: "ONLINE", source: "sim", bootCount: null },
      vision: { status: "ONLINE", source: "sim" },
    });
    expect(sseFrame("link", link)).toBe(
      'event: link\ndata: {"broker":"CONNECTED","controller":{"status":"ONLINE","source":"sim","bootCount":null},"vision":{"status":"ONLINE","source":"sim"}}\n\n',
    );
  });

  it("writes a null slice as null", () => {
    expect(sseFrame("state", null)).toBe("event: state\ndata: null\n\n");
  });

  it("keeps a newline inside a value on one data line", () => {
    const frame = sseFrame("breach", {
      id: UUID_A,
      occurredAt: ISO,
      receivedAt: ISO,
      approach: "N",
      vehicleClass: "car",
      centroid: { x: 0.5, y: 0.5 },
      cropUrl: "/api/breaches/a\nb/crop",
    });
    expect(frame.startsWith("event: breach\ndata: {")).toBe(true);
    expect(frame.endsWith("}\n\n")).toBe(true);
    expect(frame.split("\n")).toHaveLength(4);
  });
});
