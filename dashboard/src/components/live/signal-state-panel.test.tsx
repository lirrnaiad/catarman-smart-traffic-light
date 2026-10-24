import type { Aspect, StateSlice } from "@stl/contracts";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { LiveTestProvider } from "../../lib/live/live-test-provider.tsx";
import { state as base, simLink } from "../shell/fixtures.ts";
import { SignalStatePanel } from "./signal-state-panel.tsx";

const state = (NS: Aspect, EW: Aspect): StateSlice => ({
  ...base,
  signals: { NS, EW },
});

const view = (s: StateSlice | undefined) => (
  <LiveTestProvider slices={{ link: simLink, state: s }}>
    <SignalStatePanel />
  </LiveTestProvider>
);

function litLenses(name: RegExp): string[] {
  return [
    ...screen
      .getByRole("img", { name })
      .querySelectorAll<HTMLElement>("[data-lens]"),
  ]
    .filter((l) => l.style.opacity === "1")
    .map((l) => l.dataset.lens ?? "");
}

it("cycle: NS green then yellow, EW red", () => {
  const { rerender } = render(view(state("GREEN", "RED")));
  expect(litLenses(/^Phase NS/)).toEqual(["GREEN"]);
  expect(litLenses(/^Phase EW/)).toEqual(["RED"]);
  expect(screen.getByText("Green")).toBeTruthy();
  expect(screen.getByText("Red")).toBeTruthy();

  rerender(view(state("YELLOW", "RED")));
  expect(litLenses(/^Phase NS/)).toEqual(["YELLOW"]);
  expect(screen.getByText("Yellow")).toBeTruthy();
  expect(screen.queryByText("Green")).toBeNull();
  expect(litLenses(/^Phase EW/)).toEqual(["RED"]);
});

it("labels the cards and their heads", () => {
  render(view(state("GREEN", "RED")));
  expect(screen.getByRole("img", { name: "Phase NS: green" })).toBeTruthy();
  expect(screen.getByText("Phase NS")).toBeTruthy();
  expect(screen.getByText("Phase EW")).toBeTruthy();
  expect(screen.getByText("N + S heads")).toBeTruthy();
  expect(screen.getByText("E + W heads")).toBeTruthy();
  expect(screen.getByText("Live · INT-01")).toBeTruthy();
});

it("flashing: both cards read Flashing amber", () => {
  render(view(state("FLASHING_AMBER", "FLASHING_AMBER")));
  expect(screen.getAllByText("Flashing amber")).toHaveLength(2);
  expect(litLenses(/^Phase NS/)).toEqual(["YELLOW"]);
  expect(litLenses(/^Phase EW/)).toEqual(["YELLOW"]);
});

it("dark: no lens lit, reads Dark", () => {
  render(view(state("DARK", "RED")));
  expect(litLenses(/^Phase NS/)).toEqual([]);
  expect(screen.getByText("Dark")).toBeTruthy();
});

it("renders no countdown from remainingS", () => {
  render(view({ ...state("GREEN", "RED"), remainingS: 14 } as StateSlice));
  expect(screen.queryByText(/14/)).toBeNull();
});

it.each([null, undefined])("state %s: No data yet", (s) => {
  render(view(s));
  expect(screen.getByText("No data yet")).toBeTruthy();
});
