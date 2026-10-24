import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { TopBar } from "./top-bar.tsx";

const path = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

it("links the five routes and marks only the current one", () => {
  path.current = "/breaches/";
  render(<TopBar />);
  const links = screen.getAllByRole("link");
  // next/link adds the trailing slash only in a build with `trailingSlash: true`.
  const href = (a: HTMLElement) =>
    (a.getAttribute("href") ?? "").replace(/\/?$/, "/");
  expect(links.map((a) => [a.textContent, href(a)])).toEqual([
    ["Live", "/"],
    ["Traffic peaks", "/traffic/"],
    ["Breaches", "/breaches/"],
    ["Override log", "/log/overrides/"],
    ["State history", "/log/states/"],
  ]);
  const current = links.filter((a) => a.getAttribute("aria-current"));
  expect(current.map((a) => a.textContent)).toEqual(["Breaches"]);
  expect(current[0]?.getAttribute("aria-current")).toBe("page");
});

it("matches a route without its trailing slash", () => {
  path.current = "/log/states";
  render(<TopBar />);
  expect(
    screen
      .getByRole("link", { name: "State history" })
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(
    screen.getByRole("link", { name: "Live" }).getAttribute("aria-current"),
  ).toBeNull();
});

it("shows the brand, sub-line and INT-01 plate", () => {
  render(<TopBar />);
  expect(screen.getByText("Catarman SMART Traffic Light")).toBeTruthy();
  expect(
    screen.getByText("Edge-only adaptive signal · Catarman, Northern Samar"),
  ).toBeTruthy();
  expect(screen.getByText("INT-01")).toBeTruthy();
});
