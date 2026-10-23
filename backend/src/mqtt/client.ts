import { topicNames, topics } from "@stl/contracts";
import mqtt, { type MqttClient } from "mqtt";
import type { Handler, HandlerCtx } from "./handlers/index.ts";

/** The one backend MQTT link (AD-5). Created unconnected; `connectMqtt` connects it (AD-14). */
export function createMqttClient(url: string, password?: string): MqttClient {
  return mqtt.connect(url, {
    clientId: "stl-backend",
    username: "stl-backend",
    password,
    clean: false,
    keepalive: 5,
    protocolVersion: 4,
    reconnectOnConnackError: true,
    manualConnect: true,
  });
}

export type DispatchDeps = Omit<HandlerCtx, "receivedAt" | "retained"> & {
  iid: string;
  handlers: readonly Handler[];
};

/**
 * One inbound message, broker-free: parse it (AD-4), then run every handler
 * for its topic, each isolated. Never logs the payload (Privacy).
 */
export async function dispatch(
  topic: string,
  payload: Buffer | string,
  retained: boolean,
  { iid, handlers, ...core }: DispatchDeps,
): Promise<void> {
  const receivedAt = Date.now();
  if (payload.length === 0) return; // an empty retained message clears the topic
  const name = topicNames.find((n) => topics[n].build(iid) === topic);
  if (!name) return;

  let json: unknown;
  try {
    json = JSON.parse(payload.toString());
  } catch {
    console.warn(`[mqtt] dropped ${topic}: invalid JSON`);
    return;
  }
  const result = topics[name].schema.safeParse(json);
  if (!result.success) {
    const paths = result.error.issues.map((i) => i.path.join(".") || "(root)");
    console.warn(`[mqtt] dropped ${topic}: invalid ${paths.join(", ")}`);
    return;
  }

  const ctx: HandlerCtx = { ...core, receivedAt, retained };
  await Promise.all(
    handlers
      .filter((h) => h.topic === name)
      .map(async (h) => {
        try {
          // The registry is a union over topics; `name` already matched this handler's topic.
          await (h.handle as (p: unknown, c: HandlerCtx) => unknown)(
            result.data,
            ctx,
          );
        } catch (err) {
          console.error(`[mqtt] handler for ${topic} failed:`, err);
        }
      }),
  );
}

/** Wires link health, subscriptions and dispatch, then connects (AD-5, AD-15). */
export function connectMqtt(client: MqttClient, deps: DispatchDeps): void {
  // Not our own gateway topics, or every published command would echo back.
  const subscriptions = Object.fromEntries(
    topicNames
      .filter((n) => topics[n].publisherRole !== "gateway")
      .map((n) => [topics[n].build(deps.iid), { qos: topics[n].qos }]),
  );
  client.on("connect", () => {
    console.info("[mqtt] connected");
    deps.link.setBroker("CONNECTED");
    // clean:false keeps subscriptions, but a broker that lost the session needs them again.
    client.subscribe(subscriptions, (err) => {
      if (err) console.error("[mqtt] subscribe failed:", err.message);
    });
  });
  client.on("close", () => deps.link.setBroker("DISCONNECTED"));
  client.on("error", (err) => console.error("[mqtt] error:", err.message));
  client.on("message", (topic, payload, packet) => {
    void dispatch(topic, payload, packet.retain, deps);
  });
  client.connect();
}
