import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  ControllerOverrideAck,
  ControllerOverrideCmd,
  ControllerState,
  ListQuery,
  OverrideRequest,
  type TopicName,
  topicNames,
  topics,
  VisionBreach,
  VisionCounts,
  VisionDemand,
  VisionHeartbeat,
  VisionSpeedAlert,
} from "../src/index.ts";
import { examples, TS, UUID_A, variantExamples } from "./fixtures.ts";

function parseTopic(topic: TopicName, payload: unknown): unknown {
  return topics[topic].schema.parse(payload);
}

const state = examples["controller/state"];

describe("spine examples", () => {
  it.each(topicNames)("%s parses with its topic's schema", (topic) => {
    expect(parseTopic(topic, examples[topic])).toEqual(examples[topic]);
  });

  it.each(
    Object.entries(variantExamples).flatMap(([topic, payloads]) =>
      payloads.map((payload) => [topic as TopicName, payload] as const),
    ),
  )("%s variant parses", (topic, payload) => {
    expect(parseTopic(topic, payload)).toEqual(payload);
  });
});

describe("unknown keys", () => {
  it.each(topicNames)("%s strips an extra key", (topic) => {
    const parsed = parseTopic(topic, { ...examples[topic], extra: 1 });
    expect(parsed).toEqual(examples[topic]);
    expect(parsed).not.toHaveProperty("extra");
  });

  it("strips extra nested keys", () => {
    const parsed = ControllerState.parse({
      ...state,
      signals: { ...state.signals, PED: "RED" },
      override: { ...state.override, note: "x" },
    });
    expect(parsed).toEqual(state);
  });
});

describe("override variants", () => {
  it("parses a state with override absent", () => {
    const { override: _omit, ...withoutOverride } = state;
    expect(ControllerState.parse(withoutOverride)).toEqual(withoutOverride);
  });

  it("parses {mode: NONE} without commandId", () => {
    const payload = { ...state, override: { mode: "NONE" } };
    expect(ControllerState.parse(payload)).toEqual(payload);
  });

  it("requires commandId outside the NONE variant", () => {
    expect(() =>
      ControllerState.parse({ ...state, override: { mode: "FLASHING_AMBER" } }),
    ).toThrow(ZodError);
    expect(() =>
      ControllerState.parse({
        ...state,
        override: { mode: "CORRIDOR", phase: "NS" },
      }),
    ).toThrow(ZodError);
  });

  it("parses the optional M2 fields when absent", () => {
    const { remainingS: _r, power: _p, ...m1 } = state;
    expect(ControllerState.parse(m1)).toEqual(m1);
  });
});

describe("corridor without phase", () => {
  it("rejects state.override", () => {
    expect(() =>
      ControllerState.parse({
        ...state,
        override: { mode: "CORRIDOR", commandId: UUID_A },
      }),
    ).toThrow(ZodError);
  });

  it("rejects override/cmd", () => {
    expect(() =>
      ControllerOverrideCmd.parse({
        v: 1,
        commandId: UUID_A,
        ts: TS,
        mode: "CORRIDOR",
      }),
    ).toThrow(ZodError);
  });

  it("rejects OverrideRequest", () => {
    expect(() => OverrideRequest.parse({ mode: "CORRIDOR" })).toThrow(ZodError);
  });

  it("accepts OverrideRequest variants", () => {
    expect(OverrideRequest.parse({ mode: "CORRIDOR", phase: "NS" })).toEqual({
      mode: "CORRIDOR",
      phase: "NS",
    });
    expect(OverrideRequest.parse({ mode: "NONE" })).toEqual({ mode: "NONE" });
    expect(OverrideRequest.parse({ mode: "FLASHING_AMBER" })).toEqual({
      mode: "FLASHING_AMBER",
    });
  });
});

describe("rejection codes", () => {
  const rejected = { v: 1, commandId: UUID_A, result: "REJECTED" };

  it("parses an unknown UPPER_SNAKE code", () => {
    const payload = { ...rejected, reason: "FOO_BAR" };
    expect(ControllerOverrideAck.parse(payload)).toEqual(payload);
  });

  it("rejects a malformed reason", () => {
    expect(() =>
      ControllerOverrideAck.parse({ ...rejected, reason: "bad" }),
    ).toThrow(ZodError);
  });

  it("rejects a missing reason", () => {
    expect(() => ControllerOverrideAck.parse(rejected)).toThrow(ZodError);
  });
});

describe("ts is epoch milliseconds", () => {
  it.each([
    "controller/override/cmd",
    "vision/heartbeat",
    "vision/demand",
    "vision/counts",
    "vision/breach",
    "vision/speed-alert",
  ] as const)("%s rejects epoch seconds", (topic) => {
    expect(() =>
      parseTopic(topic, { ...examples[topic], ts: 1793000000 }),
    ).toThrow(ZodError);
  });

  it("rejects a fractional ts", () => {
    expect(() =>
      VisionHeartbeat.parse({ ...examples["vision/heartbeat"], ts: TS + 0.5 }),
    ).toThrow(ZodError);
  });

  it.each(["vision/counts", "vision/breach", "vision/speed-alert"] as const)(
    "%s parses without ts",
    (topic) => {
      const { ts: _ts, ...payload } = examples[topic];
      expect(parseTopic(topic, payload)).toEqual(payload);
    },
  );

  it.each([
    "controller/override/cmd",
    "vision/heartbeat",
    "vision/demand",
  ] as const)("%s requires ts", (topic) => {
    const { ts: _ts, ...payload } = examples[topic];
    expect(() => parseTopic(topic, payload)).toThrow(ZodError);
  });
});

describe("counts edge cases", () => {
  const counts = examples["vision/counts"];

  it("rejects empty crossings", () => {
    expect(() => VisionCounts.parse({ ...counts, crossings: [] })).toThrow(
      ZodError,
    );
  });

  it("rejects count 0", () => {
    expect(() =>
      VisionCounts.parse({
        ...counts,
        crossings: [{ approach: "N", vehicleClass: "car", count: 0 }],
      }),
    ).toThrow(ZodError);
  });

  it("rejects a repeated approach + vehicleClass pair", () => {
    expect(() =>
      VisionCounts.parse({
        ...counts,
        crossings: [
          { approach: "N", vehicleClass: "car", count: 1 },
          { approach: "N", vehicleClass: "car", count: 2 },
        ],
      }),
    ).toThrow(ZodError);
  });

  it("accepts the same class on two approaches, and unknown class ids", () => {
    const payload = {
      ...counts,
      crossings: [
        { approach: "N", vehicleClass: "car", count: 1 },
        { approach: "S", vehicleClass: "car", count: 3 },
        { approach: "S", vehicleClass: "kalesa", count: 1 },
      ],
    };
    expect(VisionCounts.parse(payload)).toEqual(payload);
  });

  it("rejects a class id that isn't lower snake_case", () => {
    expect(() =>
      VisionCounts.parse({
        ...counts,
        crossings: [{ approach: "N", vehicleClass: "Car", count: 1 }],
      }),
    ).toThrow(ZodError);
  });
});

describe("breach crop", () => {
  const breach = examples["vision/breach"];

  it("parses without a crop", () => {
    const { crop: _crop, ...payload } = breach;
    expect(VisionBreach.parse(payload)).toEqual(payload);
  });

  it("parses any {mime, data} strings; the backend checks crops (AD-11)", () => {
    const payload = { ...breach, crop: { mime: "image/png", data: "%%%" } };
    expect(VisionBreach.parse(payload)).toEqual(payload);
  });

  it.each([
    { x: -0.01, y: 0.5 },
    { x: 0.5, y: 1.01 },
  ])("rejects centroid %o", (centroid) => {
    expect(() => VisionBreach.parse({ ...breach, centroid })).toThrow(ZodError);
  });

  it("accepts centroid on the 0 and 1 bounds", () => {
    const payload = { ...breach, centroid: { x: 0, y: 1 } };
    expect(VisionBreach.parse(payload)).toEqual(payload);
  });
});

describe("speed alert", () => {
  const alert = examples["vision/speed-alert"];

  it.each([800, 900])(
    "rejects elapsedMs %i with thresholdMs 800",
    (elapsedMs) => {
      expect(() => VisionSpeedAlert.parse({ ...alert, elapsedMs })).toThrow(
        ZodError,
      );
    },
  );

  it("accepts elapsedMs 0", () => {
    expect(VisionSpeedAlert.parse({ ...alert, elapsedMs: 0 })).toEqual({
      ...alert,
      elapsedMs: 0,
    });
  });

  it("rejects thresholdMs 0", () => {
    expect(() =>
      VisionSpeedAlert.parse({ ...alert, elapsedMs: 0, thresholdMs: 0 }),
    ).toThrow(ZodError);
  });
});

describe("demand", () => {
  it("rejects a negative PCU and a missing approach", () => {
    const demand = examples["vision/demand"];
    expect(() =>
      VisionDemand.parse({ ...demand, pcu: { ...demand.pcu, N: -1 } }),
    ).toThrow(ZodError);
    expect(() =>
      VisionDemand.parse({ ...demand, pcu: { N: 1, S: 0, E: 0 } }),
    ).toThrow(ZodError);
  });
});

describe("v is the literal 1", () => {
  it.each(topicNames)("%s rejects v: 2", (topic) => {
    expect(() => parseTopic(topic, { ...examples[topic], v: 2 })).toThrow(
      ZodError,
    );
  });
});

describe("ListQuery", () => {
  it("defaults limit to 50", () => {
    expect(ListQuery.parse({})).toEqual({ limit: 50 });
  });

  it("coerces a query-string limit", () => {
    expect(ListQuery.parse({ limit: "20", cursor: "abc" })).toEqual({
      limit: 20,
      cursor: "abc",
    });
  });

  it.each(["0", "201", "abc", "2.5"])("rejects limit %j", (limit) => {
    expect(() => ListQuery.parse({ limit })).toThrow(ZodError);
  });

  it("accepts the 1 and 200 bounds", () => {
    expect(ListQuery.parse({ limit: "1" }).limit).toBe(1);
    expect(ListQuery.parse({ limit: "200" }).limit).toBe(200);
  });
});
