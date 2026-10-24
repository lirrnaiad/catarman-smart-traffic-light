import { parseArgs } from "node:util";
import { behaviors } from "./behaviors/index.ts";
import { config } from "./config.ts";
import { startControllerRole } from "./controller-role.ts";
import { type ReplCtx, runScenario, startRepl } from "./repl.ts";
import { scenarios } from "./scenarios/index.ts";
import { startVisionRole } from "./vision-role.ts";

function fatal(message: string): never {
  console.error(`[sim] ${message}`);
  process.exit(1);
}

function cliArgs() {
  try {
    return parseArgs({
      options: {
        roles: { type: "string", default: "both" },
        force: { type: "boolean", default: false },
        scenario: { type: "string" },
      },
    }).values;
  } catch (err) {
    return fatal((err as Error).message);
  }
}

const args = cliArgs();
if (!["controller", "vision", "both"].includes(args.roles))
  fatal(`--roles must be controller, vision or both (got ${args.roles})`);
const scenario =
  args.scenario === undefined
    ? undefined
    : Object.hasOwn(scenarios, args.scenario)
      ? scenarios[args.scenario]
      : fatal(`unknown scenario: ${args.scenario}`);

const { force } = args;
const ctrl =
  args.roles === "vision"
    ? undefined
    : startControllerRole({ config, force, behaviors });
const vision =
  args.roles === "controller"
    ? undefined
    : startVisionRole({ config, force, controller: ctrl?.controller });

let stopping = false;
async function quit() {
  if (stopping) process.exit(1); // a second Ctrl+C skips a stuck shutdown
  stopping = true;
  await Promise.all([ctrl?.stop(), vision?.stop()]);
  process.exit(0);
}

const ctx: ReplCtx = {
  controller: ctrl?.controller,
  vision,
  behaviors,
  now: () => Date.now(),
  quit: () => void quit(),
};
process.on("SIGINT", ctx.quit);
process.on("SIGTERM", ctx.quit);

// The REPL stays open during a scenario at a terminal; without a TTY its close would quit before any step.
if (scenario) void runScenario(scenario, ctx);
if (!scenario || process.stdin.isTTY) startRepl(ctx);
