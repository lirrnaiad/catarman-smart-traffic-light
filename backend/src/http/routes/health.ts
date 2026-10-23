import type { Health } from "@stl/contracts";
import { Router } from "express";
import type { AppDeps } from "../../app.ts";
import { pingDb } from "../../db/pool.ts";

export default ({ pool, getLink }: AppDeps) =>
  Router().get("/health", async (_req, res) => {
    const db = await pingDb(pool);
    const broker = getLink().broker === "CONNECTED";
    const body: Health = { ok: db && broker, db, broker };
    res.json(body);
  });
