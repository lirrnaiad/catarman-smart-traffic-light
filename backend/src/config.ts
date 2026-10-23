import { z } from "zod";

// The only file that reads process.env (AD-15). Vitest sets VITEST, so tests use .env.test.
const envFile = new URL(
  process.env.VITEST ? "../.env.test" : "../.env",
  import.meta.url,
);
try {
  process.loadEnvFile(envFile);
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
}

const Env = z.object({
  DATABASE_URL: z.url(),
  DASHBOARD_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://127.0.0.1:3000")
    .transform((s) =>
      Object.freeze(
        s
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      ),
    ),
});

export const config = Object.freeze(Env.parse(process.env));

/** Express binds localhost only (AD-15). */
export const HOST = "127.0.0.1";
export const PORT = 4000;
