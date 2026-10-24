import type { LinkSlice } from "@stl/contracts";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LiveTestProvider } from "../../lib/live/live-test-provider.tsx";
import { ANNOUNCE_DELAY_MS, LiveRegion } from "../shell/live-region.tsx";
import { StaleBadge } from "./stale-badge.tsx";

const link = (status: "ONLINE" | "STALE"): LinkSlice => ({
  broker: "CONNECTED",
  controller: { status, source: "sim", bootCount: 0 },
  vision: { status: "ONLINE", source: "sim" },
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
const flush = () => act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS));

function view(status: "ONLINE" | "STALE") {
  return (
    <LiveTestProvider slices={{ link: link(status) }}>
      <LiveRegion>
        <StaleBadge of="controller" since="2026-10-23T06:32:08.000Z" />
      </LiveRegion>
    </LiveTestProvider>
  );
}

it("LIVE → STALE → LIVE: badge while stale, transitions announced politely", () => {
  const { container, rerender } = render(view("ONLINE"));
  const region = container.querySelector('[aria-live="polite"]');
  expect(screen.queryByText(/STALE/)).toBeNull();
  expect(region?.textContent).toBe("");

  rerender(view("STALE"));
  flush();
  expect(screen.getByText("STALE · 14:32:08")).toBeTruthy();
  expect(region?.textContent).toBe("Controller stale");

  rerender(view("ONLINE"));
  flush();
  expect(screen.queryByText(/STALE ·/)).toBeNull();
  expect(region?.textContent).toBe("Controller live");
});

it("does not announce the STALE it mounts with", () => {
  const { container } = render(view("STALE"));
  flush();
  expect(screen.getByText("STALE · 14:32:08")).toBeTruthy();
  expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe("");
});
