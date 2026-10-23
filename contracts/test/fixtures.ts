// The jsonc examples of MQTT contract v1 (spine, Structural Seed), with
// `<uuid>` and `<base64>` filled in. One per topic, keyed like the topic table.

export const UUID_A = "3f1c2a9e-8b7d-4e6f-9a1b-2c3d4e5f6a7b";
export const UUID_B = "0b6a4c1d-2e3f-4a5b-8c6d-7e8f9a0b1c2d";
export const TS = 1793000000000;

/** The start of a JPEG, base64. Not a whole image: the schema never looks inside a crop (AD-11). */
export const BASE64 = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP////8=";

export const examples = {
  "controller/status": { v: 1, online: true, source: "sim" },
  "controller/state": {
    v: 1,
    level: "L1",
    signals: { NS: "GREEN", EW: "RED" },
    flood: "DRY",
    fault: false,
    override: { mode: "NONE", commandId: UUID_A },
    remainingS: 12,
    power: "USB",
  },
  "controller/override/ack": { v: 1, commandId: UUID_A, result: "APPLIED" },
  "controller/override/cmd": {
    v: 1,
    commandId: UUID_A,
    ts: TS,
    mode: "CORRIDOR",
    phase: "EW",
  },
  "vision/status": { v: 1, online: true, source: "sim" },
  "vision/heartbeat": {
    v: 1,
    ts: TS,
    seq: 812,
    ok: true,
    confidence: 0.91,
    fps: 17.2,
  },
  "vision/demand": { v: 1, ts: TS, pcu: { N: 2.5, S: 0, E: 1.0, W: 0.5 } },
  "vision/counts": {
    v: 1,
    id: UUID_A,
    ts: TS,
    crossings: [{ approach: "N", vehicleClass: "tricycle", count: 2 }],
  },
  "vision/breach": {
    v: 1,
    id: UUID_A,
    ts: TS,
    approach: "E",
    vehicleClass: "motorcycle",
    centroid: { x: 0.42, y: 0.61 },
    crop: { mime: "image/jpeg", data: BASE64 },
  },
  "vision/speed-alert": {
    v: 1,
    id: UUID_A,
    ts: TS,
    approach: "W",
    vehicleClass: "car",
    elapsedMs: 640,
    thresholdMs: 800,
  },
} as const;

/** The variants the jsonc comments describe. */
export const variantExamples = {
  "controller/status": [{ v: 1, online: false, source: "live", bootCount: 42 }],
  "controller/state": [
    {
      ...examples["controller/state"],
      override: { mode: "CORRIDOR", phase: "NS", commandId: UUID_A },
    },
  ],
  "controller/override/ack": [
    { v: 1, commandId: UUID_A, result: "REJECTED", reason: "CONFLICT_FAULT" },
  ],
  "controller/override/cmd": [
    { v: 1, commandId: UUID_B, ts: TS, mode: "NONE" },
    { v: 1, commandId: UUID_B, ts: TS, mode: "FLASHING_AMBER" },
  ],
} as const;
