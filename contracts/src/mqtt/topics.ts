import { ControllerOverrideAck } from "./controller-override-ack.ts";
import { ControllerOverrideCmd } from "./controller-override-cmd.ts";
import { ControllerState } from "./controller-state.ts";
import { ControllerStatus } from "./controller-status.ts";
import { VisionBreach } from "./vision-breach.ts";
import { VisionCounts } from "./vision-counts.ts";
import { VisionDemand } from "./vision-demand.ts";
import { VisionHeartbeat } from "./vision-heartbeat.ts";
import { VisionSpeedAlert } from "./vision-speed-alert.ts";
import { VisionStatus } from "./vision-status.ts";

/**
 * MQTT contract v1 (spine, Structural Seed). The only source of topic strings,
 * QoS and retain flags (AD-5). Keys are the topic under `stl/<iid>/`; `pattern`
 * matches every intersection; `build(iid)` gives one intersection's topic.
 * `publisherRole` is a Design Paradigm role: controller, vision or gateway.
 */
export const topics = {
  "controller/status": {
    pattern: "stl/+/controller/status",
    build: (iid: string) => `stl/${iid}/controller/status`,
    qos: 0,
    retain: true,
    publisherRole: "controller",
    schema: ControllerStatus,
  },
  "controller/state": {
    pattern: "stl/+/controller/state",
    build: (iid: string) => `stl/${iid}/controller/state`,
    qos: 0,
    retain: true,
    publisherRole: "controller",
    schema: ControllerState,
  },
  "controller/override/ack": {
    pattern: "stl/+/controller/override/ack",
    build: (iid: string) => `stl/${iid}/controller/override/ack`,
    qos: 0,
    retain: false,
    publisherRole: "controller",
    schema: ControllerOverrideAck,
  },
  "controller/override/cmd": {
    pattern: "stl/+/controller/override/cmd",
    build: (iid: string) => `stl/${iid}/controller/override/cmd`,
    qos: 1,
    retain: false,
    publisherRole: "gateway",
    schema: ControllerOverrideCmd,
  },
  "vision/status": {
    pattern: "stl/+/vision/status",
    build: (iid: string) => `stl/${iid}/vision/status`,
    qos: 1,
    retain: true,
    publisherRole: "vision",
    schema: VisionStatus,
  },
  "vision/heartbeat": {
    pattern: "stl/+/vision/heartbeat",
    build: (iid: string) => `stl/${iid}/vision/heartbeat`,
    qos: 0,
    retain: false,
    publisherRole: "vision",
    schema: VisionHeartbeat,
  },
  "vision/demand": {
    pattern: "stl/+/vision/demand",
    build: (iid: string) => `stl/${iid}/vision/demand`,
    qos: 0,
    retain: false,
    publisherRole: "vision",
    schema: VisionDemand,
  },
  "vision/counts": {
    pattern: "stl/+/vision/counts",
    build: (iid: string) => `stl/${iid}/vision/counts`,
    qos: 1,
    retain: false,
    publisherRole: "vision",
    schema: VisionCounts,
  },
  "vision/breach": {
    pattern: "stl/+/vision/breach",
    build: (iid: string) => `stl/${iid}/vision/breach`,
    qos: 1,
    retain: false,
    publisherRole: "vision",
    schema: VisionBreach,
  },
  "vision/speed-alert": {
    pattern: "stl/+/vision/speed-alert",
    build: (iid: string) => `stl/${iid}/vision/speed-alert`,
    qos: 0,
    retain: false,
    publisherRole: "vision",
    schema: VisionSpeedAlert,
  },
} as const;

export type Topics = typeof topics;
export type TopicName = keyof Topics;
export type PublisherRole = Topics[TopicName]["publisherRole"];
export const topicNames = Object.keys(topics) as TopicName[];
