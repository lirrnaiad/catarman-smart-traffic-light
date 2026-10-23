import { z } from "zod";
import { type TopicName, topicNames, topics } from "../src/mqtt/topics.ts";

// Pure: builds the contents of contracts/schema/ without touching the disk.
// generate-schema.ts writes them (AD-4).

/** `controller/override/ack` -> `controller-override-ack.json`. */
export function schemaFileName(topic: TopicName): string {
  return `${topic.replaceAll("/", "-")}.json`;
}

/** `controller/override/ack` -> `ControllerOverrideAck`. */
export function schemaTitle(topic: TopicName): string {
  return topic
    .split(/[/-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function payloadSchema(topic: TopicName): Record<string, unknown> {
  const { $schema, description, ...rest } = z.toJSONSchema(
    topics[topic].schema,
    { io: "input" },
  );
  const lead = `Payload of stl/<iid>/${topic}, MQTT contract v1.`;
  return {
    $schema,
    title: schemaTitle(topic),
    description: description ? `${lead} ${description}` : lead,
    ...rest,
  };
}

function topicTable(): Record<string, unknown> {
  return Object.fromEntries(
    topicNames.map((topic) => {
      const { pattern, qos, retain, publisherRole } = topics[topic];
      return [
        topic,
        { pattern, qos, retain, publisherRole, schema: schemaFileName(topic) },
      ];
    }),
  );
}

/** Every file in contracts/schema/, keyed by file name, as its exact text. */
export function schemaFiles(): Map<string, string> {
  const files = new Map<string, string>();
  for (const topic of topicNames) {
    files.set(schemaFileName(topic), serialize(payloadSchema(topic)));
  }
  files.set("topics.json", serialize(topicTable()));
  return files;
}

export function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}
