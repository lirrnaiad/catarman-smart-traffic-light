import type { z } from "zod";
import { BreachItem } from "../breaches.ts";

/** SSE `breach` occurrence. Writer: services/breaches.ts. */
export const BreachEvent = BreachItem;
export type BreachEvent = z.infer<typeof BreachEvent>;
