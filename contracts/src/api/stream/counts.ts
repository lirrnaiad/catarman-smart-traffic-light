import type { z } from "zod";
import { HourCounts } from "../counts.ts";

/** SSE `counts` slice, nullable: the current Asia/Manila hour. Writer: services/counts.ts. */
export const CountsSlice = HourCounts.nullable();
export type CountsSlice = z.infer<typeof CountsSlice>;
