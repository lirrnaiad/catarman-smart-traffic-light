import { describe, expect, it } from "vitest";
import { z } from "zod";
import { VehicleClass } from "../src/index.ts";
import vehicleClasses from "../vehicle-classes.json";

describe("vehicle-classes.json", () => {
  it("parses as VehicleClass[]", () => {
    expect(() => z.array(VehicleClass).parse(vehicleClasses)).not.toThrow();
  });

  it("has unique ids", () => {
    const ids = vehicleClasses.map((vehicleClass) => vehicleClass.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
