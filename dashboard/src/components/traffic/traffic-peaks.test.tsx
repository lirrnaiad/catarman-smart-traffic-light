import type { HourCounts } from "@stl/contracts";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LiveTestProvider } from "../../lib/live/live-test-provider.tsx";
import { TrafficPeaks } from "./traffic-peaks.tsx";

const search = vi.hoisted(() => ({ current: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.current),
}));

const CLASSES = [
  { id: "car", label: "Car", pcu: 1 },
  { id: "tricycle", label: "Tricycle", pcu: 0.5 },
];
const TODAY = "2026-10-22";
// Manila 2026-10-22 00:00 is 2026-10-21 16:00 UTC.
const hourStart = (date: string, h: number) =>
  new Date(Date.parse(`${date}T00:00:00+08:00`) + h * 3_600_000).toISOString();

/** Cars on N and tricycles on S, so the chart must sum approaches. */
function bucket(
  date: string,
  h: number,
  car: number,
  tricycle: number,
): HourCounts {
  const zero = { car: 0, tricycle: 0 };
  return {
    hourStart: hourStart(date, h),
    total: car + tricycle,
    byApproach: {
      N: { ...zero, car },
      S: { ...zero, tricycle },
      E: zero,
      W: zero,
    },
  };
}

function day(date: string, counts: Record<number, [number, number]> = {}) {
  return {
    date,
    buckets: Array.from({ length: 24 }, (_, h) =>
      bucket(date, h, ...(counts[h] ?? [0, 0])),
    ),
  };
}

let hourly: { status: number; body: unknown };
const fetchMock = vi.fn(async (url: string) =>
  url.startsWith("/api/vehicle-classes")
    ? new Response(JSON.stringify(CLASSES))
    : new Response(JSON.stringify(hourly.body), { status: hourly.status }),
);

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-22T10:42:00Z"), toFake: ["Date"] });
  vi.stubGlobal("fetch", fetchMock);
  search.current = "";
  hourly = {
    status: 200,
    body: day(TODAY, { 7: [100, 50], 17: [100, 148], 18: [10, 5] }),
  };
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchMock.mockClear();
});

const hourlyCalls = () =>
  fetchMock.mock.calls.map(([u]) => u).filter((u) => u.includes("/hourly"));

function rows() {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .map((r) => [...r.children].map((c) => c.textContent));
}

it("shows 24 hours stacked by class in file order, summed over approaches", async () => {
  render(
    <LiveTestProvider>
      <TrafficPeaks />
    </LiveTestProvider>,
  );
  await screen.findByRole("table");
  const all = rows();
  expect(all[0]).toEqual(["Hour", "Car", "Tricycle", "Total"]);
  expect(all).toHaveLength(25);
  expect(all[1]).toEqual(["00:00", "0", "0", "0"]);
  expect(all[18]).toEqual(["17:00", "100", "148", "248"]);
  expect(all[24][0]).toBe("23:00");
  expect(screen.getByText("Peak 17:00 · 248 vehicles")).toBeTruthy();
  expect(
    document.querySelector("svg[aria-label]")?.getAttribute("aria-label"),
  ).toContain("Peak 17:00 · 248 vehicles");
  expect(hourlyCalls()).toEqual([`/api/counts/hourly?date=${TODAY}`]);
});

it("flags the earliest hour on a tie", async () => {
  hourly.body = day(TODAY, { 7: [100, 148], 17: [100, 148] });
  render(<TrafficPeaks />);
  expect(await screen.findByText("Peak 07:00 · 248 vehicles")).toBeTruthy();
});

it("replaces today's live hour with the counts slice and counts it in the peak", async () => {
  const live = bucket(TODAY, 18, 200, 63);
  render(
    <LiveTestProvider slices={{ counts: live }}>
      <TrafficPeaks />
    </LiveTestProvider>,
  );
  await screen.findByRole("table");
  expect(rows()[19]).toEqual(["18:00 (live)", "200", "63", "263"]);
  expect(screen.getByText("Live · 263 so far")).toBeTruthy();
  expect(document.querySelectorAll("[data-live-cap]")).toHaveLength(1);
  expect(screen.getByText("Peak 18:00 · 263 vehicles")).toBeTruthy();
});

it("shows today with the Today flag and Next day disabled", async () => {
  render(<TrafficPeaks />);
  await screen.findByRole("table");
  expect(screen.getByText("Thu 22 Oct 2026")).toBeTruthy();
  expect(screen.getByText("Today")).toBeTruthy();
  const next = screen.getByRole("button", { name: "Next day" });
  expect((next as HTMLButtonElement).disabled).toBe(true);
  expect(
    screen.getByRole("link", { name: "Prev day" }).getAttribute("href"),
  ).toMatch(/^\/traffic\/?\?date=2026-10-21$/);
});

it("ignores the slice on another day and enables Next day", async () => {
  search.current = "date=2026-10-21";
  hourly.body = day("2026-10-21", { 9: [3, 4] });
  render(
    <LiveTestProvider slices={{ counts: bucket(TODAY, 18, 9, 9) }}>
      <TrafficPeaks />
    </LiveTestProvider>,
  );
  await screen.findByRole("table");
  expect(hourlyCalls()).toEqual(["/api/counts/hourly?date=2026-10-21"]);
  expect(screen.getByText("Wed 21 Oct 2026")).toBeTruthy();
  expect(screen.queryByText("Today")).toBeNull();
  expect(screen.queryByText(/so far/)).toBeNull();
  expect(document.querySelector("[data-live-cap]")).toBeNull();
  expect(rows().some((r) => r[0]?.includes("live"))).toBe(false);
  expect(
    screen.getByRole("link", { name: "Next day" }).getAttribute("href"),
  ).toMatch(/^\/traffic\/?\?date=2026-10-22$/);
});

it("falls back to today on a bad ?date=", async () => {
  search.current = "date=xyz";
  render(<TrafficPeaks />);
  await screen.findByRole("table");
  expect(hourlyCalls()).toEqual([`/api/counts/hourly?date=${TODAY}`]);
});

it("reads 'No vehicles counted.' on an empty day", async () => {
  hourly.body = day(TODAY);
  render(<TrafficPeaks />);
  expect(await screen.findByText("No vehicles counted.")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
});

it("shows loading, then an inline notice with the code on a REST failure", async () => {
  hourly = {
    status: 500,
    body: { error: { code: "INTERNAL", message: "boom" } },
  };
  render(<TrafficPeaks />);
  expect(screen.getByText("Loading traffic…")).toBeTruthy();
  expect((await screen.findByRole("alert")).textContent).toContain("INTERNAL");
});

it("reloads the day on each stream epoch", async () => {
  const view = render(
    <LiveTestProvider epoch={1}>
      <TrafficPeaks />
    </LiveTestProvider>,
  );
  await screen.findByRole("table");
  hourly.body = day(TODAY, { 17: [300, 0] });
  view.rerender(
    <LiveTestProvider epoch={2}>
      <TrafficPeaks />
    </LiveTestProvider>,
  );
  expect(await screen.findByText("Peak 17:00 · 300 vehicles")).toBeTruthy();
  expect(hourlyCalls()).toHaveLength(2);
});

it("falls back to today on a future ?date=", async () => {
  search.current = "date=2026-10-23";
  render(<TrafficPeaks />);
  await screen.findByRole("table");
  expect(hourlyCalls()).toEqual([`/api/counts/hourly?date=${TODAY}`]);
  expect(screen.getByText("Today")).toBeTruthy();
});

it("uses the Manila date for today when UTC is still on the day before", async () => {
  // 2026-10-21 17:00 UTC is 2026-10-22 01:00 in Manila.
  vi.setSystemTime(new Date("2026-10-21T17:00:00Z"));
  render(<TrafficPeaks />);
  await screen.findByRole("table");
  expect(hourlyCalls()).toEqual([`/api/counts/hourly?date=${TODAY}`]);
  expect(screen.getByText("Today")).toBeTruthy();
});

it("loads the new day when ?date= changes while mounted", async () => {
  search.current = `date=${TODAY}`;
  const view = render(<TrafficPeaks />);
  await screen.findByRole("table");
  search.current = "date=2026-10-21";
  hourly.body = day("2026-10-21", { 9: [3, 4] });
  view.rerender(<TrafficPeaks />);
  expect(await screen.findByText("Wed 21 Oct 2026")).toBeTruthy();
  expect(await screen.findByText("Peak 09:00 · 7 vehicles")).toBeTruthy();
  expect(hourlyCalls()).toEqual([
    `/api/counts/hourly?date=${TODAY}`,
    "/api/counts/hourly?date=2026-10-21",
  ]);
});

it("reloads the day when the live hour rolls over", async () => {
  const view = render(
    <LiveTestProvider slices={{ counts: bucket(TODAY, 17, 1, 1) }}>
      <TrafficPeaks />
    </LiveTestProvider>,
  );
  await screen.findByRole("table");
  // The finished 17:00 hour now holds what the slice had shown, and more.
  hourly.body = day(TODAY, { 17: [200, 200] });
  view.rerender(
    <LiveTestProvider slices={{ counts: bucket(TODAY, 18, 0, 1) }}>
      <TrafficPeaks />
    </LiveTestProvider>,
  );
  expect(await screen.findByText("Peak 17:00 · 400 vehicles")).toBeTruthy();
  expect(hourlyCalls()).toHaveLength(2);
});
