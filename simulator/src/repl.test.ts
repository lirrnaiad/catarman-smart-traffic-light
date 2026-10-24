import { afterEach, describe, expect, it, vi } from "vitest";
import { createController } from "./controller-role.ts";
import { type ReplCtx, runCommand, runScenario } from "./repl.ts";

function ctx(over: Partial<ReplCtx> = {}): ReplCtx {
  let t = 0;
  return {
    controller: createController(0),
    behaviors: [],
    now: () => (t += 100),
    quit: vi.fn(),
    ...over,
  };
}

describe("runCommand", () => {
  it("dispatches the built-in commands", () => {
    const c = ctx();
    expect(runCommand("state", c)).toBe(
      "L2 NS GREEN EW RED flood DRY override NONE",
    );
    expect(runCommand("sensor fault", c)).toMatch(/^L3 /);
    expect(runCommand("sensor ok", c)).toMatch(/^L3 /); // climbing waits 5 s and an all-red
    expect(runCommand("  level   l4 ", c)).toBe(
      "L4 NS FLASHING_AMBER EW FLASHING_AMBER flood DRY override NONE",
    );
    expect(runCommand("level auto", c)).toMatch(/^L3 NS RED EW RED/);
    expect(runCommand("flood on", c)).toContain("flood WET");
    expect(runCommand("flood off", c)).toContain("flood DRY");
    expect(runCommand("conflict raise", c)).toContain(" FAULT ");
    expect(runCommand("conflict reset", c)).not.toContain("FAULT");
    expect(runCommand("help", c)).toContain("conflict raise|reset");
    expect(runCommand("", c)).toBeUndefined();
    expect(runCommand("quit", c)).toBeUndefined();
    expect(c.quit).toHaveBeenCalledOnce();
  });

  it("answers bad arguments with usage and unknown commands with a hint", () => {
    const c = ctx();
    expect(runCommand("level L5", c)).toBe("usage: level L1|L2|L3|L4|auto");
    expect(runCommand("level", c)).toBe("usage: level L1|L2|L3|L4|auto");
    expect(runCommand("flood maybe", c)).toBe("usage: flood on|off");
    expect(runCommand("sensor", c)).toBe("usage: sensor fault|ok");
    expect(runCommand("conflict", c)).toBe("usage: conflict raise|reset");
    expect(runCommand("emit-breach", c)).toBe(
      "unknown command: emit-breach (try help)",
    );
    expect(runCommand("toString", c)).toBe(
      "unknown command: toString (try help)",
    );
  });

  it("runs behavior commands and lists them in help", () => {
    const ping = vi.fn(() => "pong");
    const c = ctx({ behaviors: [{ name: "echo", commands: { ping } }] });
    expect(runCommand("ping a b", c)).toBe("pong");
    expect(ping).toHaveBeenCalledWith(["a", "b"], c);
    expect(runCommand("help", c)).toContain("ping");
  });
});

describe("runScenario", () => {
  afterEach(() => vi.useRealTimers());

  it("runs each line through the parser at its time", async () => {
    vi.useFakeTimers();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    const c = ctx();
    const done = runScenario(
      {
        name: "t",
        steps: [
          { atS: 1, line: "sensor fault" },
          { atS: 2, line: "conflict raise" },
        ],
      },
      c,
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(c.controller.state()).toMatchObject({ level: "L3", fault: false });
    await vi.advanceTimersByTimeAsync(1000);
    expect(c.controller.state().fault).toBe(true);
    await done;
    vi.restoreAllMocks();
  });
});
