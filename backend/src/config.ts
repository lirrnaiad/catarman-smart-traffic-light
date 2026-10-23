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
  MQTT_URL: z
    .url({ protocol: /^(mqtt|mqtts|ws|wss)$/ })
    .default("mqtt://127.0.0.1:1883"),
  /** The `<iid>` in every topic `stl/<iid>/...`; lower case, words joined by `-` or `_`. */
  INTERSECTION_ID: z
    .string()
    .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/)
    .default("int-01"),
  /** Sent with the username `stl-backend` when set (AD-15); the local broker is anonymous. */
  MQTT_PASSWORD: z
    .string()
    .optional()
    .transform((s) => s || undefined),
});

export const config = Object.freeze(Env.parse(process.env));

/** Express binds localhost only (AD-15). */
export const HOST = "127.0.0.1";
export const PORT = 4000;
