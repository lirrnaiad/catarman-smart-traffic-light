import { createInterface } from "node:readline";
import { Approach, type ControllerState, Level } from "@stl/contracts";
import vehicleClasses from "@stl/contracts/vehicle-classes.json" with {
  type: "json",
};
import type { Behavior } from "./behaviors/index.ts";
import type { Controller } from "./controller-role.ts";
import type { Scenario } from "./scenarios/index.ts";
import type { VisionRole } from "./vision-role.ts";

export type ReplCtx = {
  controller?: Controller;
  vision?: VisionRole;
  behaviors: readonly Behavior[];
  now: () => number;
  quit: () => void;
};

const CLASS_IDS = vehicleClasses.map((k) => k.id);

const HELP = [
  "level L1|L2|L3|L4|auto   force the reported level, or return to automatic",
  "flood on|off             water sensor wet or dry",
  "sensor fault|ok          stop-line sensors unreadable or readable",
  "conflict raise|reset     latch or clear a conflict-monitor fault",
  "state                    show the current state",
  "emit-breach [approach] [class]  publish a breach; random when omitted",
  "vision stop|start        take the vision node offline or back online",
  "help                     this list",
  "quit                     go offline and exit",
];

export function summary(s: ControllerState): string {
  const o = s.override;
  const ov =
    o?.mode === "CORRIDOR" ? `CORRIDOR ${o.phase}` : (o?.mode ?? "NONE");
  return `${s.level} NS ${s.signals.NS} EW ${s.signals.EW} flood ${s.flood}${s.fault ? " FAULT" : ""} override ${ov}`;
}

function visionCommand(
  cmd: string,
  args: string[],
  v: VisionRole | undefined,
): string {
  if (cmd === "emit-breach") {
    const [a, kRaw] = args;
    const k = kRaw?.toLowerCase();
    const approach =
      a === undefined ? undefined : Approach.safeParse(a.toUpperCase());
    if (
      args.length > 2 ||
      approach?.success === false ||
      (k !== undefined && !CLASS_IDS.includes(k))
    )
      return `usage: emit-breach [N|S|E|W] [${CLASS_IDS.join("|")}]`;
    if (!v) return "vision role not running";
    const b = v.emitBreach(approach?.data, k);
    return b
      ? `breach ${b.approach} ${b.vehicleClass}`
      : "vision is offline; nothing sent";
  }
  const [arg] = args;
  if (args.length !== 1 || (arg !== "stop" && arg !== "start"))
    return "usage: vision stop|start";
  if (!v) return "vision role not running";
  if (arg === "stop") {
    if (!v.running()) return "vision already stopped";
    void v.stop();
    return "vision going offline";
  }
  if (v.running()) return "vision already running";
  v.start();
  return "vision reconnecting";
}

function controllerCommand(
  cmd: string,
  arg: string | undefined,
  c: Controller,
  t: number,
): string {
  const done = () => summary(c.state());
  switch (cmd) {
    case "level": {
      if (arg === "auto") {
        c.setForcedLevel(undefined, t);
        return done();
      }
      const l = Level.safeParse(arg?.toUpperCase());
      if (!l.success) return "usage: level L1|L2|L3|L4|auto";
      c.setForcedLevel(l.data, t);
      return done();
    }
    case "flood":
      if (arg !== "on" && arg !== "off") return "usage: flood on|off";
      c.setFlood(arg === "on", t);
      return done();
    case "sensor":
      if (arg !== "fault" && arg !== "ok") return "usage: sensor fault|ok";
      c.setSensorFault(arg === "fault", t);
      return done();
    case "conflict":
      if (arg === "raise") {
        c.raiseConflict(t);
        return done();
      }
      if (arg === "reset") {
        c.resetConflict(t);
        return done();
      }
      return "usage: conflict raise|reset";
    default: // state
      return done();
  }
}

/** One REPL line; returns the text to print, if any. */
export function runCommand(line: string, ctx: ReplCtx): string | undefined {
  const [cmd = "", ...args] = line.trim().split(/\s+/);
  switch (cmd) {
    case "":
      return undefined;
    case "level":
    case "flood":
    case "sensor":
    case "conflict":
    case "state":
      return ctx.controller
        ? controllerCommand(cmd, args[0], ctx.controller, ctx.now())
        : "controller role not running";
    case "emit-breach":
    case "vision":
      return visionCommand(cmd, args, ctx.vision);
    case "help":
      return [
        ...HELP,
        ...ctx.behaviors.flatMap((b) =>
          Object.keys(b.commands ?? {}).map(
            (k) => `${k.padEnd(25)}(${b.name})`,
          ),
        ),
      ].join("\n");
    case "quit":
      ctx.quit();
      return undefined;
  }
  const owner = ctx.behaviors.find(
    (b) => b.commands && Object.hasOwn(b.commands, cmd),
  );
  if (owner?.commands) return owner.commands[cmd](args, ctx);
  return `unknown command: ${cmd} (try help)`;
}

/** The interactive REPL. Ctrl+C and Ctrl+D quit. */
export function startRepl(ctx: ReplCtx) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "sim> ",
  });
  rl.on("line", (line) => {
    const out = runCommand(line, ctx);
    if (out) console.log(out);
    rl.prompt();
  });
  rl.on("SIGINT", ctx.quit);
  rl.on("close", ctx.quit);
  rl.prompt();
  return rl;
}

/** Runs each step's line through the REPL parser at its time; resolves after the last. */
export function runScenario(s: Scenario, ctx: ReplCtx): Promise<void> {
  const steps = s.steps.map(
    ({ atS, line }) =>
      new Promise<void>((resolve) =>
        setTimeout(() => {
          console.info(`[sim] ${s.name} @${atS}s: ${line}`);
          const out = runCommand(line, ctx);
          if (out) console.log(out);
          resolve();
        }, atS * 1000),
      ),
  );
  return Promise.all(steps).then(() => undefined);
}
