import { BreachItem, type Page } from "@stl/contracts";
import { apiList } from "./client.ts";

/** `GET /api/breaches`: newest first; follow `nextCursor` for older pages. */
export function listBreaches(query: {
  limit?: number;
  cursor?: string;
}): Promise<Page<BreachItem>> {
  return apiList("/api/breaches", BreachItem, query);
}
