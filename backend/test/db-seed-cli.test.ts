import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, expect, it } from "vitest";
import { config } from "../src/config.ts";
import { createPool } from "../src/db/pool.ts";
import { resetDb } from "./reset-db.ts";

// Runs `npm run db:seed`'s command as a child process: the CLI branch builds its own
// multi-statement pool and sets the exit code. An explicit DATABASE_URL wins over
// the env files, because process.loadEnvFile never overrides a variable already set.
const backendDir = fileURLToPath(new URL("..", import.meta.url));
// The repo's tsx, the file node_modules/.bin/tsx links to; run through node so it
// spawns the same way on Windows, where .bin/tsx is a shell shim.
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");

const pool = createPool(config.DATABASE_URL);

beforeEach(() => resetDb(pool));
afterAll(async () => {
  await resetDb(pool);
  await pool.end();
});

function seedCli(
  databaseUrl: string,
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCli, "scripts/db-seed.ts"], {
      cwd: backendDir,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (s: string) => {
      stdout += s;
    });
    child.stderr.setEncoding("utf8").on("data", (s: string) => {
      stderr += s;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

it("applies the multi-statement seed files to the database and exits 0", async () => {
  const { code, stdout, stderr } = await seedCli(config.DATABASE_URL);
  expect(stderr).toBe("");
  expect(code).toBe(0);
  expect(stdout).toContain("[db] seeding 01-vehicle_count.sql");
  const [rows] = await pool.query("SELECT COUNT(*) AS n FROM vehicle_count");
  expect(Number((rows as Array<{ n: number }>)[0].n)).toBe(288 * 4 * 5);
}, 30_000);

it("exits 1 and logs [db] seed failed when the database is unreachable", async () => {
  const { code, stderr } = await seedCli(
    "mysql://stl:stl@127.0.0.1:1/stl_test",
  );
  expect(code).toBe(1);
  expect(stderr).toContain("[db] seed failed");
}, 30_000);
