import { type TopicName, type Topics, topics } from "@stl/contracts";
import type { MqttClient } from "mqtt";
import type { z } from "zod";

/** Topics the backend may publish: `publisherRole: 'gateway'` in the table. */
export type GatewayTopic = {
  [T in TopicName]: Topics[T]["publisherRole"] extends "gateway" ? T : never;
}[TopicName];

/** The outbound MQTT adapter. QoS and retain come only from the topic table (AD-5). */
export function createPublisher(
  client: Pick<MqttClient, "publishAsync" | "connected">,
  iid: string,
) {
  return {
    /** Throws on a non-gateway topic, an invalid payload or a disconnected client; nothing is sent then. */
    async publish<T extends GatewayTopic>(
      name: T,
      payload: z.input<Topics[T]["schema"]>,
    ): Promise<void> {
      const topic = topics[name];
      if (topic.publisherRole !== "gateway") {
        throw new Error(`[mqtt] ${name} is not a gateway topic`);
      }
      const body = topic.schema.parse(payload);
      // MQTT.js would queue QoS 1 and send it on reconnect, applying an override late.
      if (!client.connected) throw new Error(`[mqtt] not connected: ${name}`);
      await client.publishAsync(topic.build(iid), JSON.stringify(body), {
        qos: topic.qos,
        retain: topic.retain,
      });
    },
  };
}

export type Publisher = ReturnType<typeof createPublisher>;
