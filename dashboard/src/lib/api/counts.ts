import { HourlyCounts } from "@stl/contracts";
import { apiGet } from "./client.ts";

/** `GET /api/counts/hourly` for an Asia/Manila `YYYY-MM-DD`. */
export function getHourlyCounts(date: string): Promise<HourlyCounts> {
  return apiGet(`/api/counts/hourly?date=${date}`, HourlyCounts);
}
