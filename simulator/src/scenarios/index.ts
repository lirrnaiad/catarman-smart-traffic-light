/** A scripted run: each step's `line` goes through the REPL command parser `atS` seconds after start. */
export type Scenario = {
  name: string;
  steps: { atS: number; line: string }[];
};

// One alphabetical registration line per scenario file (entry 5 adds demo).
export const scenarios: Record<string, Scenario> = {};
