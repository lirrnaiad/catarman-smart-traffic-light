const MAX_SKEW_MS = 24 * 60 * 60 * 1000;

/** AD-6: a vision event's time is its `ts`, unless missing or more than 24 h from `receivedAt`. */
export function occurredAt(ts: number | undefined, receivedAt: Date): Date {
  if (ts === undefined) return receivedAt;
  if (Math.abs(ts - receivedAt.getTime()) > MAX_SKEW_MS) {
    console.warn(
      `[mqtt] ts ${ts} is more than 24 h from receivedAt ${receivedAt.toISOString()}; using receivedAt`,
    );
    return receivedAt;
  }
  return new Date(ts);
}
