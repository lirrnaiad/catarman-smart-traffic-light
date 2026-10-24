import type { LinkSlice } from "@stl/contracts";
import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Slices } from "../../lib/live/hooks.ts";
import { LiveTestProvider } from "../../lib/live/live-test-provider.tsx";
import { simLink, state } from "./fixtures.ts";
import { LinkHealthBar } from "./link-health-bar.tsx";

const path = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

function bar(slices: Slices, at = "/") {
  path.current = at;
  render(
    <LiveTestProvider slices={slices}>
      <LinkHealthBar />
    </LiveTestProvider>,
  );
  return screen.getByRole("status", { name: "Link health" });
}

const pilots = (el: HTMLElement) =>
  [...el.querySelectorAll("[data-pilot]")].map((p) => [
    p.parentElement?.textContent,
    p.getAttribute("data-pilot"),
  ]);

it("all online, sim: lit pilots, Sim tags and the simulated note", () => {
  const el = bar({ link: simLink });
  expect(pilots(el)).toEqual([
    ["Broker Connected", "lit"],
    ["Controller OnlineSim", "lit"],
    ["Vision OnlineSim", "lit"],
  ]);
  expect(within(el).getAllByText("Sim")).toHaveLength(2);
  expect(
    within(el).getByText("Data source · simulated (midterm)"),
  ).toBeTruthy();
});

it("mixed: lit, stale-bordered and unlit pilots, no Sim tags, no note", () => {
  const link: LinkSlice = {
    broker: "CONNECTED",
    controller: { status: "STALE", source: null, bootCount: null },
    vision: { status: "OFFLINE", source: null },
  };
  const el = bar({ link });
  expect(pilots(el)).toEqual([
    ["Broker Connected", "lit"],
    ["Controller Stale", "stale"],
    ["Vision Offline", "off"],
  ]);
  const stale = el.querySelector<HTMLElement>('[data-pilot="stale"]');
  expect(stale?.style.borderColor).toBe("var(--color-status-ok-deep)");
  expect(stale?.style.background).toBe("var(--color-status-off)");
  expect(within(el).queryByText("Sim")).toBeNull();
  expect(within(el).queryByText(/Data source/)).toBeNull();
});

it("a disconnected broker is unlit", () => {
  const el = bar({ link: { ...simLink, broker: "DISCONNECTED" } });
  expect(pilots(el)[0]).toEqual(["Broker Disconnected", "off"]);
});

it("banners on /: L4, Override, FAULT in order; the note hidden", () => {
  const el = bar({ link: simLink, state });
  expect(
    [...el.querySelectorAll("span")]
      .map((s) => s.textContent)
      .filter((t) => t?.match(/^(L4|OVERRIDE|FAULT) ·/)),
  ).toEqual([
    "L4 · FLASHING AMBER · FLOOD",
    "OVERRIDE · CORRIDOR NS",
    "FAULT · CONFLICT MONITOR",
  ]);
  expect(within(el).queryByText(/Data source/)).toBeNull();
});

it("flashing-amber override banner", () => {
  const el = bar({
    state: {
      ...state,
      level: "L1",
      fault: false,
      override: {
        mode: "FLASHING_AMBER",
        commandId: "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60",
      },
    },
  });
  expect(within(el).getByText("OVERRIDE · FLASHING AMBER")).toBeTruthy();
  expect(within(el).queryByText(/^L4|^FAULT/)).toBeNull();
});

it("no banners off /, and the note returns", () => {
  const el = bar({ link: simLink, state }, "/traffic/");
  expect(within(el).queryByText(/^(L4|OVERRIDE|FAULT) ·/)).toBeNull();
  expect(
    within(el).getByText("Data source · simulated (midterm)"),
  ).toBeTruthy();
});

it("no banners while state is null", () => {
  const el = bar({ link: simLink, state: null });
  expect(within(el).queryByText(/^(L4|OVERRIDE|FAULT) ·/)).toBeNull();
});

it("on / with no L4, fault or override: no banner, and the note shows", () => {
  const el = bar({
    link: simLink,
    state: { ...state, level: "L1", fault: false, override: { mode: "NONE" } },
  });
  expect(within(el).queryByText(/^(L4|OVERRIDE|FAULT) ·/)).toBeNull();
  expect(
    within(el).getByText("Data source · simulated (midterm)"),
  ).toBeTruthy();
});
