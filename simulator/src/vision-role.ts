import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  type Approach,
  type Aspect,
  type ControllerState,
  type Crossing,
  topics,
  type VehicleClass,
  type VisionBreach,
  type VisionCounts,
  type VisionDemand,
  type VisionHeartbeat,
  type VisionStatus,
} from "@stl/contracts";
import vehicleClasses from "@stl/contracts/vehicle-classes.json" with {
  type: "json",
};
import mqtt from "mqtt";
import type { Config } from "./config.ts";
import { type Controller, parsePayload } from "./controller-role.ts";

export const APPROACHES: readonly Approach[] = ["N", "S", "E", "W"];
const GREEN_LEAVE_MS = 1_500;
const SLOW_LEAVE_MS = 3_000; // FLASHING_AMBER, or no controller in the process
const ARRIVAL_MS = 6_000; // mean gap between arrivals on one approach
const MAX_QUEUE = 12;

const CROP = {
  mime: "image/jpeg",
  data: readFileSync(
    new URL("../assets/placeholder-crop.jpg", import.meta.url),
  ).toString("base64"),
};

const leaveMs = (a: Aspect | undefined) =>
  a === undefined || a === "FLASHING_AMBER"
    ? SLOW_LEAVE_MS
    : a === "GREEN"
      ? GREEN_LEAVE_MS
      : undefined;

/**
 * The broker-free vision core: simulated queues per approach that follow the
 * signals. `rand` is injected so traffic is deterministic in tests.
 */
export function createVision(
  now: number,
  {
    rand = Math.random,
    classes = vehicleClasses,
  }: { rand?: () => number; classes?: readonly VehicleClass[] } = {},
) {
  const queues = Object.fromEntries(
    APPROACHES.map((a) => [a, [] as VehicleClass[]]),
  ) as Record<Approach, VehicleClass[]>;
  const nextLeave: Partial<Record<Approach, number>> = {};
  const crossed = new Map<string, Crossing>();
  let lastT = now;
  let seq = 0;

  function step(t: number, signals?: ControllerState["signals"]): void {
    const p = Math.max(0, t - lastT) / ARRIVAL_MS;
    lastT = t;
    for (const a of APPROACHES) {
      const q = queues[a];
      // One draw per approach per step: an arrival when r < p, and r / p picks the class.
      const r = rand();
      if (r < p && q.length < MAX_QUEUE)
        q.push(classes[Math.floor((r / p) * classes.length)]);

      const every = leaveMs(
        signals && (a === "N" || a === "S" ? signals.NS : signals.EW),
      );
      if (every === undefined || q.length === 0) {
        delete nextLeave[a];
        continue;
      }
      nextLeave[a] ??= t + every;
      while (q.length > 0 && (nextLeave[a] ?? Infinity) <= t) {
        const v = q.shift() as VehicleClass;
        const key = `${a}:${v.id}`;
        const c = crossed.get(key);
        if (c) c.count++;
        else crossed.set(key, { approach: a, vehicleClass: v.id, count: 1 });
        nextLeave[a] = (nextLeave[a] ?? t) + every;
      }
    }
  }

  return {
    step,
    heartbeat(t: number): VisionHeartbeat {
      return { v: 1, ts: t, seq: seq++, ok: true, confidence: 0.9, fps: 15 };
    },
    demand(): VisionDemand {
      const pcu = (a: Approach) => queues[a].reduce((s, v) => s + v.pcu, 0);
      return {
        v: 1,
        ts: lastT,
        pcu: { N: pcu("N"), S: pcu("S"), E: pcu("E"), W: pcu("W") },
      };
    },
    /** Crossings since the last call, or undefined when there were none. */
    takeCounts(t: number): VisionCounts | undefined {
      if (crossed.size === 0) return undefined;
      const crossings = [...crossed.values()];
      crossed.clear();
      return { v: 1, id: randomUUID(), ts: t, crossings };
    },
    breach(
      t: number,
      approach?: Approach,
      vehicleClass?: string,
    ): VisionBreach {
      const pick = <T>(xs: readonly T[]) =>
        xs[Math.min(xs.length - 1, Math.floor(rand() * xs.length))];
      return {
        v: 1,
        id: randomUUID(),
        ts: t,
        approach: approach ?? pick(APPROACHES),
        vehicleClass: vehicleClass ?? pick(classes).id,
        centroid: { x: rand(), y: rand() },
        crop: CROP,
      };
    },
  };
}

export type Vision = ReturnType<typeof createVision>;

const CLIENT_ID = "stl-sim-vision";
const START_CHECK_MS = 3_000;
const ONLINE_REPEAT_MS = 10_000;
const DEMAND_HOLD_MS = 100;

/** The vision role on its own MQTT link (AD-3, AD-5, AD-17). */
export function startVisionRole({
  config,
  force,
  controller,
}: {
  config: Config;
  force: boolean;
  controller?: Controller;
}) {
  const iid = config.INTERSECTION_ID;
  const statusT = topics["vision/status"];
  const hbT = topics["vision/heartbeat"];
  const demandT = topics["vision/demand"];
  const countsT = topics["vision/counts"];
  const breachT = topics["vision/breach"];
  const statusTopic = statusT.build(iid);
  const hbTopic = hbT.build(iid);
  const status = (online: boolean) => {
    const s: VisionStatus = { v: 1, online, source: "sim" };
    return JSON.stringify(s);
  };

  const vision = createVision(Date.now());

  let client: mqtt.MqttClient | undefined;
  let online = false; // the check passed (or was skipped) and the link is up
  let timers: NodeJS.Timeout[] = [];
  let checkTimer: NodeJS.Timeout | undefined;
  let onlineTimer: NodeJS.Timeout | undefined;
  let demandTimer: NodeJS.Timeout | undefined;
  let lastDemand: string | undefined;
  let holdUntil = 0;

  const publish = (
    topic: string,
    body: string,
    qos: 0 | 1,
    retain: boolean,
  ) => {
    if (online && client?.connected)
      client.publish(topic, body, { qos, retain });
  };
  const publishStatus = () =>
    publish(statusTopic, status(true), statusT.qos, statusT.retain);

  // Leading-edge throttle: publish a change at once, then hold further ones for 100 ms.
  const flushDemand = () => {
    if (!online) return;
    const d = vision.demand();
    const key = JSON.stringify(d.pcu);
    if (key === lastDemand) return;
    const now = Date.now();
    if (now < holdUntil) {
      demandTimer ??= setTimeout(() => {
        demandTimer = undefined;
        flushDemand();
      }, holdUntil - now);
      return;
    }
    publish(
      demandT.build(iid),
      JSON.stringify({ ...d, ts: now }),
      demandT.qos,
      demandT.retain,
    );
    lastDemand = key;
    holdUntil = now + DEMAND_HOLD_MS;
  };

  const sendHeartbeat = () =>
    publish(
      hbTopic,
      JSON.stringify(vision.heartbeat(Date.now())),
      hbT.qos,
      hbT.retain,
    );

  const clearTimers = () => {
    for (const t of timers) clearInterval(t);
    timers = [];
    clearTimeout(checkTimer);
    clearTimeout(onlineTimer);
    clearTimeout(demandTimer);
    checkTimer = onlineTimer = demandTimer = undefined;
  };

  const goOnline = () => {
    online = true;
    publishStatus();
    clearTimeout(onlineTimer);
    onlineTimer = setTimeout(publishStatus, ONLINE_REPEAT_MS);
    if (timers.length > 0) return; // a reconnect keeps the running timers
    lastDemand = undefined;
    vision.takeCounts(Date.now()); // a stopped node saw nothing; drop that backlog
    sendHeartbeat();
    flushDemand();
    timers = [
      setInterval(sendHeartbeat, 1000),
      setInterval(() => {
        if (!online || !client?.connected) return; // keep crossings for after a reconnect
        const c = vision.takeCounts(Date.now());
        if (c)
          publish(
            countsT.build(iid),
            JSON.stringify(c),
            countsT.qos,
            countsT.retain,
          );
      }, 1000),
    ];
  };

  function connect(check: boolean, clear: boolean) {
    const c = mqtt.connect(config.MQTT_URL, {
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
    client = c;
    let firstConnect = true;
    let checked = !check;

    const failStartCheck = (message: string) => {
      if (!checkTimer) return; // already failing
      clearTimeout(checkTimer);
      checkTimer = undefined;
      console.error(`[sim] ${message}; exiting (--force skips this check)`);
      clearInterval(tick);
      // A graceful end sends no LWT, so nothing is published.
      c.end(!c.connected, {}, () => process.exit(1));
    };

    c.on("connect", () => {
      if (client !== c) return; // a stopped link
      console.info(`[sim] vision connected (stl/${iid})`);
      if (!firstConnect) {
        if (checked) goOnline();
        return;
      }
      firstConnect = false;
      if (checked) {
        if (clear)
          // Clear a stale retained status before our own online:true.
          c.publish(statusTopic, "", { qos: statusT.qos, retain: true });
        goOnline();
        return;
      }
      // The only read the AD-15 ACL allows, and only during the check.
      c.subscribe({ [hbTopic]: { qos: hbT.qos } }, (err) => {
        if (err) console.error(`[sim] subscribe failed: ${err.message}`);
      });
      checkTimer = setTimeout(() => {
        checkTimer = undefined;
        checked = true;
        c.unsubscribe(hbTopic);
        console.info("[sim] vision start check passed");
        goOnline();
      }, START_CHECK_MS);
    });
    c.on("close", () => {
      if (client === c) online = false;
      // Same clientId: a live vision node reconnecting takes our session over mid-check.
      if (!checked)
        failStartCheck(
          "link closed during the vision start check (another vision node may be live)",
        );
    });
    c.on("error", (err) => console.error(`[sim] mqtt error: ${err.message}`));
    c.on("message", (topic, payload, packet) => {
      if (topic !== hbTopic || checked || packet.retain) return;
      if (parsePayload(hbT.schema, topic, payload))
        failStartCheck(`another vision node is live on ${hbTopic}`);
    });
  }

  // Traffic keeps moving while the link is down or stopped.
  const tick = setInterval(() => {
    vision.step(Date.now(), controller?.state().signals);
    flushDemand();
  }, 100);
  connect(!force, force);

  return {
    vision,
    running: () => client !== undefined,
    /** Publishes a breach when online; returns it, or undefined when offline. */
    emitBreach(approach?: Approach, vehicleClass?: string) {
      if (!online || !client?.connected) return undefined;
      const b = vision.breach(Date.now(), approach, vehicleClass);
      publish(
        breachT.build(iid),
        JSON.stringify(b),
        breachT.qos,
        breachT.retain,
      );
      return b;
    },
    /** Publishes a retained online:false (when online), then ends the link. */
    stop(): Promise<void> {
      const c = client;
      clearTimers();
      client = undefined;
      if (!c) return Promise.resolve();
      return new Promise((resolve) => {
        const end = () => c.end(!c.connected, {}, () => resolve());
        if (online && c.connected)
          c.publish(
            statusTopic,
            status(false),
            { qos: statusT.qos, retain: statusT.retain },
            () => end(),
          );
        else end();
        online = false;
      });
    },
    /** Reconnects after a stop, without the start check. */
    start(): void {
      if (!client) connect(false, false);
    },
  };
}

export type VisionRole = ReturnType<typeof startVisionRole>;
