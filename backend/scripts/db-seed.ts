import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { config } from "../src/config.ts";
import { createPool, type Pool } from "../src/db/pool.ts";

/** Applies every `.sql` file in `dir` in lexical order; returns the file names. */
export async function seed(pool: Pool, dir: string): Promise<string[]> {
  const files = existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".sql"))
        .sort()
    : [];
  if (files.length === 0) console.info(`[db] no seed files in ${dir}`);
  for (const file of files) {
    console.info(`[db] seeding ${file}`);
    await pool.query(readFileSync(join(dir, file), "utf8"));
  }
  return files;
}

// Run only as `npm run db:seed`, not when a test imports seed().
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  const pool = createPool(config.DATABASE_URL, { multipleStatements: true });
  try {
    await seed(pool, fileURLToPath(new URL("../db/seed/", import.meta.url)));
  } catch (err) {
    console.error("[db] seed failed:", err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
