import { type Page, StateChangeItem } from "@stl/contracts";
import { apiList } from "./client.ts";

/** `GET /api/state-changes`, newest first. */
export function listStateChanges(query?: {
  limit?: number;
  cursor?: string;
}): Promise<Page<StateChangeItem>> {
  return apiList("/api/state-changes", StateChangeItem, query);
}
