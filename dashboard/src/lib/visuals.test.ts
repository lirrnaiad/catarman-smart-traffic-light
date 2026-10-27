import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  Approach,
  Aspect,
  BrokerStatus,
  CommandStatus,
  Flood,
  Level,
  LinkStatus,
  Liveness,
  OverrideMode,
  Phase,
  Power,
  Source,
} from "@stl/contracts";
import { describe, expect, it } from "vitest";
import {
  approachVisuals,
  aspectVisuals,
  brokerStatusVisuals,
  COLOR_TOKENS,
  classColor,
  classLabelParts,
  colorVar,
  commandStatusVisuals,
  faultVisual,
  floodVisuals,
  levelVisuals,
  linkStatusVisuals,
  livenessVisuals,
  overrideModeVisuals,
  phaseVisuals,
  powerVisuals,
  rejectionReasonVisual,
  softHyphenate,
  sourceVisuals,
  type Visual,
} from "./visuals.ts";

const families: [
  string,
  { options: readonly string[] },
  Record<string, Visual>,
][] = [
  ["Level", Level, levelVisuals],
  ["Aspect", Aspect, aspectVisuals],
  ["OverrideMode", OverrideMode, overrideModeVisuals],
  ["Flood", Flood, floodVisuals],
  ["Power", Power, powerVisuals],
  ["Source", Source, sourceVisuals],
  ["CommandStatus", CommandStatus, commandStatusVisuals],
  ["LinkStatus", LinkStatus, linkStatusVisuals],
  ["BrokerStatus", BrokerStatus, brokerStatusVisuals],
  ["Liveness", Liveness, livenessVisuals],
  ["Approach", Approach, approachVisuals],
  ["Phase", Phase, phaseVisuals],
];

describe.each(families)("%s", (family, schema, visuals) => {
  it("has a non-empty label and a design token for every value", () => {
    expect(Object.keys(visuals).sort()).toEqual([...schema.options].sort());
    for (const value of schema.options) {
      expect(visuals[value]?.label, value).toBeTruthy();
      expect(COLOR_TOKENS, value).toContain(visuals[value]?.token);
      if (family !== "Aspect") {
        expect(visuals[value]?.token, value).not.toMatch(/^signal-/);
      }
    }
  });
});

it("uses the exact level and aspect labels", () => {
  expect(Object.values(levelVisuals).map((v) => v.label)).toEqual([
    "L1 Vision adaptive",
    "L2 Stop-bar presence",
    "L3 Fixed timing",
    "L4 Flashing Amber",
  ]);
  expect(Aspect.options.map((a) => aspectVisuals[a].label)).toEqual([
    "Green",
    "Yellow",
    "Red",
    "Flashing amber",
    "Dark",
  ]);
  expect(levelVisuals.L4.token).toMatch(/^hazard-/);
  expect(faultVisual(true).token).toMatch(/^hazard-/);
});

it("labels known rejection codes and shows any other code raw", () => {
  expect(rejectionReasonVisual("CONTROLLER_OFFLINE").label).toBe(
    "Controller offline",
  );
  expect(rejectionReasonVisual("CONFLICT_FAULT").label).toBe("Conflict fault");
  expect(rejectionReasonVisual("SOME_CODE").label).toBe("SOME_CODE");
});

it("colors classes by position, unknown ids neutral", () => {
  const classes = [
    { id: "car", label: "Car", pcu: 1 },
    { id: "tricycle", label: "Tricycle", pcu: 0.5 },
  ];
  expect(classColor("tricycle", classes)).toBe("class-tricycle");
  expect(classColor("bus", classes)).toBe("class-unknown");
  expect(colorVar("class-car")).toBe("var(--color-class-car)");
});

it("splits a class label's aside into a footnote", () => {
  expect(classLabelParts("Motorcycle (incl. habal-habal)")).toEqual({
    short: "Motorcycle",
    note: "Motorcycle includes habal-habal",
  });
  expect(classLabelParts("Bus (public)")).toEqual({
    short: "Bus",
    note: "Bus (public)",
  });
  expect(classLabelParts("Utility van")).toEqual({
    short: "Utility van",
    note: null,
  });
});

it("soft-hyphenates the known class words, keeping their case", () => {
  expect(softHyphenate("Motorcycle*")).toBe("Motor­cycle*");
  expect(softHyphenate("TRICYCLE")).toBe("TRI­CYCLE");
  expect(softHyphenate("Utility van")).toBe("Utility van");
});

it("defines every token in globals.css", () => {
  const css = readFileSync(
    join(import.meta.dirname, "../app/globals.css"),
    "utf8",
  );
  for (const token of COLOR_TOKENS) expect(css).toContain(`--color-${token}:`);
});
