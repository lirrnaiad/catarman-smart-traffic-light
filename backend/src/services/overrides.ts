import { randomUUID } from "node:crypto";
import {
  type LinkSlice,
  ListQuery,
  type OverrideCommand,
  OverrideRequest,
  type Page,
} from "@stl/contracts";
import { z } from "zod";
import type { Pool } from "../db/pool.ts";
import { insertOverride } from "../db/repositories/override_command.insert.ts";
import {
  findOverride,
  listOverrides as listRows,
} from "../db/repositories/override_command.list.ts";
import { resolveOverride as resolveRow } from "../db/repositories/override_command.resolve.ts";
import {
  listRequestedBefore,
  markTimeout,
} from "../db/repositories/override_command.timeouts.ts";
import type { Publisher } from "../mqtt/publisher.ts";
import type { Hub } from "../sse/hub.ts";
import { AppError } from "./errors.ts";

/** A REQUESTED command with no answer for this long becomes TIMEOUT (AD-7 rule 5). */
export const TIMEOUT_MS = 5_000;

type Deps = {
  pool: Pool;
  hub: Hub;
  publisher: Publisher;
  getLink: () => LinkSlice;
};

const offline = () =>
  new AppError("CONTROLLER_OFFLINE", "Controller offline: nothing was sent");

/**
 * POST /api/overrides (AD-7 rules 2–3). Returns the REQUESTED command, or
 * throws CONTROLLER_OFFLINE after recording and emitting the REJECTED row.
 */
export async function requestOverride(
  { pool, hub, publisher, getLink }: Deps,
  body: unknown,
): Promise<OverrideCommand> {
  const req = OverrideRequest.parse(body);
  const now = new Date();
  const cmd: OverrideCommand = {
    commandId: randomUUID(),
    mode: req.mode,
    phase: req.mode === "CORRIDOR" ? req.phase : null,
    status: "REQUESTED",
    reason: null,
    requestedAt: now.toISOString(),
    resolvedAt: null,
  };

  if (getLink().controller.status !== "ONLINE") {
    const rejected: OverrideCommand = {
      ...cmd,
      status: "REJECTED",
      reason: "CONTROLLER_OFFLINE",
      resolvedAt: cmd.requestedAt,
    };
    await insertOverride(pool, rejected);
    hub.emit("override", rejected);
    console.info(
      `[http] override ${cmd.commandId} rejected: controller offline`,
    );
    throw offline();
  }

  await insertOverride(pool, cmd);
  // Before publishing: a fast ack must not be overtaken by this REQUESTED frame.
  hub.emit("override", cmd);
  try {
    await publisher.publish("controller/override/cmd", {
      v: 1,
      commandId: cmd.commandId,
      ts: now.getTime(),
      ...req,
    });
  } catch (err) {
    console.warn(
      `[mqtt] override ${cmd.commandId} not published:`,
      (err as Error).message,
    );
    await resolveOverride(
      { pool, hub },
      cmd.commandId,
      "REJECTED",
      "CONTROLLER_OFFLINE",
      Date.now(),
    );
    throw offline();
  }
  return cmd;
}

/**
 * The first matching ack or state resolves a REQUESTED or TIMEOUT command
 * (AD-7 rule 5). Unknown ids and terminal rows change nothing and emit nothing.
 */
export async function resolveOverride(
  { pool, hub }: Pick<Deps, "pool" | "hub">,
  commandId: string,
  status: "APPLIED" | "REJECTED",
  reason: string | null,
  receivedAt: number,
): Promise<void> {
  const changed = await resolveRow(
    pool,
    commandId,
    status,
    reason,
    new Date(receivedAt),
  );
  if (!changed) return;
  const row = await findOverride(pool, commandId);
  if (row) hub.emit("override", row);
}

/** REQUESTED rows at least TIMEOUT_MS old become TIMEOUT, `resolvedAt` null. */
export async function timeoutOverrides(
  { pool, hub }: Pick<Deps, "pool" | "hub">,
  now: number,
): Promise<void> {
  const due = await listRequestedBefore(pool, new Date(now - TIMEOUT_MS));
  for (const cmd of due) {
    // Conditional: an ack may have resolved it since the select.
    if (await markTimeout(pool, cmd.commandId)) {
      hub.emit("override", { ...cmd, status: "TIMEOUT" });
    }
  }
}

const Cursor = z.tuple([z.iso.datetime(), z.uuid()]);

function encodeCursor(cmd: OverrideCommand): string {
  return Buffer.from(JSON.stringify([cmd.requestedAt, cmd.commandId])).toString(
    "base64url",
  );
}

function decodeCursor(cursor: string): {
  requestedAt: Date;
  commandId: string;
} {
  try {
    const [requestedAt, commandId] = Cursor.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
    return { requestedAt: new Date(requestedAt), commandId };
  } catch {
    throw new AppError("VALIDATION_FAILED", "cursor: invalid");
  }
}

/** GET /api/overrides: newest first; `nextCursor` null on the last page. */
export async function listOverrides(
  pool: Pool,
  query: unknown,
): Promise<Page<OverrideCommand>> {
  const { limit, cursor } = ListQuery.parse(query);
  const after = cursor === undefined ? undefined : decodeCursor(cursor);
  const rows = await listRows(pool, limit + 1, after);
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
  };
}
