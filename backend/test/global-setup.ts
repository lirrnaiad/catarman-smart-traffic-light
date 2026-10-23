import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Vitest globalSetup: migrate stl_test from backend/.env.test before any test runs (AD-10).
export default function setup(): void {
  execSync("npm run db:migrate:test", {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    stdio: "inherit",
  });
}
