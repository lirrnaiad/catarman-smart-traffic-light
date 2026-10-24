import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const css = readFileSync(
  join(import.meta.dirname, "motion.css"),
  "utf8",
).replace(/\/\*[\s\S]*?\*\//g, "");

/** Splits the CSS into the `no-preference` block and everything outside it. */
function split(): { inside: string; outside: string } {
  const open = "@media (prefers-reduced-motion: no-preference) {";
  const start = css.indexOf(open);
  if (start < 0) throw new Error("no no-preference block");
  let depth = 0;
  for (let i = start + open.length - 1; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0)
      return {
        inside: css.slice(start, i + 1),
        outside: css.slice(0, start) + css.slice(i + 1),
      };
  }
  throw new Error("unclosed media block");
}

it("under reduced motion nothing runs: every rule sits inside the media query", () => {
  const { inside, outside } = split();
  expect(outside.trim()).toBe("");
  expect([...inside.matchAll(/@keyframes ([\w-]+)/g)].map((m) => m[1])).toEqual(
    ["lamp-glow", "amber-flash", "loader-seq", "loader-text"],
  );
});
