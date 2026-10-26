import type { Router } from "express";
import type { AppDeps } from "../../app.ts";
import breaches from "./breaches.ts";
import health from "./health.ts";
import overrides from "./overrides.ts";
import stateChanges from "./state-changes.ts";
import stream from "./stream.ts";
import vehicleClasses from "./vehicle-classes.ts";

/** Every route module, mounted under /api. One line per file, alphabetical (AD-14). */
export const routes: Array<(deps: AppDeps) => Router> = [
  breaches,
  health,
  overrides,
  stateChanges,
  stream,
  vehicleClasses,
];
