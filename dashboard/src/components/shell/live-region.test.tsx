import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ANNOUNCE_DELAY_MS, LiveRegion, useAnnounce } from "./live-region.tsx";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

let announce: (text: string) => void = () => {};
function Grab() {
  announce = useAnnounce();
  return null;
}

function setup() {
  const { container } = render(
    <LiveRegion>
      <Grab />
    </LiveRegion>,
  );
  return () => container.querySelector('[aria-live="polite"]')?.textContent;
}

it("joins messages announced in the same tick", () => {
  const region = setup();
  act(() => {
    announce("Controller stale");
    announce("Vision stale");
  });
  act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS));
  expect(region()).toBe("Controller stale. Vision stale");
});

it("clears the region first, so a repeat is re-read", () => {
  const region = setup();
  act(() => announce("Controller stale"));
  act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS));
  expect(region()).toBe("Controller stale");

  act(() => announce("Controller stale"));
  expect(region()).toBe("");
  act(() => vi.advanceTimersByTime(ANNOUNCE_DELAY_MS));
  expect(region()).toBe("Controller stale");
});
