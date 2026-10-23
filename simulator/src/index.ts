import { parseArgs } from "node:util";
import { behaviors } from "./behaviors/index.ts";
import { config } from "./config.ts";
import { startControllerRole } from "./controller-role.ts";
import { type ReplCtx, runScenario, startRepl } from "./repl.ts";
import { scenarios } from "./scenarios/index.ts";

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
// shortcut: the vision role lands in entry 5; until then both = controller only.
if (args.roles === "vision") fatal("the vision role is not available yet");
if (args.roles === "both")
  console.warn(
    "[sim] the vision role is not available yet; starting the controller only",
  );
const scenario =
  args.scenario === undefined
    ? undefined
    : Object.hasOwn(scenarios, args.scenario)
      ? scenarios[args.scenario]
      : fatal(`unknown scenario: ${args.scenario}`);

const role = startControllerRole({ config, force: args.force, behaviors });

let stopping = false;
async function quit() {
  if (stopping) process.exit(1); // a second Ctrl+C skips a stuck shutdown
  stopping = true;
  await role.stop();
  process.exit(0);
}

const ctx: ReplCtx = {
  controller: role.controller,
  behaviors,
  now: () => Date.now(),
  quit: () => void quit(),
};
process.on("SIGINT", ctx.quit);
process.on("SIGTERM", ctx.quit);

if (scenario) void runScenario(scenario, ctx);
else startRepl(ctx);
