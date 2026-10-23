import { createApp } from "./app.ts";
import { config, HOST, PORT } from "./config.ts";
import { createPool } from "./db/pool.ts";
import { jobs } from "./jobs/index.ts";
import { createHub } from "./sse/hub.ts";

// Composition root; boot order per AD-14.
const pool = createPool(config.DATABASE_URL);
const hub = createHub({ validate: "log" });
const ctx = { pool, hub };

for (const job of jobs) await job.start(ctx);

// Entry 3 (story 1.3) slots in here: register every MQTT handler, then mqtt.connect.

const server = createApp(ctx).listen(PORT, HOST, (err) => {
  if (err) {
    console.error(`[http] cannot listen on ${HOST}:${PORT}:`, err);
    process.exit(1);
  }
  console.info(`[http] listening on http://${HOST}:${PORT}`);
});

let stopping = false;
async function shutdown(signal: string): Promise<void> {
  if (stopping) process.exit(1); // second signal: give up on a hung shutdown
  stopping = true;
  console.info(`[http] ${signal}: shutting down`);
  try {
    for (const job of jobs) await job.stop();
    hub.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  } catch (err) {
    console.error("[http] shutdown failed:", err);
    process.exitCode = 1;
  }
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
