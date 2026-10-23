import { describe, expect, it } from "vitest";
import {
  schemaFileName,
  schemaFiles,
  schemaTitle,
} from "../scripts/schema-files.ts";
import { topicNames, topics } from "../src/index.ts";

const files = schemaFiles();

function walk(value: unknown, visit: (node: Record<string, unknown>) => void) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
  } else if (value !== null && typeof value === "object") {
    visit(value as Record<string, unknown>);
    for (const child of Object.values(value)) walk(child, visit);
  }
}

describe("generated JSON Schema", () => {
  it("has one file per MQTT payload plus topics.json", () => {
    expect([...files.keys()].sort()).toEqual(
      [...topicNames.map(schemaFileName), "topics.json"].sort(),
    );
  });

  it.each([...files])(
    "%s has no additionalProperties: false",
    (_name, text) => {
      walk(JSON.parse(text), (node) => {
        expect(node.additionalProperties).not.toBe(false);
      });
    },
  );

  it.each(topicNames)(
    "%s has a title and is 2-space JSON with a newline",
    (topic) => {
      const text = files.get(schemaFileName(topic)) ?? "";
      const schema = JSON.parse(text);
      expect(schema.title).toBe(schemaTitle(topic));
      expect(schema.$schema).toBe(
        "https://json-schema.org/draft/2020-12/schema",
      );
      expect(text).toBe(`${JSON.stringify(schema, null, 2)}\n`);
    },
  );

  it("topics.json carries pattern, QoS, retain, publisher role and schema file", () => {
    const table = JSON.parse(files.get("topics.json") ?? "{}");
    expect(Object.keys(table)).toEqual(topicNames);
    for (const topic of topicNames) {
      const { pattern, qos, retain, publisherRole } = topics[topic];
      expect(table[topic]).toEqual({
        pattern,
        qos,
        retain,
        publisherRole,
        schema: schemaFileName(topic),
      });
    }
  });

  it("titles are PascalCase topic names", () => {
    expect(schemaTitle("controller/override/ack")).toBe(
      "ControllerOverrideAck",
    );
    expect(schemaTitle("vision/speed-alert")).toBe("VisionSpeedAlert");
  });

  it("keeps the AD-11 crop limits in the breach description for Squad B", () => {
    const breach = JSON.parse(files.get("vision-breach.json") ?? "{}");
    expect(breach.properties.crop.description).toContain("64 px");
    expect(breach.properties.crop.description).toContain("204,800");
    expect(breach.required).not.toContain("crop");
  });
});
