import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LiveTestProvider } from "../../lib/live/live-test-provider.tsx";
import { simLink, state } from "./fixtures.ts";
import { Frame } from "./frame.tsx";

const path = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

it("shows the loader until the first frame, then the bars", () => {
  const view = render(
    <LiveTestProvider>
      <Frame>content</Frame>
    </LiveTestProvider>,
  );
  expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  expect(screen.getByText("Connecting to INT-01")).toBeTruthy();
  // The frame is behind the loader and inert, so focus and readers can't reach it.
  expect(screen.getByText("content").closest("[inert]")).not.toBeNull();

  view.rerender(
    <LiveTestProvider slices={{ link: simLink }}>
      <Frame>content</Frame>
    </LiveTestProvider>,
  );
  expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
  expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
  expect(screen.getByRole("status", { name: "Link health" })).toBeTruthy();
  expect(screen.getByText("content").closest("[inert]")).toBeNull();
});

it("a null slice is a first frame too", () => {
  render(
    <LiveTestProvider slices={{ state: null }}>
      <Frame>content</Frame>
    </LiveTestProvider>,
  );
  expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
});

it("has one polite live region", () => {
  const { container } = render(
    <LiveTestProvider>
      <Frame>content</Frame>
    </LiveTestProvider>,
  );
  expect(container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
});

it.each([
  ["link", { link: simLink }],
  ["state", { state }],
  ["counts", { counts: null }],
  ["demand", { demand: null }],
] as const)("a first %s frame alone clears the loader", (_, slices) => {
  render(
    <LiveTestProvider slices={slices}>
      <Frame>content</Frame>
    </LiveTestProvider>,
  );
  expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
});

it.each([
  ["/", "overflow-hidden"],
  ["/traffic/", "overflow-y-auto"],
])("on %s the content area is %s", (at, overflow) => {
  path.current = at;
  render(
    <LiveTestProvider slices={{ link: simLink }}>
      <Frame>content</Frame>
    </LiveTestProvider>,
  );
  const main = screen.getByRole("main");
  expect(main.className).toContain("h-grid-height");
  expect(main.className.split(" ")).toContain(overflow);
  path.current = "/";
});
