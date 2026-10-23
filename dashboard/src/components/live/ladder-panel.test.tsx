import type { Level, StateSlice } from "@stl/contracts";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { LiveTestProvider } from "../../lib/live/live-test-provider.tsx";
import { state as base, simLink } from "../shell/fixtures.ts";
import { LadderPanel } from "./ladder-panel.tsx";

const view = (s: StateSlice) => (
  <LiveTestProvider slices={{ link: simLink, state: s }}>
    <LadderPanel />
  </LiveTestProvider>
);

const currentLevel = () =>
  screen
    .getAllByRole("listitem")
    .filter((r) => r.getAttribute("aria-current"))
    .map((r) => r.querySelector("[data-level]")?.getAttribute("data-level"));

it.each(["L1", "L2", "L3", "L4"] as const)(
  "level %s: CURRENT on that rung only",
  (level: Level) => {
    render(view({ ...base, level, fault: false }));
    expect(
      screen
        .getAllByRole("listitem")
        .map((r) => r.textContent?.replace("Current", "")),
    ).toEqual([
      "L1Vision adaptive",
      "L2Stop-bar presence",
      "L3Fixed timing",
      "L4Flashing Amber",
    ]);
    expect(currentLevel()).toEqual([level]);
    expect(screen.getAllByText("Current")).toHaveLength(1);
  },
);

it("a fault or an override never moves the flag", () => {
  render(view({ ...base, level: "L2", fault: true }));
  expect(currentLevel()).toEqual(["L2"]);
  expect(
    screen.getByRole("img", { name: "L2 Stop-bar presence" }),
  ).toBeTruthy();
});

it("each rung has one accessible name: the badge's", () => {
  render(view({ ...base, level: "L1", fault: false }));
  for (const name of ["Vision adaptive", "Stop-bar presence", "Fixed timing"])
    expect(screen.getByText(name).getAttribute("aria-hidden")).toBe("true");
  expect(screen.getByRole("img", { name: "L4 Flashing Amber" })).toBeTruthy();
});

it("No data yet while state is null", () => {
  render(view(null));
  expect(screen.getByText("No data yet")).toBeTruthy();
  expect(screen.queryAllByRole("listitem")).toHaveLength(0);
});
