import { expect, it } from "vitest";
import { formatManila, manilaHourLabel } from "./time.ts";

it("formats Asia/Manila time and date", () => {
  expect(formatManila("2026-10-23T06:32:08.000Z")).toBe("14:32:08");
  expect(formatManila("2026-10-23T06:32:08.000Z", "date")).toBe("2026-10-23");
});

it("labels the Manila hour, 24-hour, across the UTC date line", () => {
  expect(manilaHourLabel("2026-10-23T16:00:00.000Z")).toBe("00:00");
  expect(formatManila("2026-10-23T16:00:00.000Z", "date")).toBe("2026-10-24");
});
