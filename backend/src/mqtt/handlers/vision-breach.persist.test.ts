import { randomUUID } from "node:crypto";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  crop,
  exifThumb,
  jpeg,
  placeholder,
  segment,
  sof,
} from "../../../test/jpeg.ts";
import { resetDb } from "../../../test/reset-db.ts";
import { config } from "../../config.ts";
import { createPool, type Pool } from "../../db/pool.ts";
import { createLink } from "../../services/link.ts";
import { createHub, type Hub } from "../../sse/hub.ts";
import { dispatch } from "../client.ts";
import { handlers } from "./index.ts";
import { checkCrop, sofSize } from "./vision-breach.persist.ts";

function failed(c: { mime: string; data: string }): string | null {
  const r = checkCrop(c);
  return "failed" in r ? r.failed : null;
}

describe("AD-11 crop checks", () => {
  it("passes the simulator placeholder (64x48)", () => {
    expect(sofSize(placeholder)).toEqual({ width: 64, height: 48 });
    const r = checkCrop(crop(placeholder));
    expect("data" in r && r.data.equals(placeholder)).toBe(true);
  });

  it("fails a 65 px long side", () => {
    expect(failed(crop(jpeg(sof(65, 48))))).toBe("long side");
  });

  it("reads the main SOF, not an EXIF thumbnail's", () => {
    expect(sofSize(exifThumb)).toEqual({ width: 640, height: 480 });
    expect(failed(crop(exifThumb))).toBe("long side");
  });

  it("skips fill bytes and standalone markers, and takes a progressive SOF2", () => {
    const buf = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xff, 0xd0]),
      sof(32, 20, 0xc2),
    ]);
    expect(sofSize(buf)).toEqual({ width: 32, height: 20 });
  });

  it("fails truncated, SOS-first, zero-size and non-JPEG headers", () => {
    const full = jpeg(segment(0xe0, [0, 0, 0]), sof(64, 48));
    expect(failed(crop(full.subarray(0, 14)))).toBe("sof");
    expect(failed(crop(jpeg()))).toBe("sof");
    expect(failed(crop(jpeg(sof(0, 48))))).toBe("sof");
    expect(failed(crop(Buffer.from("not a jpeg at all")))).toBe("sof");
  });

  it("fails a non-base64 string, an oversize string and a wrong mime", () => {
    expect(failed({ mime: "image/jpeg", data: "not base64!" })).toBe("base64");
    expect(failed({ mime: "image/jpeg", data: "A".repeat(204_804) })).toBe(
      "size",
    );
    expect(failed({ ...crop(placeholder), mime: "image/png" })).toBe("mime");
  });

  it("accepts exactly 204,800 characters at the size check", () => {
    // All-zero bytes pass size and base64, then fail later at the SOF walk.
    expect(failed({ mime: "image/jpeg", data: "A".repeat(204_800) })).toBe(
      "sof",
    );
  });
});

// Hits the real stl_test database through dispatch and the real registry.
const pool = createPool(config.DATABASE_URL);
const TOPIC = "stl/int-01/vision/breach";
const HOUR_MS = 3_600_000;

let hub: Hub;
function send(msg: object, p: Pool = pool) {
  const link = createLink(hub);
  return dispatch(
    TOPIC,
    JSON.stringify({
      v: 1,
      approach: "E",
      vehicleClass: "tricycle",
      centroid: { x: 0.4, y: 0.6 },
      ...msg,
    }),
    false,
    {
      iid: "int-01",
      handlers,
      pool: p,
      hub,
      publisher: { publish: async () => {} },
      link,
      getLink: link.get,
    },
  );
}

async function count(table: string): Promise<number> {
  const [r] = await pool.query(`SELECT COUNT(*) AS n FROM ${table}`);
  return (r as Array<{ n: number }>)[0].n;
}

beforeEach(async () => {
  await resetDb(pool);
  hub = createHub({ validate: "throw" });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await resetDb(pool);
  await pool.end();
});

describe("vision/breach persist", () => {
  it("stores a new breach with its crop and emits one breach", async () => {
    const emit = vi.spyOn(hub, "emit");
    const id = randomUUID();
    await send({ id, crop: crop(placeholder) });
    expect(await count("breach_event")).toBe(1);
    const [rows] = await pool.query("SELECT data FROM breach_crop");
    expect((rows as Array<{ data: Buffer }>)[0].data.equals(placeholder)).toBe(
      true,
    );
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      "breach",
      expect.objectContaining({
        id,
        approach: "E",
        vehicleClass: "tricycle",
        centroid: { x: 0.4, y: 0.6 },
        cropUrl: `/api/breaches/${id}/crop`,
      }),
    );
  });

  it("ignores a redelivery: no new rows, nothing emitted", async () => {
    const id = randomUUID();
    await send({ id, crop: crop(placeholder) });
    const emit = vi.spyOn(hub, "emit");
    await send({ id, crop: crop(placeholder) });
    expect(await count("breach_event")).toBe(1);
    expect(await count("breach_crop")).toBe(1);
    expect(emit).not.toHaveBeenCalled();
  });

  it("stores a breach without a crop, with no warning", async () => {
    const warn = vi.spyOn(console, "warn");
    const emit = vi.spyOn(hub, "emit");
    await send({ id: randomUUID() });
    expect(await count("breach_event")).toBe(1);
    expect(await count("breach_crop")).toBe(0);
    expect(emit.mock.calls[0][1]).toMatchObject({ cropUrl: null });
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ["oversize", crop(jpeg(sof(65, 48))), "long side"],
    ["EXIF thumbnail", crop(exifThumb), "long side"],
    ["wrong mime", { ...crop(placeholder), mime: "image/png" }, "mime"],
    ["not base64", { mime: "image/jpeg", data: "@@@@" }, "base64"],
    [
      "over 204,800 chars",
      { mime: "image/jpeg", data: "A".repeat(204_804) },
      "size",
    ],
    ["truncated", crop(placeholder.subarray(0, 30)), "sof"],
    ["no SOF", crop(jpeg()), "sof"],
  ])(
    "stores a breach with a bad crop (%s) without it, and warns",
    async (_name, c, check) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const emit = vi.spyOn(hub, "emit");
      const id = randomUUID();
      await send({ id, crop: c });
      expect(await count("breach_event")).toBe(1);
      expect(await count("breach_crop")).toBe(0);
      expect(emit.mock.calls[0][1]).toMatchObject({ cropUrl: null });
      // One line naming the id and the check; never crop bytes.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]).toEqual([
        `[mqtt] vision/breach ${id} crop dropped: ${check} check failed`,
      ]);
    },
  );

  it("keeps an old ts as occurredAt", async () => {
    const emit = vi.spyOn(hub, "emit");
    const ts = Date.now() - 3 * HOUR_MS;
    await send({ id: randomUUID(), ts });
    const [rows] = await pool.query(
      "SELECT occurred_at, received_at FROM breach_event",
    );
    const r = (rows as Array<{ occurred_at: Date; received_at: Date }>)[0];
    expect(r.occurred_at.getTime()).toBe(ts);
    expect(r.received_at.getTime()).toBeGreaterThan(ts + 2 * HOUR_MS);
    expect(emit.mock.calls[0][1]).toMatchObject({
      occurredAt: new Date(ts).toISOString(),
    });
  });

  it("logs an insert failure without throwing or emitting", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const emit = vi.spyOn(hub, "emit");
    const broken = {
      getConnection: async () => {
        throw new Error("db down");
      },
    } as unknown as Pool;
    await send({ id: randomUUID(), crop: crop(placeholder) }, broken);
    expect(emit).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("[mqtt] vision/breach"),
      "db down",
    );
  });

  it("rolls the event back when the crop insert fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const emit = vi.spyOn(hub, "emit");
    const real = pool.getConnection.bind(pool);
    vi.spyOn(pool, "getConnection").mockImplementation(async () => {
      const conn = await real();
      const query = conn.query.bind(conn) as (...a: unknown[]) => unknown;
      vi.spyOn(conn, "query").mockImplementation((async (...a: unknown[]) => {
        if (String(a[0]).includes("INTO breach_crop"))
          throw new Error("crop failed");
        return query(...a);
      }) as typeof conn.query);
      return conn;
    });
    await send({ id: randomUUID(), crop: crop(placeholder) });
    expect(emit).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    expect(await count("breach_event")).toBe(0);
  });
});
