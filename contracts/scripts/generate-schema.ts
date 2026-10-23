import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { schemaFiles } from "./schema-files.ts";

// npm run contracts:schema: regenerates contracts/schema/ for Squads A and B (AD-4).

const dir = fileURLToPath(new URL("../schema/", import.meta.url));
const files = schemaFiles();

mkdirSync(dir, { recursive: true });
for (const name of readdirSync(dir)) {
  if (name.endsWith(".json") && !files.has(name)) {
    rmSync(join(dir, name));
  }
}
for (const [name, text] of files) {
  writeFileSync(join(dir, name), text);
}
console.info(`[schema] wrote ${files.size} files to contracts/schema/`);
