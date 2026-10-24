import { ListQuery, type Page, type StateChangeItem } from "@stl/contracts";
import { Router } from "express";
import { z } from "zod";
import type { AppDeps } from "../../app.ts";
import { releaseCommandIds } from "../../db/repositories/override_command.state-history.ts";
import { listStateChanges } from "../../db/repositories/signal_state_change.list.ts";
import { AppError } from "../../services/errors.ts";

const Cursor = z.tuple([z.iso.datetime()]);

const encodeCursor = (item: StateChangeItem) =>
  Buffer.from(JSON.stringify([item.receivedAt])).toString("base64url");

function decodeCursor(cursor: string): Date {
  try {
    const [receivedAt] = Cursor.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
    return new Date(receivedAt);
  } catch {
    throw new AppError("VALIDATION_FAILED", "cursor: invalid");
  }
}

/** GET /api/state-changes: newest first; `nextCursor` null on the last page (AD-5, AD-7 rule 6). */
export default ({ pool }: AppDeps) =>
  Router().get("/state-changes", async (req, res) => {
    const { limit, cursor } = ListQuery.parse(req.query);
    const before = cursor === undefined ? undefined : decodeCursor(cursor);
    const rows = await listStateChanges(pool, limit + 1, before);
    const page = rows.slice(0, limit);
    // A {NONE, X} row ended on its own unless X is a stored release; a missing X counts as not one.
    const endedId = (o: StateChangeItem["override"]) =>
      o?.mode === "NONE" ? o.commandId : undefined;
    const releases = await releaseCommandIds(
      pool,
      page.flatMap((s) => endedId(s.override) ?? []),
    );
    const items: StateChangeItem[] = page.map((s) => {
      const id = endedId(s.override);
      return { ...s, overrideEnded: id !== undefined && !releases.has(id) };
    });
    const last = items.at(-1);
    const body: Page<StateChangeItem> = {
      items,
      nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
    };
    res.json(body);
  });
