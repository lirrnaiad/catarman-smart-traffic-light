import type { z } from "zod";
import { SpeedAlertItem } from "../speed-alerts.ts";

/** SSE `speedAlert` occurrence (M2, CAP-10). Writer: services/speed-alerts.ts. */
export const SpeedAlertEvent = SpeedAlertItem;
export type SpeedAlertEvent = z.infer<typeof SpeedAlertEvent>;
