import type { BreachCrop } from "@stl/contracts";
import { z } from "zod";
import { recordBreach } from "../../services/breaches.ts";
import { occurredAt } from "../../services/occurred-at.ts";
import type { HandlerFor } from "./index.ts";

const MAX_DATA_CHARS = 204_800;
const MAX_LONG_SIDE = 64;
const base64 = z.base64();
// SOFn markers: C0-C3, C5-C7, C9-CB, CD-CF (C4, C8 and CC are not frames).
const SOF = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

/**
 * The first SOFn's size, found by walking marker segments from offset 2 (AD-11).
 * Never scans for byte pairs, which would find an EXIF thumbnail's SOF first.
 */
export function sofSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 2 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  for (;;) {
    if (buf[i] !== 0xff) return null;
    while (buf[i] === 0xff) i++; // fill bytes
    if (i >= buf.length) return null;
    const marker = buf[i++];
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xda || marker === 0xd9) return null;
    if (i + 2 > buf.length) return null;
    const len = buf.readUInt16BE(i);
    if (len < 2 || i + len > buf.length) return null;
    if (SOF.has(marker)) {
      if (len < 7) return null;
      const height = buf.readUInt16BE(i + 3);
      const width = buf.readUInt16BE(i + 5);
      return width && height ? { width, height } : null;
    }
    i += len;
  }
}

/** Runs every AD-11 crop check: the bytes to store, or the name of the failed check. */
export function checkCrop(
  crop: BreachCrop,
): { data: Buffer } | { failed: string } {
  if (crop.mime !== "image/jpeg") return { failed: "mime" };
  if (crop.data.length > MAX_DATA_CHARS) return { failed: "size" };
  if (!base64.safeParse(crop.data).success) return { failed: "base64" };
  const data = Buffer.from(crop.data, "base64");
  const size = sofSize(data);
  if (!size) return { failed: "sof" };
  if (Math.max(size.width, size.height) > MAX_LONG_SIDE)
    return { failed: "long side" };
  return { data };
}

/** Stores each breach once per id, with its crop when the crop passes (AD-11). */
export default {
  topic: "vision/breach",
  async handle(payload, ctx) {
    const receivedAt = new Date(ctx.receivedAt);
    let crop: { mime: string; data: Buffer } | undefined;
    if (payload.crop) {
      const checked = checkCrop(payload.crop);
      if ("data" in checked) crop = { mime: "image/jpeg", data: checked.data };
      else
        console.warn(
          `[mqtt] vision/breach ${payload.id} crop dropped: ${checked.failed} check failed`,
        );
    }
    try {
      await recordBreach(ctx, {
        eventId: payload.id,
        approach: payload.approach,
        vehicleClass: payload.vehicleClass,
        centroid: payload.centroid,
        occurredAt: occurredAt(payload.ts, receivedAt),
        receivedAt,
        crop,
      });
    } catch (err) {
      console.error(
        `[mqtt] vision/breach ${payload.id} not stored:`,
        (err as Error).message,
      );
    }
  },
} satisfies HandlerFor<"vision/breach">;
