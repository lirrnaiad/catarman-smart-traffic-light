import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// contracts/src/ is bundled by the dashboard: it imports only zod and its own
// files, with the .ts extension (AD-4, AD-13).

const src = fileURLToPath(new URL("../src/", import.meta.url));
const files = (readdirSync(src, { recursive: true }) as string[])
  .filter((file) => file.endsWith(".ts"))
  .map((file) => join(src, file));

// `import … from "x"`, `export … from "x"` and the side-effect `import "x"`.
const specifier = /(?:^|\s)(?:import|export)\s(?:[^;]*?\sfrom\s*)?"([^"]+)"/g;

describe("contracts/src import fence", () => {
  it("finds the source files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((file) => [relative(src, file), file]))(
    "%s imports only zod and relative .ts files",
    (_name, file) => {
      const text = readFileSync(file, "utf8");
      for (const [, spec] of text.matchAll(specifier)) {
        if (spec === "zod") continue;
        expect(spec).toMatch(/^\.\.?\/.*\.ts$/);
      }
      expect(text).not.toMatch(/\brequire\(|\bimport\(/);
    },
  );
});
