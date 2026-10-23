import { describe, expect, it } from "vitest";
import { topicNames, topics } from "../src/index.ts";

// MQTT contract v1 as the spine's table states it. The backend is the gateway role.
const spine = [
  ["controller/status", "controller", 0, true],
  ["controller/state", "controller", 0, true],
  ["controller/override/ack", "controller", 0, false],
  ["controller/override/cmd", "gateway", 1, false],
  ["vision/status", "vision", 1, true],
  ["vision/heartbeat", "vision", 0, false],
  ["vision/demand", "vision", 0, false],
  ["vision/counts", "vision", 1, false],
  ["vision/breach", "vision", 1, false],
  ["vision/speed-alert", "vision", 0, false],
] as const;

describe("topic table", () => {
  it("has exactly the spine's topics, in its order", () => {
    expect(topicNames).toEqual(spine.map(([topic]) => topic));
  });

  it.each(spine)(
    "%s: publisher %s, QoS %i, retained %s",
    (topic, publisherRole, qos, retain) => {
      expect(topics[topic]).toMatchObject({ publisherRole, qos, retain });
    },
  );

  it.each(topicNames)("%s builds and matches stl/<iid>/…", (topic) => {
    expect(topics[topic].build("int-01")).toBe(`stl/int-01/${topic}`);
    expect(topics[topic].pattern).toBe(`stl/+/${topic}`);
  });

  it("retains only the two statuses and controller/state", () => {
    expect(topicNames.filter((topic) => topics[topic].retain)).toEqual([
      "controller/status",
      "controller/state",
      "vision/status",
    ]);
  });

  it("has the controller publish only at QoS 0 (AD-5)", () => {
    for (const topic of topicNames) {
      if (topics[topic].publisherRole === "controller") {
        expect(topics[topic].qos).toBe(0);
      }
    }
  });
});
