import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { expect, it } from "vitest";
import { AspectLamp } from "./aspect-lamp.tsx";

function litLayer(ui: ReactElement): HTMLElement {
  const el = render(ui).container.querySelector<HTMLElement>("[data-lens]");
  if (!el) throw new Error("no lit layer");
  return el;
}

it("unlit: tinted glass only", () => {
  const l = litLayer(<AspectLamp color="RED" size={20} />);
  expect(l.style.opacity).toBe("0");
  expect(l.className).not.toMatch(/lamp-/);
});

it("lit: glowing and breathing", () => {
  const l = litLayer(<AspectLamp color="GREEN" lit size={64} />);
  expect(l.style.opacity).toBe("1");
  expect(l.className).toMatch(/\blamp-glow\b/);
  expect(l.style.boxShadow).toContain("var(--color-signal-green)");
});

it("flashing: lit with the flash, so reduced motion leaves a steady lit lens", () => {
  const l = litLayer(<AspectLamp color="YELLOW" flashing size={64} />);
  expect(l.style.opacity).toBe("1");
  expect(l.className).toMatch(/\blamp-flash\b/);
  expect(l.className).not.toMatch(/\blamp-glow\b/);
});

it("stale: lit but no glow halo and no breathing", () => {
  const l = litLayer(<AspectLamp color="GREEN" lit stale size={64} />);
  expect(l.style.opacity).toBe("1");
  expect(l.className).not.toMatch(/\blamp-glow\b/);
  expect(l.style.boxShadow).not.toContain("var(--color-signal-green)");
});
