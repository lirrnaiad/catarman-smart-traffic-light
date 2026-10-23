import { z } from "zod";
import { VisionDemand } from "../../mqtt/vision-demand.ts";
import { isoUtc } from "../../scalars.ts";

/** SSE `demand` slice, nullable: `{pcu, receivedAt}`. Writer: services/demand.ts. */
export const DemandSlice = z
  .object({ pcu: VisionDemand.shape.pcu, receivedAt: isoUtc })
  .nullable();
export type DemandSlice = z.infer<typeof DemandSlice>;
