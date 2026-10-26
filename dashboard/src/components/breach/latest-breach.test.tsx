import type { BreachItem, LinkSlice } from "@stl/contracts";
import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createLiveBus } from "../../lib/live/hooks.ts";
import { LiveTestProvider } from "../../lib/live/live-test-provider.tsx";
import { simLink } from "../shell/fixtures.ts";
import { LatestBreach } from "./latest-breach.tsx";

const CLASSES = [
  { id: "car", label: "Car", pcu: 1 },
  { id: "tricycle", label: "Tricycle", pcu: 0.5 },
];

function breach(n: number, over: Partial<BreachItem> = {}): BreachItem {
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  return {
    id,
    // 06:32:08Z is 14:32:08 in Asia/Manila.
    occurredAt: "2026-10-23T06:32:08.000Z",
    receivedAt: `2026-10-23T06:32:${String(8 + n).padStart(2, "0")}.000Z`,
    approach: "E",
    vehicleClass: "tricycle",
    centroid: { x: 0.5, y: 0.5 },
    cropUrl: `/api/breaches/${id}/crop`,
    ...over,
  };
}

/** Answers `/api/breaches?limit=1` with `pages` in turn (the last repeats) and `/api/vehicle-classes`. */
function serve(...pages: (BreachItem[] | { status: number; body: unknown })[]) {
  let call = 0;
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("/api/vehicle-classes"))
      return new Response(JSON.stringify(CLASSES));
    const page = pages[Math.min(call++, pages.length - 1)];
    if (!Array.isArray(page))
      return new Response(JSON.stringify(page.body), { status: page.status });
    return new Response(JSON.stringify({ items: page, nextCursor: null }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

function mount(
  { epoch = 1, link = simLink }: { epoch?: number; link?: LinkSlice } = {},
  bus = createLiveBus(),
) {
  const view = render(
    <LiveTestProvider slices={{ link }} epoch={epoch} bus={bus}>
      <LatestBreach />
    </LiveTestProvider>,
  );
  return { view, bus };
}

const link = () => screen.getByRole("link") as HTMLAnchorElement;
// next.config's trailingSlash puts the "/" before "?" in the build; vitest doesn't load it.
const href = () => link().getAttribute("href")?.replace("/?", "?");

it("loads the newest breach: time, approach, class, crop and a link to its row", async () => {
  const fetchMock = serve([breach(1)]);
  mount();
  expect(await screen.findByText("14:32:08")).toBeTruthy();
  expect(screen.getByText("East approach")).toBeTruthy();
  expect(await screen.findByText("Tricycle")).toBeTruthy();
  expect(
    screen.getByRole("img", { name: "Blurred, anonymized crop" }),
  ).toBeTruthy();
  expect(href()).toBe(`/breaches?id=${breach(1).id}`);
  expect(link().getAttribute("aria-label")).toMatch(
    /14:32:08, East approach, Tricycle/,
  );
  expect(fetchMock.mock.calls.map(([url]) => String(url))).toContainEqual(
    expect.stringMatching(/\/api\/breaches\?limit=1$/),
  );
});

it("each live breach replaces it", async () => {
  serve([breach(1)]);
  const { bus } = mount();
  await screen.findByText("14:32:08");
  act(() =>
    bus.emit(
      "breach",
      breach(2, {
        occurredAt: "2026-10-23T06:40:00.000Z",
        approach: "W",
        cropUrl: null,
      }),
    ),
  );
  expect(screen.getByText("14:40:00")).toBeTruthy();
  expect(screen.getByText("West approach")).toBeTruthy();
  expect(screen.getByText("No crop")).toBeTruthy();
  expect(href()).toBe(`/breaches?id=${breach(2).id}`);
});

it("reloads on a new stream epoch", async () => {
  serve([breach(1)], [breach(3, { occurredAt: "2026-10-23T07:00:00.000Z" })]);
  const bus = createLiveBus();
  const { view } = mount({ epoch: 1 }, bus);
  await screen.findByText("14:32:08");
  view.rerender(
    <LiveTestProvider slices={{ link: simLink }} epoch={2} bus={bus}>
      <LatestBreach />
    </LiveTestProvider>,
  );
  expect(await screen.findByText("15:00:00")).toBeTruthy();
});

it("keeps a live breach that is newer than a reload's answer", async () => {
  let release!: () => void;
  const held = new Promise<void>((r) => {
    release = r;
  });
  const old = breach(1);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/api/vehicle-classes"))
        return new Response(JSON.stringify(CLASSES));
      await held;
      return new Response(JSON.stringify({ items: [old], nextCursor: null }));
    }),
  );
  const { bus } = mount();
  act(() =>
    bus.emit("breach", breach(5, { occurredAt: "2026-10-23T08:00:00.000Z" })),
  );
  expect(screen.getByText("16:00:00")).toBeTruthy();
  await act(async () => release());
  expect(screen.getByText("16:00:00")).toBeTruthy();
  expect(screen.queryByText("14:32:08")).toBeNull();
});

it("says so when no breach is stored", async () => {
  serve([]);
  mount();
  expect(await screen.findByText("No breaches recorded.")).toBeTruthy();
  expect(screen.queryByRole("link")).toBeNull();
});

it("shows an inline notice with the error code when REST fails", async () => {
  serve({
    status: 500,
    body: { error: { code: "INTERNAL", message: "boom" } },
  });
  const { bus } = mount();
  expect((await screen.findByRole("alert")).textContent).toMatch(/INTERNAL/);
  // A live breach is fresh data: the notice goes.
  act(() => bus.emit("breach", breach(1)));
  expect(screen.getByText("14:32:08")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

it("vision STALE: keeps the last breach under a StaleBadge", async () => {
  serve([breach(1)]);
  mount({
    link: { ...simLink, vision: { ...simLink.vision, status: "STALE" } },
  });
  expect(await screen.findByText("14:32:08")).toBeTruthy();
  // The badge shows the last breach's receivedAt (06:32:09Z → 14:32:09).
  expect(await screen.findByText("STALE · 14:32:09")).toBeTruthy();
  expect(screen.queryByText("Red-light running · anonymized")).toBeNull();
});
