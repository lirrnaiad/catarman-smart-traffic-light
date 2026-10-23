import { Router } from "express";
import type { AppDeps } from "../../app.ts";

/** GET /api/stream: the only push channel (AD-8). */
export default ({ hub }: AppDeps) =>
  Router().get("/stream", (_req, res) => {
    res.status(200).set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.flushHeaders();
    hub.attach(res);
  });
