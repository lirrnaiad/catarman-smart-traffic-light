import { createInterface } from "node:readline";
import { type ControllerState, Level } from "@stl/contracts";
import type { Behavior } from "./behaviors/index.ts";
import type { Controller } from "./controller-role.ts";
import type { Scenario } from "./scenarios/index.ts";

export type ReplCtx = {
  controller: Controller;
  behaviors: readonly Behavior[];
  now: () => number;
  quit: () => void;
};

const HELP = [
  "level L1|L2|L3|L4|auto   force the reported level, or return to automatic",
  "flood on|off             water sensor wet or dry",
  "sensor fault|ok          stop-line sensors unreadable or readable",
  "conflict raise|reset     latch or clear a conflict-monitor fault",
  "state                    show the current state",
  "help                     this list",
  "quit                     go offline and exit",
];

export function summary(s: ControllerState): string {
  const o = s.override;
  const ov =
    o?.mode === "CORRIDOR" ? `CORRIDOR ${o.phase}` : (o?.mode ?? "NONE");
  return `${s.level} NS ${s.signals.NS} EW ${s.signals.EW} flood ${s.flood}${s.fault ? " FAULT" : ""} override ${ov}`;
}

/** One REPL line; returns the text to print, if any. */
export function runCommand(line: string, ctx: ReplCtx): string | undefined {
  const [cmd = "", ...args] = line.trim().split(/\s+/);
  const [arg] = args;
  const c = ctx.controller;
  const t = ctx.now();
  const done = () => summary(c.state());

  switch (cmd) {
    case "":
      return undefined;
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
    case "state":
      return done();
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
