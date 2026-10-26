import type { CountsSlice, LinkSlice } from "@stl/contracts";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LiveTestProvider } from "../../lib/live/live-test-provider.tsx";
import { simLink } from "../shell/fixtures.ts";
import { CountsPanel } from "./counts-panel.tsx";

const loaded = {
  classes: [
    { id: "car", label: "Car", pcu: 1 },
    { id: "tricycle", label: "Tricycle", pcu: 0.5 },
  ],
  error: null,
};
const classes = vi.hoisted(() => ({ result: null as unknown }));
vi.mock("../../lib/use-vehicle-classes.ts", () => ({
  useVehicleClasses: () => classes.result,
}));
classes.result = loaded;
afterEach(() => {
  classes.result = loaded;
});

const counts = (
  hourStart: string,
  W: Record<string, number> = { car: 0, tricycle: 0 },
): NonNullable<CountsSlice> => ({
  hourStart,
  total: 42,
  byApproach: {
    N: { car: 14, tricycle: 3 },
    S: { car: 0, tricycle: 9 },
    E: { car: 2, tricycle: 0 },
    W,
  },
});

const view = (c: CountsSlice | undefined, link: LinkSlice = simLink) => (
  <LiveTestProvider slices={{ link, counts: c }}>
    <CountsPanel />
  </LiveTestProvider>
);

const headers = () =>
  screen.getAllByRole("columnheader").map((h) => h.textContent);
const row = (a: string) =>
  screen
    .getByRole("rowheader", { name: a })
    .parentElement?.querySelectorAll("td") ?? [];

it("columns in file order, the total as sent, zero cells dimmed", () => {
  render(view(counts("2026-10-23T06:00:00.000Z")));
  expect(
    screen.getByRole("region", { name: "Vehicle counts this hour" }),
  ).toBeTruthy();
  expect(headers()).toEqual(["Appr.", "Car", "Tricycle"]);
  expect([...row("N")].map((c) => c.textContent)).toEqual(["14", "3"]);
  const [car] = row("S");
  expect(car.textContent).toBe("0");
  expect(car.className).toMatch(/\btext-text-3\b/);
  expect(row("N")[0].className).not.toMatch(/\btext-text-3\b/);
  expect(screen.getByText("42")).toBeTruthy();
  expect(screen.getByText("Hour total")).toBeTruthy();
  expect(screen.getByText("All approaches, all classes")).toBeTruthy();
  expect(screen.getByText("Since 14:00")).toBeTruthy();
});

it("an unknown class gets an extra raw column after the file's", () => {
  render(
    view(
      counts("2026-10-23T06:00:00.000Z", { car: 0, tricycle: 0, kalesa: 1 }),
    ),
  );
  expect(headers()).toEqual(["Appr.", "Car", "Tricycle", "kalesa"]);
  expect([...row("W")].map((c) => c.textContent)).toEqual(["0", "0", "1"]);
  expect([...row("N")].map((c) => c.textContent)).toEqual(["14", "3", "0"]);
});

it.each([null, undefined])("counts %s: No data yet", (c) => {
  render(view(c));
  expect(screen.getByText("No data yet")).toBeTruthy();
});

it("a new hour replaces the table and the tag", () => {
  const { rerender } = render(view(counts("2026-10-23T06:00:00.000Z")));
  rerender(
    view({
      ...counts("2026-10-23T07:00:00.000Z"),
      total: 0,
      byApproach: { N: { car: 1 }, S: {}, E: {}, W: {} },
    }),
  );
  expect(screen.getByText("Since 15:00")).toBeTruthy();
  expect(screen.queryByText("42")).toBeNull();
  expect([...row("N")].map((c) => c.textContent)).toEqual(["1", "0"]);
});

it("vision STALE: last values kept under the StaleBadge", () => {
  render(
    view(counts("2026-10-23T06:00:00.000Z"), {
      ...simLink,
      vision: { ...simLink.vision, status: "STALE" },
    }),
  );
  expect(screen.getByText("STALE")).toBeTruthy();
  expect(screen.getByText("42")).toBeTruthy();
});

it("counts before the class list: raw ids as headers, counts as sent", () => {
  classes.result = { classes: null, error: null };
  render(view(counts("2026-10-23T06:00:00.000Z")));
  expect(headers()).toEqual(["Appr.", "car", "tricycle"]);
  expect([...row("N")].map((c) => c.textContent)).toEqual(["14", "3"]);
  expect(screen.getByText("42")).toBeTruthy();
});
