import type { Aspect } from "@stl/contracts";
import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { SignalHead } from "./signal-head.tsx";

function lit(aspect: Aspect, stale = false) {
  const { container } = render(
    <SignalHead aspect={aspect} size={20} label="Phase NS" stale={stale} />,
  );
  return [...container.querySelectorAll<HTMLElement>("[data-lens]")]
    .filter((l) => l.style.opacity === "1")
    .map((l) => ({ lens: l.dataset.lens, cls: l.className }));
}

it.each([
  ["RED", "RED"],
  ["YELLOW", "YELLOW"],
  ["GREEN", "GREEN"],
] as const)("%s lights exactly the %s lens, glowing", (aspect, lens) => {
  const on = lit(aspect);
  expect(on.map((l) => l.lens)).toEqual([lens]);
  expect(on[0]?.cls).toMatch(/\blamp-glow\b/);
});

it("FLASHING_AMBER flashes the yellow lens only", () => {
  const on = lit("FLASHING_AMBER");
  expect(on.map((l) => l.lens)).toEqual(["YELLOW"]);
  expect(on[0]?.cls).toMatch(/\blamp-flash\b/);
});

it("DARK lights no lens", () => {
  expect(lit("DARK")).toEqual([]);
});

it("keeps red over yellow over green and is labeled", () => {
  const { container, getByRole } = render(
    <SignalHead aspect="GREEN" size={20} label="Phase NS: green" />,
  );
  expect(
    [...container.querySelectorAll<HTMLElement>("[data-lens]")].map(
      (l) => l.dataset.lens,
    ),
  ).toEqual(["RED", "YELLOW", "GREEN"]);
  expect(getByRole("img", { name: "Phase NS: green" })).toBeTruthy();
});

it("stale: still lit, no breathing", () => {
  const on = lit("GREEN", true);
  expect(on.map((l) => l.lens)).toEqual(["GREEN"]);
  expect(on[0]?.cls).not.toMatch(/\blamp-glow\b/);
});

it("stale FLASHING_AMBER: yellow lens steady lit, no flash", () => {
  const on = lit("FLASHING_AMBER", true);
  expect(on.map((l) => l.lens)).toEqual(["YELLOW"]);
  expect(on[0]?.cls).not.toMatch(/\blamp-flash\b/);
  expect(on[0]?.cls).not.toMatch(/\blamp-glow\b/);
});
