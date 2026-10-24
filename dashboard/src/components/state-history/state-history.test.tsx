import type { Page, StateChangeItem } from "@stl/contracts";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LiveTestProvider } from "../../lib/live/live-test-provider.tsx";
import { StateHistory } from "./state-history.tsx";

const CMD = "00000000-0000-4000-8000-0000000000a1";
const at = (s: number) => `2026-10-24T06:32:${String(s).padStart(2, "0")}.000Z`;
const base: StateChangeItem = {
  receivedAt: at(0),
  level: "L1",
  signals: { NS: "GREEN", EW: "RED" },
  flood: "DRY",
  fault: false,
  override: null,
  overrideEnded: false,
};
const item = (s: number, patch: Partial<StateChangeItem> = {}) => ({
  ...base,
  receivedAt: at(s),
  ...patch,
});

/** Answers each fetch with the next page, or an HTTP error status. */
function serve(...pages: Array<Page<StateChangeItem> | number>) {
  const fetchMock = vi.fn(async (_url: string) => {
    const next = pages.shift() ?? { items: [], nextCursor: null };
    return typeof next === "number"
      ? new Response(
          JSON.stringify({ error: { code: "INTERNAL", message: "boom" } }),
          { status: next },
        )
      : new Response(JSON.stringify(next), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const rows = () => screen.queryAllByRole("row").slice(1);
const cells = (r: HTMLElement) =>
  within(r)
    .getAllByRole("cell")
    .map((c) => {
      // The visible text, without the screen-reader-only "changed" word.
      const copy = c.cloneNode(true) as HTMLElement;
      for (const sr of copy.querySelectorAll(".sr-only")) sr.remove();
      return copy.textContent;
    });
/** A marked cell carries both the notch and the hidden word for screen readers. */
const changed = (r: HTMLElement) =>
  within(r)
    .getAllByRole("cell")
    .map((c) => {
      const word = c.querySelector(".sr-only")?.textContent === " changed";
      expect(c.hasAttribute("data-changed")).toBe(word);
      return word;
    });

const show = (epoch = 1) => (
  <LiveTestProvider epoch={epoch}>
    <StateHistory />
  </LiveTestProvider>
);

afterEach(() => vi.unstubAllGlobals());

it("renders each column in Manila time, labels an ended row, and marks changed cells", async () => {
  serve({
    items: [
      item(9, {
        level: "L4",
        signals: { NS: "FLASHING_AMBER", EW: "FLASHING_AMBER" },
        flood: "FLOODED",
        override: { mode: "NONE", commandId: CMD },
        overrideEnded: true,
      }),
      item(8, {
        level: "L4",
        flood: "FLOODED",
        override: { mode: "CORRIDOR", phase: "NS", commandId: CMD },
      }),
      item(7, { fault: true, signals: { NS: "DARK", EW: "YELLOW" } }),
      item(6, { override: { mode: "NONE" } }),
    ],
    nextCursor: null,
  });
  render(show());
  await waitFor(() => expect(rows()).toHaveLength(4));
  const [ended, corridor, fault, boot] = rows();

  expect(cells(ended)).toEqual([
    "14:32:092026-10-24Latest",
    "L4Flashing Amber",
    "Flashing amber",
    "Flashing amber",
    "Flooded",
    "None",
    "Override ended (link loss or fault)",
  ]);
  expect(cells(corridor).slice(4)).toEqual(["Flooded", "None", "Corridor NS"]);
  expect(cells(fault)).toEqual([
    "14:32:072026-10-24",
    "L1Vision adaptive",
    "Dark",
    "Yellow",
    "Dry",
    "FAULT · Conflict monitor",
    "None",
  ]);
  expect(cells(boot)[6]).toBe("None");
  expect(
    within(ended).getByRole("img", { name: "NS: flashing amber" }),
  ).toBeTruthy();

  // Only the first row of page 1 is flagged Latest.
  expect(document.querySelectorAll("[data-latest]")).toHaveLength(1);
  // Cells differing from the next older row; the oldest loaded row has nothing to compare.
  expect(changed(ended)).toEqual([
    false,
    false,
    true,
    true,
    false,
    false,
    true,
  ]);
  expect(changed(corridor)).toEqual([
    false,
    true,
    true,
    true,
    true,
    true,
    true,
  ]);
  expect(changed(boot)).toEqual([
    false,
    false,
    false,
    false,
    false,
    false,
    false,
  ]);
  // L4 and fault row edges; a fault row never takes the L4 edge.
  expect(rows().map((r) => r.getAttribute("data-edge"))).toEqual([
    "l4",
    "l4",
    "fault",
    null,
  ]);
  expect(screen.getByText("Changed from the row below")).toBeTruthy();
});

it("a fault at L4 takes the fault edge, not the L4 one", async () => {
  serve({ items: [item(1, { level: "L4", fault: true })], nextCursor: null });
  render(show());
  await waitFor(() => expect(rows()).toHaveLength(1));
  expect(rows()[0].getAttribute("data-edge")).toBe("fault");
});

it("refetches page 1 when the stream epoch increments", async () => {
  const fetchMock = serve(
    { items: [item(1)], nextCursor: null },
    { items: [item(2, { level: "L2" }), item(1)], nextCursor: null },
  );
  const { rerender } = render(show(1));
  await waitFor(() => expect(rows()).toHaveLength(1));
  rerender(show(2));
  await waitFor(() => expect(rows()).toHaveLength(2));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][0]).toBe("/api/state-changes?limit=50");
});

it("Load more follows nextCursor, 50 at a time, and hides on the last page", async () => {
  const fetchMock = serve(
    { items: [item(2)], nextCursor: "c1" },
    { items: [item(1, { flood: "WET" })], nextCursor: null },
  );
  render(show());
  const more = await screen.findByRole("button", { name: "Load more" });
  await act(async () => more.click());
  await waitFor(() => expect(rows()).toHaveLength(2));
  expect(fetchMock.mock.calls[1][0]).toBe(
    "/api/state-changes?limit=50&cursor=c1",
  );
  expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  // The loaded older row now gives the first row something to compare.
  expect(changed(rows()[0])[4]).toBe(true);
});

it("empty: No state changes recorded.", async () => {
  serve({ items: [], nextCursor: null });
  render(show());
  expect(await screen.findByText("No state changes recorded.")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
});

it("REST failure: an inline notice with the code", async () => {
  serve(500);
  render(show());
  expect((await screen.findByRole("alert")).textContent).toBe(
    "State history unavailable · INTERNAL",
  );
  expect(screen.queryByText("No state changes recorded.")).toBeNull();
});

it("drops a Load more that resolves after an epoch refetch", async () => {
  const pending: Array<(r: Response) => void> = [];
  const fetchMock = vi.fn(
    (_url: string) => new Promise<Response>((r) => pending.push(r)),
  );
  vi.stubGlobal("fetch", fetchMock);
  const reply = (i: number, page: Page<StateChangeItem>) =>
    act(async () => pending[i](new Response(JSON.stringify(page))));
  const { rerender } = render(show(1));
  await reply(0, { items: [item(2)], nextCursor: "c1" });
  const more = await screen.findByRole("button", { name: "Load more" });
  await act(async () => more.click());
  rerender(show(2));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  await reply(2, { items: [item(3), item(2)], nextCursor: null });
  await reply(1, { items: [item(1)], nextCursor: "stale" });
  expect(rows().map((r) => cells(r)[0])).toEqual([
    "14:32:032026-10-24Latest",
    "14:32:022026-10-24",
  ]);
  expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
});

it("a failed Load more shows its own notice and keeps the rows", async () => {
  serve({ items: [item(2)], nextCursor: "c1" }, 500);
  render(show());
  const more = await screen.findByRole("button", { name: "Load more" });
  await act(async () => more.click());
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Load more failed · INTERNAL",
  );
  expect(screen.queryByText(/State history unavailable/)).toBeNull();
  expect(rows()).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Load more" })).toBeTruthy();
});
