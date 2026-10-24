import type { OverrideCommand, Page } from "@stl/contracts";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createLiveBus } from "../../lib/live/hooks.ts";
import { LiveTestProvider } from "../../lib/live/live-test-provider.tsx";
import { OverrideLog } from "./override-log.tsx";

const base: OverrideCommand = {
  commandId: "00000000-0000-4000-8000-000000000001",
  mode: "CORRIDOR",
  phase: "NS",
  status: "APPLIED",
  reason: null,
  requestedAt: "2026-10-23T06:32:08.000Z",
  resolvedAt: "2026-10-23T06:32:09.000Z",
};
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const cmd = (n: number, patch: Partial<OverrideCommand> = {}) => ({
  ...base,
  commandId: id(n),
  ...patch,
});

/** Answers each fetch with the next page, or an HTTP error status. */
function serve(...pages: Array<Page<OverrideCommand> | number>) {
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

const ids = () =>
  screen
    .queryAllByRole("row")
    .slice(1)
    .map((r) => r.getAttribute("data-command-id"));

const row = (n: number) =>
  document.querySelector(`[data-command-id="${id(n)}"]`) as HTMLElement;

const statusOf = (n: number) =>
  row(n)?.querySelector("[data-status]")?.getAttribute("data-status");

afterEach(() => vi.unstubAllGlobals());

it("renders each column: Manila times, mode with phase, plate, reason label", async () => {
  serve({
    items: [
      cmd(1),
      cmd(2, { status: "REJECTED", reason: "CONFLICT_FAULT", phase: "EW" }),
      cmd(3, {
        status: "TIMEOUT",
        resolvedAt: null,
        mode: "FLASHING_AMBER",
        phase: null,
      }),
      cmd(4, {
        status: "REJECTED",
        reason: "SOME_CODE",
        mode: "NONE",
        phase: null,
      }),
      cmd(5, { status: "REQUESTED", resolvedAt: null }),
    ],
    nextCursor: null,
  });
  render(
    <LiveTestProvider>
      <OverrideLog />
    </LiveTestProvider>,
  );
  await waitFor(() => expect(ids()).toHaveLength(5));
  const cells = (n: number) =>
    within(row(n))
      .getAllByRole("cell")
      .map((c) => c.textContent);

  expect(cells(1)).toEqual([
    "14:32:082026-10-23",
    "Corridor NS",
    "Applied",
    "—",
    "14:32:092026-10-23",
  ]);
  expect(cells(2).slice(1, 4)).toEqual([
    "Corridor EW",
    "Rejected",
    "Conflict fault",
  ]);
  expect(cells(3)).toEqual([
    "14:32:082026-10-23",
    "Flashing amber",
    "No reply from controller in 5 s",
    "—",
    "—",
  ]);
  expect(cells(4).slice(1, 4)).toEqual(["None", "Rejected", "SOME_CODE"]);
  expect(cells(5)[2]).toBe("Pending · waiting for controller");

  // The hazard edge marks only REJECTED and TIMEOUT.
  const hazard = (n: number) => row(n).querySelector("[data-hazard]") !== null;
  expect([1, 2, 3, 4, 5].map(hazard)).toEqual([false, true, true, true, false]);
});

it("upserts SSE override: a new id on top, then its status changes in place", async () => {
  serve({ items: [cmd(1)], nextCursor: null });
  const bus = createLiveBus();
  render(
    <LiveTestProvider bus={bus}>
      <OverrideLog />
    </LiveTestProvider>,
  );
  await waitFor(() => expect(ids()).toEqual([id(1)]));

  act(() =>
    bus.emit("override", cmd(2, { status: "REQUESTED", resolvedAt: null })),
  );
  expect(ids()).toEqual([id(2), id(1)]);
  expect(statusOf(2)).toBe("REQUESTED");

  act(() => bus.emit("override", cmd(2, { status: "APPLIED" })));
  expect(ids()).toEqual([id(2), id(1)]);
  expect(statusOf(2)).toBe("APPLIED");
});

it("keeps an SSE update that lands while page 1 is in flight", async () => {
  let release: (r: Response) => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((r) => {
          release = r;
        }),
    ),
  );
  const bus = createLiveBus();
  render(
    <LiveTestProvider bus={bus}>
      <OverrideLog />
    </LiveTestProvider>,
  );
  act(() => bus.emit("override", cmd(1, { status: "APPLIED" })));
  const stale = { items: [cmd(1, { status: "REQUESTED" })], nextCursor: null };
  await act(async () => release(new Response(JSON.stringify(stale))));
  await waitFor(() => expect(ids()).toEqual([id(1)]));
  expect(statusOf(1)).toBe("APPLIED");
});

it("refetches page 1 when the stream epoch increments", async () => {
  const fetchMock = serve(
    { items: [cmd(1)], nextCursor: null },
    { items: [cmd(2), cmd(1)], nextCursor: null },
  );
  const { rerender } = render(
    <LiveTestProvider epoch={1}>
      <OverrideLog />
    </LiveTestProvider>,
  );
  await waitFor(() => expect(ids()).toEqual([id(1)]));
  rerender(
    <LiveTestProvider epoch={2}>
      <OverrideLog />
    </LiveTestProvider>,
  );
  await waitFor(() => expect(ids()).toEqual([id(2), id(1)]));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][0]).toBe("/api/overrides?limit=50");
});

it("Load more follows nextCursor, 50 at a time, and hides on the last page", async () => {
  const fetchMock = serve(
    { items: [cmd(2)], nextCursor: "c1" },
    { items: [cmd(1)], nextCursor: null },
  );
  render(
    <LiveTestProvider>
      <OverrideLog />
    </LiveTestProvider>,
  );
  const more = await screen.findByRole("button", { name: "Load more" });
  await act(async () => more.click());
  await waitFor(() => expect(ids()).toEqual([id(2), id(1)]));
  expect(fetchMock.mock.calls[1][0]).toBe("/api/overrides?limit=50&cursor=c1");
  expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
});

it("empty: No overrides yet.", async () => {
  serve({ items: [], nextCursor: null });
  render(
    <LiveTestProvider>
      <OverrideLog />
    </LiveTestProvider>,
  );
  expect(await screen.findByText("No overrides yet.")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
});

it("REST failure: an inline notice with the code", async () => {
  serve(500);
  render(
    <LiveTestProvider>
      <OverrideLog />
    </LiveTestProvider>,
  );
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Override log unavailable · INTERNAL",
  );
  expect(screen.queryByText("No overrides yet.")).toBeNull();
});

const at = (s: number) => `2026-10-23T06:32:0${s}.000Z`;

it("puts an SSE row for an unloaded id at its newest-first place", async () => {
  serve({
    items: [cmd(3, { requestedAt: at(3) }), cmd(1, { requestedAt: at(1) })],
    nextCursor: null,
  });
  const bus = createLiveBus();
  render(
    <LiveTestProvider bus={bus}>
      <OverrideLog />
    </LiveTestProvider>,
  );
  await waitFor(() => expect(ids()).toEqual([id(3), id(1)]));
  act(() => bus.emit("override", cmd(2, { requestedAt: at(2) })));
  expect(ids()).toEqual([id(3), id(2), id(1)]);
  // Same requestedAt: the larger commandId comes first.
  act(() => bus.emit("override", cmd(4, { requestedAt: at(1) })));
  expect(ids()).toEqual([id(3), id(2), id(4), id(1)]);
});

it("skips an SSE row older than the last loaded one while more pages exist", async () => {
  serve({ items: [cmd(3, { requestedAt: at(3) })], nextCursor: "c1" });
  const bus = createLiveBus();
  render(
    <LiveTestProvider bus={bus}>
      <OverrideLog />
    </LiveTestProvider>,
  );
  await waitFor(() => expect(ids()).toEqual([id(3)]));
  act(() => bus.emit("override", cmd(1, { requestedAt: at(1) })));
  expect(ids()).toEqual([id(3)]);
});

it("Load more keeps the live status of a row it already has", async () => {
  serve(
    { items: [cmd(2)], nextCursor: "c1" },
    {
      items: [cmd(1, { status: "TIMEOUT", resolvedAt: null })],
      nextCursor: null,
    },
  );
  const bus = createLiveBus();
  render(
    <LiveTestProvider bus={bus}>
      <OverrideLog />
    </LiveTestProvider>,
  );
  const more = await screen.findByRole("button", { name: "Load more" });
  // Placed while loaded (it is newer than cmd(2)), then page 2 repeats it as TIMEOUT.
  act(() =>
    bus.emit("override", cmd(1, { status: "APPLIED", requestedAt: at(9) })),
  );
  expect(ids()).toEqual([id(1), id(2)]);
  await act(async () => more.click());
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull(),
  );
  expect(ids()).toEqual([id(1), id(2)]);
  expect(statusOf(1)).toBe("APPLIED");
});

it("drops a Load more that resolves after an epoch refetch", async () => {
  const pending: Array<(r: Response) => void> = [];
  const fetchMock = vi.fn(
    (_url: string) => new Promise<Response>((r) => pending.push(r)),
  );
  vi.stubGlobal("fetch", fetchMock);
  const reply = (i: number, page: Page<OverrideCommand>) =>
    act(async () => pending[i](new Response(JSON.stringify(page))));
  const { rerender } = render(
    <LiveTestProvider epoch={1}>
      <OverrideLog />
    </LiveTestProvider>,
  );
  await reply(0, { items: [cmd(2)], nextCursor: "c1" });
  const more = await screen.findByRole("button", { name: "Load more" });
  await act(async () => more.click());
  rerender(
    <LiveTestProvider epoch={2}>
      <OverrideLog />
    </LiveTestProvider>,
  );
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  await reply(2, { items: [cmd(3), cmd(2)], nextCursor: null });
  await reply(1, { items: [cmd(1)], nextCursor: "stale" });
  expect(ids()).toEqual([id(3), id(2)]);
  expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
});

it("a failed Load more shows its own notice and keeps the rows", async () => {
  serve({ items: [cmd(2)], nextCursor: "c1" }, 500);
  render(
    <LiveTestProvider>
      <OverrideLog />
    </LiveTestProvider>,
  );
  const more = await screen.findByRole("button", { name: "Load more" });
  await act(async () => more.click());
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Load more failed · INTERNAL",
  );
  expect(screen.queryByText(/Override log unavailable/)).toBeNull();
  expect(ids()).toEqual([id(2)]);
  expect(screen.getByRole("button", { name: "Load more" })).toBeTruthy();
});
