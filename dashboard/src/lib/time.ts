// Every displayed time goes through here: Asia/Manila via Intl, never offset arithmetic.
const manila = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parts(iso: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of manila.formatToParts(new Date(iso))) out[p.type] = p.value;
  return out;
}

/** `HH:mm:ss` (24-hour) in Asia/Manila, or `YYYY-MM-DD` with `"date"`. */
export function formatManila(
  iso: string,
  as: "time" | "date" = "time",
): string {
  const p = parts(iso);
  return as === "date"
    ? `${p.year}-${p.month}-${p.day}`
    : `${p.hour}:${p.minute}:${p.second}`;
}

/** `HH:00` for the Asia/Manila hour that starts at `hourStartIso`. */
export function manilaHourLabel(hourStartIso: string): string {
  return `${parts(hourStartIso).hour}:00`;
}

const manilaDay = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Manila",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** `Thu 22 Oct 2026` for an Asia/Manila `YYYY-MM-DD`, read at Manila noon. */
export function manilaDayLabel(date: string): string {
  return manilaDay.format(new Date(`${date}T12:00:00+08:00`)).replace(",", "");
}
