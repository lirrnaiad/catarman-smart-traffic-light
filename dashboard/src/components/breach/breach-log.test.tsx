import type { BreachItem } from "@stl/contracts";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createLiveBus } from "../../lib/live/hooks.ts";
import { LiveTestProvider } from "../../lib/live/live-test-provider.tsx";
import { BreachLog } from "./breach-log.tsx";
import { CropThumb } from "./crop-thumb.tsx";

const search = vi.hoisted(() => ({ current: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search.current),
}));

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
    receivedAt: "2026-10-23T06:32:08.100Z",
    approach: "E",
    vehicleClass: "tricycle",
    centroid: { x: 0.5, y: 0.5 },
    cropUrl: `/api/breaches/${id}/crop`,
    ...over,
  };
}

type Failure = { status: number; body: unknown };
type Pages = Record<
  string,
  { items: BreachItem[]; nextCursor: string | null } | Failure
>;
let fetchMock: ReturnType<typeof vi.fn>;

/** Answers `/api/breaches` by cursor ("" for page 1) and `/api/vehicle-classes`. */
function serve(pages: Pages | Failure) {
  fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("/api/vehicle-classes"))
      return new Response(JSON.stringify(CLASSES));
    const cursor = new URL(url, "http://x").searchParams.get("cursor") ?? "";
    const page = "status" in pages ? pages : pages[cursor];
    if ("status" in page && typeof page.status === "number")
      return new Response(JSON.stringify(page.body), { status: page.status });
    return new Response(JSON.stringify(page));
  });
  vi.stubGlobal("fetch", fetchMock);
}

const scrollIntoView = vi.fn();
beforeEach(() => {
  search.current = "";
  Element.prototype.scrollIntoView = scrollIntoView;
});
afterEach(() => {
  vi.unstubAllGlobals();
  scrollIntoView.mockClear();
});

const bodyRows = () =>
  screen.getAllByRole("row").slice(1) as HTMLTableRowElement[];
const ids = () => bodyRows().map((r) => r.dataset.id);

function mount(epoch = 1, bus = createLiveBus()) {
  const view = render(
    <LiveTestProvider epoch={epoch} bus={bus}>
      <BreachLog />
    </LiveTestProvider>,
  );
  return { view, bus };
}

it("shows page 1: Manila time and date, approach, class and the crop", async () => {
  serve({
    "": { items: [breach(1), breach(2, { cropUrl: null })], nextCursor: null },
  });
  mount();
  expect(screen.getByText("Loading breaches…")).toBeTruthy();
  const [first, second] = await screen
    .findAllByRole("row")
    .then((r) => r.slice(1));
  expect(first.textContent).toContain("14:32:08");
  expect(first.textContent).toContain("2026-10-23");
  expect(first.textContent).toContain("East approach");
  expect(await within(first).findByText("Tricycle")).toBeTruthy();
  const img = within(first).getByRole("img", {
    name: "Blurred, anonymized crop",
  }) as HTMLImageElement;
  expect(img.getAttribute("src")).toBe(`/api/breaches/${breach(1).id}/crop`);
  expect(within(second).getByText("No crop")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  expect(fetchMock).toHaveBeenCalledWith("/api/breaches?limit=50", undefined);
});

it("says so when there are no breaches", async () => {
  serve({ "": { items: [], nextCursor: null } });
  mount();
  expect(await screen.findByText("No breaches recorded.")).toBeTruthy();
});

it("shows an inline notice with the error code when REST fails", async () => {
  serve({ status: 500, body: { error: { code: "INTERNAL", message: "x" } } });
  mount();
  expect((await screen.findByRole("alert")).textContent).toContain("INTERNAL");
});

it("upserts each live breach by id at the top", async () => {
  serve({ "": { items: [breach(1)], nextCursor: null } });
  const { bus } = mount();
  await screen.findAllByRole("row");
  act(() => bus.emit("breach", breach(2)));
  act(() => bus.emit("breach", breach(2)));
  expect(ids()).toEqual([breach(2).id, breach(1).id]);
});

it("Load more follows nextCursor until it is null", async () => {
  serve({
    "": { items: [breach(3), breach(2)], nextCursor: "c1" },
    c1: { items: [breach(1)], nextCursor: null },
  });
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
  await screen.findByText(
    (_t, el) => el?.getAttribute("data-id") === breach(1).id,
  );
  expect(ids()).toEqual([breach(3).id, breach(2).id, breach(1).id]);
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/breaches?limit=50&cursor=c1",
    undefined,
  );
  expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
});

it("reloads page 1 on a new stream epoch, replacing the rows", async () => {
  serve({ "": { items: [breach(1)], nextCursor: null } });
  const { view, bus } = mount(1);
  await screen.findAllByRole("row");
  serve({ "": { items: [breach(5), breach(1)], nextCursor: null } });
  view.rerender(
    <LiveTestProvider epoch={2} bus={bus}>
      <BreachLog />
    </LiveTestProvider>,
  );
  await screen.findByText(
    (_t, el) => el?.getAttribute("data-id") === breach(5).id,
  );
  expect(ids()).toEqual([breach(5).id, breach(1).id]);
});

it("?id= scrolls to and marks the loaded row, once", async () => {
  search.current = `id=${breach(2).id}`;
  serve({ "": { items: [breach(1), breach(2)], nextCursor: null } });
  const { bus } = mount();
  await screen.findAllByRole("row");
  const marked = bodyRows().filter((r) => r.getAttribute("aria-current"));
  expect(marked.map((r) => r.dataset.id)).toEqual([breach(2).id]);
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
  expect(scrollIntoView.mock.contexts[0]).toBe(marked[0]);
  act(() => bus.emit("breach", breach(3)));
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
});

it("the thumb falls back to No crop when the image fails", () => {
  render(<CropThumb cropUrl="/api/breaches/x/crop" />);
  fireEvent.error(screen.getByRole("img"));
  expect(screen.getByText("No crop")).toBeTruthy();
  expect(screen.queryByRole("img")).toBeNull();
});

const byId = (n: number) => (_t: string, el: Element | null) =>
  el?.getAttribute("data-id") === breach(n).id;

it("a failed Load more shows the code, keeps the rows and re-enables the button", async () => {
  serve({
    "": { items: [breach(2)], nextCursor: "c1" },
    c1: { status: 500, body: { error: { code: "INTERNAL", message: "x" } } },
  });
  mount();
  fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
  expect((await screen.findByRole("alert")).textContent).toContain("INTERNAL");
  expect(ids()).toEqual([breach(2).id]);
  const button = screen.getByRole("button", { name: "Load more" });
  expect((button as HTMLButtonElement).disabled).toBe(false);
});

it("?id= marks a row that Load more brings in, scrolling once", async () => {
  search.current = `id=${breach(1).id}`;
  serve({
    "": { items: [breach(2)], nextCursor: "c1" },
    c1: { items: [breach(1)], nextCursor: null },
  });
  mount();
  await screen.findAllByRole("row");
  expect(bodyRows().filter((r) => r.getAttribute("aria-current"))).toEqual([]);
  expect(scrollIntoView).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Load more" }));
  await screen.findByText(byId(1));
  const marked = bodyRows().filter((r) => r.getAttribute("aria-current"));
  expect(marked.map((r) => r.dataset.id)).toEqual([breach(1).id]);
  expect(scrollIntoView).toHaveBeenCalledTimes(1);
});

it("drops a Load more answered after a new stream epoch", async () => {
  let answerOld: (r: Response) => void = () => {};
  const json = (body: unknown) => new Response(JSON.stringify(body));
  let page1: { items: BreachItem[]; nextCursor: string | null } = {
    items: [breach(3)],
    nextCursor: "old",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.endsWith("/api/vehicle-classes"))
        return Promise.resolve(json(CLASSES));
      if (url.includes("cursor=old"))
        return new Promise<Response>((resolve) => {
          answerOld = resolve;
        });
      return Promise.resolve(json(page1));
    }),
  );
  const { view, bus } = mount(1);
  fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
  page1 = { items: [breach(5), breach(3)], nextCursor: null };
  view.rerender(
    <LiveTestProvider epoch={2} bus={bus}>
      <BreachLog />
    </LiveTestProvider>,
  );
  await screen.findByText(byId(5));
  await act(async () =>
    answerOld(json({ items: [breach(1)], nextCursor: "older" })),
  );
  expect(ids()).toEqual([breach(5).id, breach(3).id]);
  expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
});
