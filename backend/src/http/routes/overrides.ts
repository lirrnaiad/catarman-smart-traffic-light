import { Router } from "express";
import type { AppDeps } from "../../app.ts";
import { listOverrides, requestOverride } from "../../services/overrides.ts";

/** POST and GET /api/overrides (AD-7). */
export default (deps: AppDeps) =>
  Router()
    .post("/overrides", async (req, res) => {
      res.status(202).json(await requestOverride(deps, req.body));
    })
    .get("/overrides", async (req, res) => {
      res.json(await listOverrides(deps.pool, req.query));
    });
