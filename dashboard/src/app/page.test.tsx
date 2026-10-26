import type { LinkSlice } from "@stl/contracts";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { simLink, state } from "../components/shell/fixtures.ts";
import { LiveTestProvider } from "../lib/live/live-test-provider.tsx";
import LivePage from "./page.tsx";

// The Latest breach card loads over REST; these tests cover the controller panels, so it never answers.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  );
});
afterEach(() => vi.unstubAllGlobals());

it("mounts the three left-column panels and the MDRRMO override panel", () => {
  render(
    <LiveTestProvider slices={{ link: simLink, state }}>
      <LivePage />
    </LiveTestProvider>,
  );
  for (const name of ["Signal state", "Degradation level", "Flood sensor"])
    expect(screen.getByRole("region", { name })).toBeTruthy();
  expect(screen.getByRole("region", { name: "MDRRMO override" })).toBeTruthy();
  expect(screen.queryByText(/STALE/)).toBeNull();
});

it("state null: No data yet in every panel and the Current plate", () => {
  render(
    <LiveTestProvider slices={{ link: simLink, state: null }}>
      <LivePage />
    </LiveTestProvider>,
  );
  for (const name of [
    "Signal state",
    "Degradation level",
    "Flood sensor",
    "MDRRMO override",
  ])
    expect(
      within(screen.getByRole("region", { name })).getByText("No data yet"),
    ).toBeTruthy();
});

it("controller STALE: last values kept, StaleBadge on all four panels, no glow", () => {
  const link: LinkSlice = {
    ...simLink,
    controller: { ...simLink.controller, status: "STALE" },
  };
  const { container } = render(
    <LiveTestProvider
      slices={{
        link,
        state: { ...state, signals: { NS: "GREEN", EW: "RED" } },
      }}
    >
      <LivePage />
    </LiveTestProvider>,
  );
  expect(screen.getAllByText("STALE · 14:32:08")).toHaveLength(4);
  for (const tag of ["Live · INT-01", "Degrades downward", "Immersion probe"])
    expect(screen.queryByText(tag)).toBeNull();
  for (const name of ["Signal state", "Degradation level", "Flood sensor"])
    expect(
      within(screen.getByRole("region", { name })).getByText(
        "STALE · 14:32:08",
      ),
    ).toBeTruthy();
  expect(screen.getByText("Green")).toBeTruthy();
  expect(screen.getByText("FAULT · Conflict monitor")).toBeTruthy();
  const lit = [
    ...container.querySelectorAll<HTMLElement>("[data-lens]"),
  ].filter((l) => l.style.opacity === "1");
  expect(lit).toHaveLength(2);
  for (const l of lit) expect(l.className).not.toMatch(/\blamp-glow\b/);
});
