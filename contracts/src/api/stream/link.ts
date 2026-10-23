import { z } from "zod";
import { BrokerStatus, LinkStatus, Source } from "../../enums.ts";

/** SSE `link` slice; never null. `source` and `bootCount` are null when unknown. Writer: services/link.ts. */
export const LinkSlice = z.object({
  broker: BrokerStatus,
  controller: z.object({
    status: LinkStatus,
    source: Source.nullable(),
    bootCount: z.number().int().min(0).nullable(),
  }),
  vision: z.object({
    status: LinkStatus,
    source: Source.nullable(),
  }),
});
export type LinkSlice = z.infer<typeof LinkSlice>;
