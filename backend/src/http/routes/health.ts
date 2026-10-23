import type { Health } from "@stl/contracts";
import { Router } from "express";
import type { AppDeps } from "../../app.ts";
import { pingDb } from "../../db/pool.ts";

export default ({ pool }: AppDeps) =>
  Router().get("/health", async (_req, res) => {
    const db = await pingDb(pool);
    // Entry 3 adds the broker: ok = db && broker.
    const body: Health = { ok: db, db, broker: false };
    res.json(body);
  });
