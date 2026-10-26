import { HourlyCountsQuery } from "@stl/contracts";
import { Router } from "express";
import type { AppDeps } from "../../app.ts";
import { hourlyCounts } from "../../services/counts.ts";

// en-CA formats as YYYY-MM-DD.
const manilaDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
});

/** GET /api/counts/hourly?date=YYYY-MM-DD: 24 Asia/Manila hour buckets; `date` defaults to today in Manila. */
export default ({ pool }: AppDeps) =>
  Router().get("/counts/hourly", async (req, res) => {
    const { date } = HourlyCountsQuery.parse(req.query);
    res.json(await hourlyCounts(pool, date ?? manilaDate.format(new Date())));
  });
