import { ApiError, type ErrorCode, Page } from "@stl/contracts";
import type { z } from "zod";
import { API_URL } from "../config.ts";

/** A failed API call. `code` is the `ApiError` code, or `INTERNAL` when the body isn't one. */
export class ApiRequestError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
  }
}

/** Resolves an API-relative path (including DTO URLs such as `cropUrl`) against the API base. */
export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

async function request<T extends z.ZodType>(
  path: string,
  schema: T,
  init?: RequestInit,
): Promise<z.infer<T>> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), init);
  } catch {
    throw new ApiRequestError("INTERNAL", `Network error on ${path}`, 0);
  }
  const body: unknown = await res.json().catch(() => undefined);
  if (!res.ok) {
    const error = ApiError.safeParse(body);
    if (error.success) {
      const { code, message } = error.data.error;
      throw new ApiRequestError(code, message, res.status);
    }
    throw new ApiRequestError("INTERNAL", `HTTP ${res.status}`, res.status);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Paths only, never the data.
    const paths = parsed.error.issues.map((i) => i.path.join(".") || "(root)");
    throw new ApiRequestError(
      "INTERNAL",
      `Invalid response from ${path} at ${paths.join(", ")}`,
      res.status,
    );
  }
  return parsed.data;
}

export function apiGet<T extends z.ZodType>(
  path: string,
  schema: T,
): Promise<z.infer<T>> {
  return request(path, schema);
}

export function apiPost<T extends z.ZodType>(
  path: string,
  body: unknown,
  schema: T,
): Promise<z.infer<T>> {
  return request(path, schema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** A `Page<T>` list. `query` becomes the `limit` and `cursor` query string. */
export function apiList<T extends z.ZodType>(
  path: string,
  itemSchema: T,
  query?: { limit?: number; cursor?: string },
): Promise<Page<z.infer<T>>> {
  const params = new URLSearchParams();
  if (query?.limit !== undefined) params.set("limit", String(query.limit));
  if (query?.cursor !== undefined) params.set("cursor", query.cursor);
  const qs = params.toString();
  const url = qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path;
  return request(url, Page(itemSchema));
}
