import type { z } from "zod";
import { OverrideCommand } from "../overrides.ts";

/** SSE `override` occurrence. Writer: services/overrides.ts. */
export const OverrideEvent = OverrideCommand;
export type OverrideEvent = z.infer<typeof OverrideEvent>;
