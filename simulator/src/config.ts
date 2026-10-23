import { z } from "zod";

// The only file that reads process.env (AD-15). Tests (VITEST) never load .env.
if (!process.env.VITEST) {
  try {
    process.loadEnvFile(new URL("../.env", import.meta.url));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

const Env = z.object({
  MQTT_URL: z
    .url({ protocol: /^(mqtt|mqtts|ws|wss)$/ })
    .default("mqtt://127.0.0.1:1883"),
  /** The `<iid>` in every topic `stl/<iid>/...`; lower case, words joined by `-` or `_`. */
  INTERSECTION_ID: z
    .string()
    .regex(/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/)
    .default("int-01"),
  /** Shared by the sim users (AD-15); sent only when set. The local broker is anonymous. */
  MQTT_PASSWORD: z
    .string()
    .optional()
    .transform((s) => s || undefined),
});

export const config = Object.freeze(Env.parse(process.env));
export type Config = typeof config;
