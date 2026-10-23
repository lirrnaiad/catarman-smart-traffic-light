import { afterEach, describe, expect, it, vi } from "vitest";
import { occurredAt } from "./occurred-at.ts";

const receivedAt = new Date("2026-10-23T08:00:00.000Z");
const HOUR = 3_600_000;

describe("occurredAt", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses receivedAt when ts is absent", () => {
    expect(occurredAt(undefined, receivedAt)).toBe(receivedAt);
  });

  it("uses ts within 24 h", () => {
    const ts = receivedAt.getTime() - 23 * HOUR;
    expect(occurredAt(ts, receivedAt).getTime()).toBe(ts);
  });

  it("falls back to receivedAt and warns when ts is more than 24 h off", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(occurredAt(receivedAt.getTime() + 25 * HOUR, receivedAt)).toBe(
      receivedAt,
    );
    expect(occurredAt(receivedAt.getTime() - 25 * HOUR, receivedAt)).toBe(
      receivedAt,
    );
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0][0]).toMatch(/^\[mqtt\]/);
  });
});
