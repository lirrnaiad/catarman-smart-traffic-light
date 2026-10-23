import { createApp } from "./app.ts";
import { config, HOST, PORT } from "./config.ts";
import { createPool } from "./db/pool.ts";
import { jobs } from "./jobs/index.ts";
import { connectMqtt, createMqttClient } from "./mqtt/client.ts";
import { handlers } from "./mqtt/handlers/index.ts";
import { createPublisher } from "./mqtt/publisher.ts";
import { createLink } from "./services/link.ts";
import { createHub } from "./sse/hub.ts";

// Composition root; boot order per AD-14.
const pool = createPool(config.DATABASE_URL);
const hub = createHub({ validate: "log" });
const link = createLink(hub);
const client = createMqttClient(config.MQTT_URL, config.MQTT_PASSWORD); // not connected yet
const publisher = createPublisher(client, config.INTERSECTION_ID);
const ctx = { pool, hub, publisher, link, getLink: link.get };

for (const job of jobs) await job.start(ctx);

// Registers every MQTT handler, then connects.
connectMqtt(client, { ...ctx, iid: config.INTERSECTION_ID, handlers });

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
    await client.endAsync(true); // force: never wait on in-flight QoS 1 while the broker is down
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
