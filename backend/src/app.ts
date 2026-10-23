import { fileURLToPath } from "node:url";
import type { LinkSlice } from "@stl/contracts";
import express, { type Express, type RequestHandler } from "express";
import { config } from "./config.ts";
import type { Pool } from "./db/pool.ts";
import { errorMiddleware } from "./http/error-middleware.ts";
import { routes } from "./http/routes/index.ts";
import type { Publisher } from "./mqtt/publisher.ts";
import { AppError } from "./services/errors.ts";
import type { Hub } from "./sse/hub.ts";

/** Core dependencies only (AD-16). */
export type AppDeps = {
  pool: Pool;
  hub: Hub;
  publisher: Publisher;
  getLink: () => LinkSlice;
};

const dashboardOut = fileURLToPath(
  new URL("../../dashboard/out/", import.meta.url),
);

/** Echoes allow-listed origins only (AD-15); the dashboard dev server is on :3000. */
function cors(origins: readonly string[]): RequestHandler {
  return (req, res, next) => {
    res.vary("Origin");
    const origin = req.headers.origin;
    if (!origin || !origins.includes(origin)) return next();
    res.set("Access-Control-Allow-Origin", origin);
    if (req.method !== "OPTIONS") return next();
    res.set({
      "Access-Control-Allow-Methods": "GET,POST",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.sendStatus(204);
  };
}

/** Builds the Express app only; never starts jobs or connects MQTT (AD-14). */
export function createApp(deps: AppDeps): Express {
  const app = express();
  app.use(cors(config.DASHBOARD_ORIGINS));
  app.use(express.json());
  for (const route of routes) app.use("/api", route(deps));
  app.use("/api", (_req, _res, next) =>
    next(new AppError("NOT_FOUND", "No such API route")),
  );
  // Falls through when dashboard/out/ doesn't exist (yet).
  app.use(express.static(dashboardOut));
  app.use(errorMiddleware);
  return app;
}
