import { afterEach, describe, expect, it, vi } from "vitest";
import { createController } from "./controller-role.ts";
import { type ReplCtx, runCommand, runScenario } from "./repl.ts";
import { demo } from "./scenarios/demo.ts";
import { scenarios } from "./scenarios/index.ts";
import type { VisionRole } from "./vision-role.ts";

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

/** A stand-in vision role; emitBreach echoes what it was asked for. */
function fakeVision(running = true) {
  let up = running;
  return {
    vision: {} as VisionRole["vision"],
    running: () => up,
    emitBreach: vi.fn((approach = "N", vehicleClass = "car") => ({
      approach,
      vehicleClass,
    })),
    stop: vi.fn(async () => {
      up = false;
    }),
    start: vi.fn(() => {
      up = true;
    }),
  } as unknown as VisionRole & {
    emitBreach: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
  };
}

describe("vision commands", () => {
  it("emit-breach takes an optional approach and class", () => {
    const vision = fakeVision();
    const c = ctx({ vision });
    expect(runCommand("emit-breach", c)).toBe("breach N car");
    expect(vision.emitBreach).toHaveBeenLastCalledWith(undefined, undefined);
    expect(runCommand("emit-breach e", c)).toBe("breach E car");
    expect(runCommand("emit-breach E tricycle", c)).toBe("breach E tricycle");
    expect(runCommand("emit-breach E Tricycle", c)).toBe("breach E tricycle");
    expect(vision.emitBreach).toHaveBeenLastCalledWith("E", "tricycle");
  });

  it("answers a bad approach or unknown class with usage and sends nothing", () => {
    const vision = fakeVision();
    const c = ctx({ vision });
    for (const line of [
      "emit-breach X",
      "emit-breach E bus",
      "emit-breach E car extra",
    ])
      expect(runCommand(line, c)).toMatch(
        /^usage: emit-breach \[N\|S\|E\|W\] \[car\|/,
      );
    expect(vision.emitBreach).not.toHaveBeenCalled();
  });

  it("says when the vision is offline and nothing went out", () => {
    const vision = fakeVision();
    vision.emitBreach.mockReturnValue(undefined);
    expect(runCommand("emit-breach", ctx({ vision }))).toBe(
      "vision is offline; nothing sent",
    );
  });

  it("vision stop|start, with a message when already in that state", () => {
    const vision = fakeVision();
    const c = ctx({ vision });
    expect(runCommand("vision start", c)).toBe("vision already running");
    expect(runCommand("vision stop", c)).toBe("vision going offline");
    expect(runCommand("vision stop", c)).toBe("vision already stopped");
    expect(vision.stop).toHaveBeenCalledOnce();
    expect(runCommand("vision start", c)).toBe("vision reconnecting");
    expect(vision.start).toHaveBeenCalledOnce();
    expect(runCommand("vision", c)).toBe("usage: vision stop|start");
    expect(runCommand("vision stop extra", c)).toBe("usage: vision stop|start");
    expect(runCommand("help", c)).toContain("vision stop|start");
  });

  it("answers the absent role's commands with <role> role not running", () => {
    const noVision = ctx();
    expect(runCommand("emit-breach", noVision)).toBe("vision role not running");
    expect(runCommand("vision stop", noVision)).toBe("vision role not running");
    const noController = ctx({ controller: undefined, vision: fakeVision() });
    for (const line of [
      "state",
      "level L1",
      "flood on",
      "sensor fault",
      "conflict raise",
    ])
      expect(runCommand(line, noController)).toBe(
        "controller role not running",
      );
    expect(runCommand("help", noController)).toContain("quit");
  });
});

describe("demo scenario", () => {
  it("is registered and every line runs without a usage or unknown answer", () => {
    expect(scenarios.demo).toBe(demo);
    const c = ctx({ vision: fakeVision() });
    for (const { line } of demo.steps) {
      const out = runCommand(line, c) ?? "";
      expect(out).not.toMatch(/^usage|^unknown|not running/);
    }
  });

  it("walks L1 with two breaches, then vision stop, sensor fault and flood on, in order, after 8 s", () => {
    const lines = demo.steps.map((s) => s.line);
    const at = (l: string) => lines.indexOf(l);
    expect(demo.steps[0]?.atS).toBeGreaterThanOrEqual(8);
    expect(
      lines.filter((l) => l.startsWith("emit-breach")).length,
    ).toBeGreaterThanOrEqual(2);
    const lastBreach = lines.findLastIndex((l) => l.startsWith("emit-breach"));
    expect(lastBreach).toBeLessThan(at("vision stop"));
    expect(at("vision stop")).toBeLessThan(at("sensor fault"));
    expect(at("sensor fault")).toBeLessThan(at("flood on"));
    // L1 takes up to about 20 s; the first breach comes after it.
    const firstBreach = demo.steps.find((s) =>
      s.line.startsWith("emit-breach"),
    );
    expect(firstBreach?.atS).toBeGreaterThanOrEqual(20);
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
    expect(c.controller?.state()).toMatchObject({ level: "L3", fault: false });
    await vi.advanceTimersByTimeAsync(1000);
    expect(c.controller?.state().fault).toBe(true);
    await done;
    vi.restoreAllMocks();
  });
});
