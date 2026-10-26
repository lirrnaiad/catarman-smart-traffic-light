import type { Scenario } from "./index.ts";

// Steps run from process start: the controller check takes 5 s, the vision check 3 s,
// and L1 needs 5 s of healthy heartbeats then an all-red (about 13-20 s in).
export const demo: Scenario = {
  name: "demo",
  steps: [
    { atS: 22, line: "state" },
    { atS: 24, line: "emit-breach" },
    { atS: 28, line: "emit-breach E tricycle" },
    { atS: 32, line: "vision stop" },
    { atS: 37, line: "state" },
    { atS: 42, line: "sensor fault" },
    { atS: 52, line: "flood on" },
    { atS: 60, line: "state" },
  ],
};
