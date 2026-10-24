import { Level } from "@stl/contracts";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { levelVisuals } from "../../lib/visuals.ts";
import { LevelBadge } from "./level-badge.tsx";

it("every level shows its code, its own pattern and its name", () => {
  const looks = new Set<string>();
  for (const level of Level.options) {
    const { unmount } = render(<LevelBadge level={level} />);
    const badge = screen.getByRole("img", { name: levelVisuals[level].label });
    expect(badge.textContent).toBe(level);
    looks.add(`${badge.className}|${badge.getAttribute("style")}`);
    unmount();
  }
  expect(looks.size).toBe(4);
});
