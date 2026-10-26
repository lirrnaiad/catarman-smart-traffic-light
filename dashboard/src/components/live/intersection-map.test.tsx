import type { DemandSlice, LinkSlice, StateSlice } from "@stl/contracts";
import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { LiveTestProvider } from "../../lib/live/live-test-provider.tsx";
import { state as base, simLink } from "../shell/fixtures.ts";
import { IntersectionMap } from "./intersection-map.tsx";

const cycle: StateSlice = {
  ...base,
  level: "L1",
  signals: { NS: "GREEN", EW: "RED" },
};
const demand: DemandSlice = {
  pcu: { N: 2.5, S: 1, E: 1.2, W: 0 },
  receivedAt: "2026-10-23T06:33:10.000Z",
};
const stale = (role: "controller" | "vision"): LinkSlice => ({
  ...simLink,
  [role]: { ...simLink[role], status: "STALE" },
});

const view = (
  state: StateSlice | undefined,
  d: DemandSlice | undefined,
  link: LinkSlice = simLink,
) => (
  <LiveTestProvider slices={{ link, state, demand: d }}>
    <IntersectionMap />
  </LiveTestProvider>
);

const lit = (name: string) =>
  [
    ...screen
      .getByRole("img", { name: new RegExp(`^${name} head`) })
      .querySelectorAll<HTMLElement>("[data-lens]"),
  ].filter((l) => l.style.opacity === "1");

const tag = (a: string) =>
  document.querySelector(`[data-pcu="${a}"] b`) as HTMLElement;

it("heads: N and S mirror NS, E and W mirror EW", () => {
  render(view(cycle, demand));
  for (const [a, lens] of [
    ["North", "GREEN"],
    ["South", "GREEN"],
    ["East", "RED"],
    ["West", "RED"],
  ]) {
    expect(lit(a).map((l) => l.dataset.lens)).toEqual([lens]);
    expect(lit(a)[0].className).toMatch(/\blamp-glow\b/);
  }
  expect(screen.getByRole("img", { name: "North head: green" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "West head: red" })).toBeTruthy();
  expect(screen.getAllByText("Green")).toHaveLength(2);
  expect(screen.getAllByText("Phase NS")).toHaveLength(2);
  expect(screen.getByText("North approach")).toBeTruthy();
  expect(document.querySelector("[data-flood-hatch]")).toBeNull();
});

it("L4: the flood hatch over the map", () => {
  render(view(base, demand));
  expect(document.querySelector("[data-flood-hatch]")).not.toBeNull();
});

it("PCU: one decimal as received, zero dimmed", () => {
  render(view(cycle, demand));
  expect(["N", "S", "E", "W"].map((a) => tag(a).textContent)).toEqual([
    "2.5",
    "1.0",
    "1.2",
    "0.0",
  ]);
  expect(tag("W").className).toMatch(/\btext-text-3\b/);
  expect(tag("N").className).not.toMatch(/\btext-text-3\b/);
  expect(screen.getByText("PCU · N")).toBeTruthy();
  expect(
    screen.getByRole("img", { name: "North demand: 2.5 PCU" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("img", { name: "West demand: 0.0 PCU" }),
  ).toBeTruthy();
});

it.each([null, undefined])("demand %s: four tags read –", (d) => {
  render(view(cycle, d));
  for (const a of ["N", "S", "E", "W"]) expect(tag(a).textContent).toBe("–");
  expect(
    screen.getByRole("img", { name: "North demand: no data yet" }),
  ).toBeTruthy();
});

it.each([null, undefined])(
  "state %s: the map draws, heads dark, labels No data yet",
  (s) => {
    render(view(s, demand));
    expect(screen.getAllByText("No data yet")).toHaveLength(4);
    for (const a of ["North", "South", "East", "West"])
      expect(lit(a)).toHaveLength(0);
    expect(screen.getByText("INT-01")).toBeTruthy();
  },
);

it("vision STALE: PCU keeps its values under a vision StaleBadge", () => {
  render(view(cycle, demand, stale("vision")));
  expect(screen.getByText("STALE · 14:33:10")).toBeTruthy();
  expect(tag("N").textContent).toBe("2.5");
  expect(lit("North")[0].className).toMatch(/\blamp-glow\b/);
});

it("controller STALE: heads keep the last aspect without glow; title StaleBadge", () => {
  render(view(cycle, demand, stale("controller")));
  const region = screen.getByRole("region", { name: /Intersection INT-01/ });
  expect(within(region).getByText("STALE · 14:32:08")).toBeTruthy();
  expect(screen.queryByText("STALE · 14:33:10")).toBeNull();
  for (const a of ["North", "South", "East", "West"]) {
    expect(lit(a)).toHaveLength(1);
    expect(lit(a)[0].className).not.toMatch(/\blamp-glow\b/);
  }
});

it("renders no countdown from remainingS", () => {
  render(view({ ...cycle, remainingS: 14 } as StateSlice, demand));
  expect(screen.queryByText(/14 s/)).toBeNull();
});
