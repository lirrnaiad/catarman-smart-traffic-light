import {
  OverrideCommand,
  type OverrideRequest,
  type Page,
} from "@stl/contracts";
import { apiList, apiPost } from "./client.ts";

/** `POST /api/overrides`. Rejects with `ApiRequestError`: `CONTROLLER_OFFLINE` on 409. */
export function postOverride(req: OverrideRequest): Promise<OverrideCommand> {
  return apiPost("/api/overrides", req, OverrideCommand);
}

/** `GET /api/overrides`, newest first. */
export function listOverrides(query?: {
  limit?: number;
  cursor?: string;
}): Promise<Page<OverrideCommand>> {
  return apiList("/api/overrides", OverrideCommand, query);
}
