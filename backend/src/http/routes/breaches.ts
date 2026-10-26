import { ListQuery, uuid } from "@stl/contracts";
import { Router } from "express";
import type { AppDeps } from "../../app.ts";
import { breachCrop, listBreaches } from "../../services/breaches.ts";
import { AppError } from "../../services/errors.ts";

/** GET /api/breaches (`Page<BreachItem>`) and GET /api/breaches/:id/crop (AD-11). */
export default ({ pool }: AppDeps) =>
  Router()
    .get("/breaches", async (req, res) => {
      res.json(await listBreaches(pool, ListQuery.parse(req.query)));
    })
    .get("/breaches/:id/crop", async (req, res) => {
      if (!uuid.safeParse(req.params.id).success)
        throw new AppError("VALIDATION_FAILED", "id: not a UUID");
      const data = await breachCrop(pool, req.params.id);
      res
        .type("image/jpeg")
        .set({
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        })
        .send(data);
    });
