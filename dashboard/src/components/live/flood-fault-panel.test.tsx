import type { StateSlice } from "@stl/contracts";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { LiveTestProvider } from "../../lib/live/live-test-provider.tsx";
import { state as base, simLink } from "../shell/fixtures.ts";
import { FloodFaultPanel } from "./flood-fault-panel.tsx";

const view = (s: StateSlice) => (
  <LiveTestProvider slices={{ link: simLink, state: s }}>
    <FloodFaultPanel />
  </LiveTestProvider>
);

it.each(["DRY", "WET", "FLOODED"] as const)(
  "flood %s: that cell on",
  (flood) => {
    const { container } = render(view({ ...base, flood }));
    const on = [...container.querySelectorAll<HTMLElement>("[data-on]")];
    expect(on.map((c) => c.dataset.flood)).toEqual([flood]);
    expect(
      screen.queryByText(/immersion seen, debounce running/) !== null,
    ).toBe(flood === "WET");
  },
);

it("only the FLOODED cell carries the hazard edge", () => {
  const { container } = render(view({ ...base, flood: "DRY" }));
  const bg = (f: string) =>
    container.querySelector<HTMLElement>(`[data-flood="${f}"]`)?.style
      .background;
  expect(bg("FLOODED")).toContain("var(--color-hazard-paint)");
  expect(bg("DRY")).not.toContain("hazard");
  expect(bg("WET")).not.toContain("hazard");
});

it("fault row: None while clear, and no control", () => {
  render(view({ ...base, fault: false }));
  expect(screen.getByText("Conflict fault")).toBeTruthy();
  expect(screen.getByText("None")).toBeTruthy();
  expect(screen.queryByText("Reset at the controller box")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
});

it("fault row: FAULT · Conflict monitor and the reset note while faulted", () => {
  render(view({ ...base, fault: true }));
  expect(screen.getByText("FAULT · Conflict monitor")).toBeTruthy();
  expect(screen.getByText("Reset at the controller box")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();
});

it("No data yet while state is null", () => {
  render(view(null));
  expect(screen.getByText("No data yet")).toBeTruthy();
});
