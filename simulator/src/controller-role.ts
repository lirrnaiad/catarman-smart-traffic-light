import {
  type Aspect,
  type ControllerOverrideAck,
  type ControllerOverrideCmd,
  type ControllerState,
  type ControllerStatus,
  type Flood,
  type Level,
  type Phase,
  type StateOverride,
  topics,
  type VisionHeartbeat,
} from "@stl/contracts";
import mqtt from "mqtt";
import type { z } from "zod";
import type { Behavior } from "./behaviors/index.ts";
import type { Config } from "./config.ts";

// Diorama timings (degradation-levels.md). Green is fixed in M1 (AD-3).
export const GREEN_MS = 10_000;
export const YELLOW_MS = 3_000;
export const ALL_RED_MS = 2_000;
const VISION_LOSS_MS = 3_000;
const RECOVERY_MS = 5_000;
const FLOOD_ENTRY_MS = 5_000;
const FLOOD_EXIT_MS = 30_000;
const CORRIDOR_LINK_HOLD_MS = 60_000;

type Interval = {
  kind: "GREEN" | "YELLOW" | "ALL_RED" | "FLASH";
  phase: Phase;
  endsAt: number;
};

const other = (p: Phase): Phase => (p === "NS" ? "EW" : "NS");

/**
 * The broker-free controller state machine. Every input takes an explicit
 * `now`; signaling never waits on the broker (AD-18).
 */
export function createController(
  now: number,
  behaviors: readonly Behavior[] = [],
) {
  let interval: Interval = {
    kind: "GREEN",
    phase: "NS",
    endsAt: now + GREEN_MS,
  };
  let lastOkHeartbeat: number | undefined;
  let sensorFault = false;
  let water = false;
  let waterSince = now; // when `water` last changed
  let flood: Flood = "DRY";
  let fault = false;
  let forcedLevel: Level | undefined;
  let linkLostAt: number | undefined;
  let override: StateOverride | undefined;
  let draining = false; // a released corridor runs out through yellow and all-red before L4 flashes

  const target = (t: number): Level =>
    flood === "FLOODED"
      ? "L4"
      : sensorFault
        ? "L3"
        : lastOkHeartbeat === undefined || t - lastOkHeartbeat >= VISION_LOSS_MS
          ? "L2"
          : "L1";
  let autoLevel = target(now);
  let targetLevel = autoLevel;
  let targetSince = now;

  const level = () => forcedLevel ?? autoLevel;
  const corridor = () =>
    override?.mode === "CORRIDOR" ? override.phase : undefined;
  // An override outranks every level, L4 included (AD-7); a fault outranks overrides.
  const flashing = () =>
    fault ||
    override?.mode === "FLASHING_AMBER" ||
    (level() === "L4" && !corridor() && !draining);
  const releaseCorridor = (commandId: string) => {
    override = { mode: "NONE", commandId };
    draining = true;
  };

  function step(t: number): void {
    if (flood === "WET" && t - waterSince >= FLOOD_ENTRY_MS) flood = "FLOODED";
    if (flood === "FLOODED" && !water && t - waterSince >= FLOOD_EXIT_MS)
      flood = "DRY";

    if (
      override?.mode === "CORRIDOR" &&
      linkLostAt !== undefined &&
      t - linkLostAt >= CORRIDOR_LINK_HOLD_MS
    )
      releaseCorridor(override.commandId);

    const next = target(t);
    if (next !== targetLevel) {
      targetLevel = next;
      targetSince = t;
    }
    // L1 < L2 < L3 < L4 as strings. Dropping is immediate; L4 exits on its own 30 s dry hold.
    if (next > autoLevel || autoLevel === "L4") autoLevel = next;

    if (flashing()) {
      if (interval.kind !== "FLASH")
        interval = { kind: "FLASH", phase: interval.phase, endsAt: Infinity };
    } else if (interval.kind === "FLASH") {
      interval = {
        kind: "ALL_RED",
        phase: interval.phase,
        endsAt: t + ALL_RED_MS,
      };
    } else if (interval.kind === "GREEN") {
      const c = corridor();
      if (c === interval.phase) interval.endsAt = Infinity;
      else if (c || interval.endsAt === Infinity)
        interval.endsAt = Math.min(interval.endsAt, t);
    }

    while (interval.endsAt <= t) {
      const { kind, phase, endsAt } = interval;
      if (kind === "GREEN")
        interval = { kind: "YELLOW", phase, endsAt: endsAt + YELLOW_MS };
      else if (kind === "YELLOW")
        interval = { kind: "ALL_RED", phase, endsAt: endsAt + ALL_RED_MS };
      else {
        const c = corridor();
        draining = false;
        if (flashing()) {
          interval = { kind: "FLASH", phase, endsAt: Infinity };
          break;
        }
        interval = {
          kind: "GREEN",
          phase: c ?? other(phase),
          endsAt: c ? Infinity : endsAt + GREEN_MS,
        };
      }
    }

    // Climbing waits for 5 s clear, then the next all-red, so a green is never cut short.
    // FLASH and a held corridor green have no all-red ahead, so they climb in place.
    if (
      (interval.kind === "ALL_RED" ||
        interval.kind === "FLASH" ||
        interval.endsAt === Infinity) &&
      targetLevel < autoLevel &&
      t - targetSince >= RECOVERY_MS
    )
      autoLevel = targetLevel;
  }

  function state(): ControllerState {
    const { kind, phase } = interval;
    const own: Aspect =
      kind === "FLASH"
        ? "FLASHING_AMBER"
        : kind === "GREEN"
          ? "GREEN"
          : kind === "YELLOW"
            ? "YELLOW"
            : "RED";
    const opp: Aspect = kind === "FLASH" ? "FLASHING_AMBER" : "RED";
    const s: ControllerState = {
      v: 1,
      level: level(),
      signals: phase === "NS" ? { NS: own, EW: opp } : { NS: opp, EW: own },
      flood,
      fault,
      ...(override && { override }),
    };
    return Object.assign(s, ...behaviors.map((b) => b.state?.(s)));
  }

  return {
    step,
    state,
    onHeartbeat(hb: VisionHeartbeat, retained: boolean, t: number): void {
      if (!retained && hb.ok) lastOkHeartbeat = t;
      step(t);
    },
    onCommand(cmd: ControllerOverrideCmd, t: number): ControllerOverrideAck {
      const { commandId } = cmd;
      if (cmd.mode === "CORRIDOR" && fault)
        return {
          v: 1,
          commandId,
          result: "REJECTED",
          reason: "CONFLICT_FAULT",
        };
      if (cmd.mode === "NONE" && override?.mode === "CORRIDOR")
        releaseCorridor(commandId);
      else
        override =
          cmd.mode === "CORRIDOR"
            ? { mode: "CORRIDOR", phase: cmd.phase, commandId }
            : { mode: cmd.mode, commandId };
      step(t);
      return { v: 1, commandId, result: "APPLIED" };
    },
    setSensorFault(on: boolean, t: number): void {
      sensorFault = on;
      step(t);
    },
    setFlood(on: boolean, t: number): void {
      if (on !== water) {
        water = on;
        waterSince = t;
        if (on && flood === "DRY") flood = "WET";
        if (!on && flood === "WET") flood = "DRY";
      }
      step(t);
    },
    raiseConflict(t: number): void {
      fault = true;
      draining = false; // the fault flashes at once; nothing runs out
      // A fault ends a corridor for good (degradation-levels.md).
      if (override?.mode === "CORRIDOR")
        override = { mode: "NONE", commandId: override.commandId };
      step(t);
    },
    resetConflict(t: number): void {
      fault = false;
      step(t);
    },
    /** `undefined` returns to the automatic level. */
    setForcedLevel(l: Level | undefined, t: number): void {
      forcedLevel = l;
      step(t);
    },
    setLinkUp(up: boolean, t: number): void {
      if (up) linkLostAt = undefined;
      else linkLostAt ??= t;
      step(t);
    },
  };
}

export type Controller = ReturnType<typeof createController>;

/** Skip a cleared topic, then JSON, then the schema; warn with issue paths only, never the body. */
export function parsePayload<T>(
  schema: z.ZodType<T>,
  topic: string,
  payload: Buffer,
): T | undefined {
  if (payload.length === 0) return undefined;
  let json: unknown;
  try {
    json = JSON.parse(payload.toString());
  } catch {
    console.warn(`[sim] dropped ${topic}: invalid JSON`);
    return undefined;
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const paths = result.error.issues.map((i) => i.path.join(".") || "(root)");
    console.warn(`[sim] dropped ${topic}: invalid ${paths.join(", ")}`);
    return undefined;
  }
  return result.data;
}

const CLIENT_ID = "stl-sim-controller";
const START_CHECK_MS = 5_000;
const ONLINE_REPEAT_MS = 10_000;
// The 100 ms tick would otherwise overshoot the 2 s floor.
const STATE_EVERY_MS = 1_900;

/** The controller role on its own MQTT link (AD-5, AD-18). */
export function startControllerRole({
  config,
  force,
  behaviors,
}: {
  config: Config;
  force: boolean;
  behaviors: readonly Behavior[];
}) {
  const iid = config.INTERSECTION_ID;
  const statusT = topics["controller/status"];
  const stateT = topics["controller/state"];
  const ackT = topics["controller/override/ack"];
  const cmdT = topics["controller/override/cmd"];
  const hbT = topics["vision/heartbeat"];
  const statusTopic = statusT.build(iid);
  const stateTopic = stateT.build(iid);

  const controller = createController(Date.now(), behaviors);
  const status = (online: boolean) => {
    const s: ControllerStatus = { v: 1, online, source: "sim" };
    return JSON.stringify(
      Object.assign(s, ...behaviors.map((b) => b.status?.(s))),
    );
  };

  const client = mqtt.connect(config.MQTT_URL, {
    clientId: CLIENT_ID,
    username: CLIENT_ID,
    password: config.MQTT_PASSWORD,
    clean: true,
    keepalive: 5,
    protocolVersion: 4,
    reconnectOnConnackError: true,
    queueQoSZero: false,
    will: {
      topic: statusTopic,
      payload: Buffer.from(status(false)),
      qos: statusT.qos,
      retain: statusT.retain,
    },
  });

  let checked = force; // the start check passed, or --force skipped it
  let firstConnect = true;
  let lastState: string | undefined;
  let lastStateAt = 0;
  let checkTimer: NodeJS.Timeout | undefined;
  let onlineTimer: NodeJS.Timeout | undefined;

  const publish = (
    topic: string,
    body: string,
    qos: 0 | 1,
    retain: boolean,
  ) => {
    if (client.connected) client.publish(topic, body, { qos, retain });
  };
  const publishStatus = () =>
    publish(statusTopic, status(true), statusT.qos, statusT.retain);
  const goOnline = () => {
    publishStatus();
    clearTimeout(onlineTimer);
    onlineTimer = setTimeout(publishStatus, ONLINE_REPEAT_MS);
    lastState = undefined; // republish state on the next tick
  };

  const tick = setInterval(() => {
    const now = Date.now();
    controller.step(now);
    if (!checked || !client.connected) return;
    const s = JSON.stringify(controller.state());
    if (s !== lastState || now - lastStateAt >= STATE_EVERY_MS) {
      publish(stateTopic, s, stateT.qos, stateT.retain);
      lastState = s;
      lastStateAt = now;
    }
  }, 100);

  const failStartCheck = (message: string) => {
    if (!checkTimer) return; // already failing
    clearTimeout(checkTimer);
    checkTimer = undefined;
    console.error(`[sim] ${message}; exiting (--force skips this check)`);
    clearInterval(tick);
    // A graceful end sends no LWT, so nothing is published.
    client.end(!client.connected, {}, () => process.exit(1));
  };

  client.on("connect", () => {
    console.info(`[sim] controller connected (stl/${iid})`);
    controller.setLinkUp(true, Date.now());
    const subs: Record<string, { qos: 0 | 1 }> = {
      [hbT.build(iid)]: { qos: hbT.qos },
      [cmdT.build(iid)]: { qos: cmdT.qos },
    };
    const checking = firstConnect && !force;
    if (checking) subs[stateTopic] = { qos: stateT.qos };
    client.subscribe(subs, (err) => {
      if (err) console.error(`[sim] subscribe failed: ${err.message}`);
    });

    if (!firstConnect) {
      if (checked) goOnline();
      return;
    }
    firstConnect = false;
    if (force) {
      // Clear a stale retained status before our own online:true.
      client.publish(statusTopic, "", { qos: statusT.qos, retain: true });
      goOnline();
      return;
    }
    checkTimer = setTimeout(() => {
      checked = true;
      client.unsubscribe(stateTopic);
      console.info("[sim] start check passed");
      goOnline();
    }, START_CHECK_MS);
  });
  client.on("close", () => {
    controller.setLinkUp(false, Date.now());
    // Same clientId: a live controller reconnecting takes our session over (kicks us) mid-check.
    if (checkTimer && !checked)
      failStartCheck(
        "link closed during the start check (another controller may be live)",
      );
  });
  client.on("error", (err) =>
    console.error(`[sim] mqtt error: ${err.message}`),
  );
  client.on("message", (topic, payload, packet) => {
    if (topic === stateTopic) {
      // A live controller's publishes reach a subscribed client with retain=0.
      if (!checked && !packet.retain && payload.length > 0)
        failStartCheck(`another controller is live on ${stateTopic}`);
      return;
    }
    if (topic === hbT.build(iid)) {
      const hb = parsePayload(hbT.schema, topic, payload);
      if (hb) controller.onHeartbeat(hb, packet.retain, Date.now());
      return;
    }
    if (topic === cmdT.build(iid) && checked) {
      const cmd = parsePayload(cmdT.schema, topic, payload);
      if (!cmd) return;
      const ack = controller.onCommand(cmd, Date.now());
      publish(ackT.build(iid), JSON.stringify(ack), ackT.qos, ackT.retain);
    }
  });

  return {
    controller,
    /** Publishes a retained online:false (when it went online), then ends the link. */
    stop(): Promise<void> {
      clearInterval(tick);
      clearTimeout(checkTimer);
      clearTimeout(onlineTimer);
      return new Promise((resolve) => {
        const end = () => client.end(!client.connected, {}, () => resolve());
        if (checked && client.connected)
          client.publish(
            statusTopic,
            status(false),
            { qos: statusT.qos, retain: statusT.retain },
            () => end(),
          );
        else end();
      });
    },
  };
}
