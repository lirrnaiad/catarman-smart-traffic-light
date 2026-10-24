import type {
  LinkSlice,
  OverrideCommand,
  Page,
  StateSlice,
} from "@stl/contracts";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createLiveBus, type Slices } from "../../lib/live/hooks.ts";
import { LiveTestProvider } from "../../lib/live/live-test-provider.tsx";
import { state as fixture, simLink } from "../shell/fixtures.ts";
import { ANNOUNCE_DELAY_MS, LiveRegion } from "../shell/live-region.tsx";
import { OverridePanel } from "./override-panel.tsx";

const ID = "00000000-0000-4000-8000-0000000000a1";
const OTHER = "00000000-0000-4000-8000-0000000000b2";
const BOOT = "00000000-0000-4000-8000-0000000000c3";

const cmd = (patch: Partial<OverrideCommand> = {}): OverrideCommand => ({
  commandId: ID,
  mode: "CORRIDOR",
  phase: "NS",
  status: "REQUESTED",
  reason: null,
  requestedAt: "2026-10-23T06:32:08.000Z",
  resolvedAt: null,
  ...patch,
});

type Override = NonNullable<StateSlice>["override"];
const withOverride = (override: Override): NonNullable<StateSlice> => ({
  ...fixture,
  fault: false,
  override,
});
const NONE = withOverride({ mode: "NONE", commandId: BOOT });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const apiError = (code: string, status: number) =>
  json({ error: { code, message: code } }, status);

/** POSTs answer with the next queued response; GETs (the epoch re-read) with `list`. */
function stub(
  posts: Array<Response | Promise<Response>>,
  list: () => Response | Promise<Response> = () =>
    json({ items: [], nextCursor: null }),
) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "POST"
      ? (posts.shift() ?? apiError("INTERNAL", 500))
      : list(),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const postBodies = (f: ReturnType<typeof stub>) =>
  f.mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init?.body)));

function setup(slices: Slices = { link: simLink, state: NONE }) {
  const bus = createLiveBus();
  const ui = (s: Slices, epoch: number) => (
    <LiveRegion>
      <LiveTestProvider bus={bus} slices={s} epoch={epoch}>
        <OverridePanel />
      </LiveTestProvider>
    </LiveRegion>
  );
  const r = render(ui(slices, 1));
  return {
    emit: (c: OverrideCommand) => act(() => bus.emit("override", c)),
    rerender: (s: Slices, epoch = 1) => r.rerender(ui(s, epoch)),
    region: () =>
      r.container.querySelector('[aria-live="polite"]')?.textContent ?? "",
  };
}

const panel = () => screen.getByRole("region", { name: "MDRRMO override" });
const button = (name: RegExp) =>
  within(panel()).getByRole("button", { name }) as HTMLButtonElement;
const buttons = () =>
  within(panel()).getAllByRole("button") as HTMLButtonElement[];
const current = () => panel().querySelector("b")?.textContent;

async function confirm(name: RegExp) {
  button(name).focus();
  fireEvent.click(button(name));
  const dialog = screen.getByRole("dialog");
  await act(async () => {
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

afterEach(() => vi.unstubAllGlobals());

it("renders the title, four buttons, the Current plate and the footer", () => {
  stub([]);
  setup();
  expect(within(panel()).getByText("MDRRMO override")).toBeTruthy();
  expect(buttons().map((b) => b.textContent)).toEqual([
    "Flashing amber",
    "Evacuation corridor — NS",
    "Evacuation corridor — EW",
    "Release to automatic",
  ]);
  expect(current()).toBe("None");
  expect(
    within(panel()).getByText("Every override asks for confirmation first"),
  ).toBeTruthy();
});

it("each button opens ConfirmDialog with its title and effect; Cancel and Esc send nothing", () => {
  const f = stub([]);
  setup();
  const cases: Array<[RegExp, string, string]> = [
    [
      /Flashing amber/,
      "Activate flashing amber?",
      "Every approach flashes amber.",
    ],
    [
      /corridor — NS/,
      "Activate evacuation corridor NS?",
      "All other approaches go red.",
    ],
    [
      /corridor — EW/,
      "Activate evacuation corridor EW?",
      "All other approaches go red.",
    ],
    [
      /Release/,
      "Release to automatic?",
      "The controller returns to its automatic level.",
    ],
  ];
  for (const [name, title, effect] of cases) {
    fireEvent.click(button(name));
    const dialog = screen.getByRole("dialog", { name: title });
    expect(within(dialog).getByText(effect)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  }
  fireEvent.click(button(/corridor — NS/));
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(f).not.toHaveBeenCalled();
});

it("corridor applied: Pending and all disabled, then enabled; Current follows state only", async () => {
  const f = stub([json(cmd(), 202)]);
  const { emit, rerender, region } = setup();
  await confirm(/corridor — NS/);
  expect(postBodies(f)).toEqual([{ mode: "CORRIDOR", phase: "NS" }]);
  expect(button(/corridor — NS/).textContent).toContain(
    "Pending · waiting for controller",
  );
  expect(button(/corridor — EW/).textContent).not.toContain("Pending");
  expect(
    buttons().every((b) => b.getAttribute("aria-disabled") === "true"),
  ).toBe(true);
  expect(current()).toBe("None");
  await waitFor(() =>
    expect(region()).toContain("Pending · waiting for controller"),
  );

  emit(cmd({ status: "APPLIED" }));
  expect(buttons().every((b) => !b.hasAttribute("aria-disabled"))).toBe(true);
  expect(current()).toBe("None");
  await waitFor(() => expect(region()).toContain("Applied"));

  rerender({
    link: simLink,
    state: withOverride({ mode: "CORRIDOR", phase: "NS", commandId: ID }),
  });
  expect(current()).toBe("Corridor NS");
});

it("flashing amber and release send their own bodies", async () => {
  const f = stub([
    json(cmd({ mode: "FLASHING_AMBER", phase: null, status: "APPLIED" }), 202),
    json(
      cmd({ commandId: OTHER, mode: "NONE", phase: null, status: "APPLIED" }),
      202,
    ),
  ]);
  setup();
  await confirm(/Flashing amber/);
  await confirm(/Release/);
  expect(postBodies(f)).toEqual([{ mode: "FLASHING_AMBER" }, { mode: "NONE" }]);
});

it("release: Current returns to None with no ended notice", async () => {
  const start = withOverride({
    mode: "CORRIDOR",
    phase: "NS",
    commandId: OTHER,
  });
  stub([json(cmd({ mode: "NONE", phase: null }), 202)]);
  const { rerender } = setup({ link: simLink, state: start });
  expect(current()).toBe("Corridor NS");
  await confirm(/Release/);
  rerender({
    link: simLink,
    state: withOverride({ mode: "NONE", commandId: ID }),
  });
  expect(current()).toBe("None");
  expect(screen.queryByText(/ended/)).toBeNull();
});

it("fast ack: an SSE APPLIED before the 202 wins over its REQUESTED", async () => {
  let resolve: (r: Response) => void = () => {};
  stub([
    new Promise<Response>((r) => {
      resolve = r;
    }),
  ]);
  const { emit } = setup();
  fireEvent.click(button(/corridor — NS/));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Confirm" }),
  );
  emit(cmd({ status: "REQUESTED" }));
  emit(cmd({ status: "APPLIED" }));
  await act(async () => resolve(json(cmd(), 202)));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(buttons().every((b) => !b.hasAttribute("aria-disabled"))).toBe(true);
  expect(panel().textContent).not.toContain("Pending");
});

it("offline: a 409 shows Rejected · Controller offline, buttons stay enabled, the orphan SSE is ignored", async () => {
  stub([apiError("CONTROLLER_OFFLINE", 409)]);
  const { emit, region } = setup();
  await confirm(/corridor — NS/);
  expect(
    within(panel()).getByText("Rejected · Controller offline"),
  ).toBeTruthy();
  expect(buttons().every((b) => !b.hasAttribute("aria-disabled"))).toBe(true);
  emit(cmd({ commandId: OTHER, status: "REJECTED", reason: "SOME_CODE" }));
  expect(
    within(panel()).getByText("Rejected · Controller offline"),
  ).toBeTruthy();
  expect(screen.queryByText(/SOME_CODE/)).toBeNull();
  await waitFor(() =>
    expect(region()).toContain("Rejected · Controller offline"),
  );
});

it("a network failure shows the raw INTERNAL code", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("offline");
    }),
  );
  setup();
  await confirm(/Flashing amber/);
  expect(within(panel()).getByText("Rejected · INTERNAL")).toBeTruthy();
});

it("conflict: SSE REJECTED CONFLICT_FAULT shows its label; an unknown code shows raw", async () => {
  stub([json(cmd(), 202), json(cmd({ commandId: OTHER }), 202)]);
  const { emit, region } = setup();
  await confirm(/corridor — NS/);
  emit(cmd({ status: "REJECTED", reason: "CONFLICT_FAULT" }));
  expect(within(panel()).getByText("Rejected · Conflict fault")).toBeTruthy();
  expect(buttons().every((b) => !b.hasAttribute("aria-disabled"))).toBe(true);
  await waitFor(() => expect(region()).toContain("Rejected · Conflict fault"));

  // A new command clears the notice.
  await confirm(/corridor — EW/);
  expect(screen.queryByText(/Conflict fault/)).toBeNull();
  emit(cmd({ commandId: OTHER, status: "REJECTED", reason: "SOME_CODE" }));
  expect(within(panel()).getByText("Rejected · SOME_CODE")).toBeTruthy();
});

it("timeout, then late: the notice shows with buttons enabled, and a later APPLIED clears it", async () => {
  stub([json(cmd(), 202)]);
  const { emit, region } = setup();
  await confirm(/corridor — NS/);
  emit(cmd({ status: "TIMEOUT" }));
  expect(
    within(panel()).getByText("No reply from controller in 5 s"),
  ).toBeTruthy();
  expect(buttons().every((b) => !b.hasAttribute("aria-disabled"))).toBe(true);
  await waitFor(() =>
    expect(region()).toContain("No reply from controller in 5 s"),
  );
  emit(cmd({ status: "APPLIED" }));
  expect(screen.queryByText("No reply from controller in 5 s")).toBeNull();
  await waitFor(() => expect(region()).toContain("Applied"));
});

it("missed frame: on a new epoch while REQUESTED, the list's row re-enables the buttons", async () => {
  const page: Page<OverrideCommand> = {
    items: [cmd({ status: "APPLIED" })],
    nextCursor: null,
  };
  const f = stub([json(cmd(), 202)], () => json(page));
  const { rerender } = setup();
  await confirm(/corridor — NS/);
  expect(
    buttons().every((b) => b.getAttribute("aria-disabled") === "true"),
  ).toBe(true);
  rerender({ link: simLink, state: NONE }, 2);
  await waitFor(() =>
    expect(buttons().every((b) => !b.hasAttribute("aria-disabled"))).toBe(true),
  );
  expect(f.mock.calls.filter(([, init]) => !init?.method)).toHaveLength(1);
});

it("missed frame: a failed list read stays Pending", async () => {
  const f = stub([json(cmd(), 202)], () => apiError("INTERNAL", 500));
  const { rerender } = setup();
  await confirm(/corridor — NS/);
  rerender({ link: simLink, state: NONE }, 2);
  await waitFor(() => expect(f).toHaveBeenCalledTimes(2));
  await act(async () => {});
  expect(
    buttons().every((b) => b.getAttribute("aria-disabled") === "true"),
  ).toBe(true);
  expect(button(/corridor — NS/).textContent).toContain("Pending");
});

it("ended on its own: a corridor going to an unseen NONE shows the notice", async () => {
  stub([]);
  const { rerender, region } = setup({
    link: simLink,
    state: withOverride({ mode: "CORRIDOR", phase: "NS", commandId: ID }),
  });
  expect(screen.queryByText(/ended/)).toBeNull();
  rerender({
    link: simLink,
    state: withOverride({ mode: "NONE", commandId: OTHER }),
  });
  expect(
    within(panel()).getByText("Corridor ended — link loss or fault"),
  ).toBeTruthy();
  expect(current()).toBe("None");
  await waitFor(() =>
    expect(region()).toContain("Corridor ended — link loss or fault"),
  );
});

it("ended on its own after flashing amber reads Override ended", () => {
  stub([]);
  const { rerender } = setup({
    link: simLink,
    state: withOverride({ mode: "FLASHING_AMBER", commandId: ID }),
  });
  rerender({
    link: simLink,
    state: withOverride({ mode: "NONE", commandId: OTHER }),
  });
  expect(
    within(panel()).getByText("Override ended — link loss or fault"),
  ).toBeTruthy();
});

it("a release seen only over SSE (another tab) is not ended on its own", () => {
  stub([]);
  const { emit, rerender } = setup({
    link: simLink,
    state: withOverride({ mode: "CORRIDOR", phase: "EW", commandId: ID }),
  });
  emit(cmd({ commandId: OTHER, mode: "NONE", phase: null }));
  rerender({
    link: simLink,
    state: withOverride({ mode: "NONE", commandId: OTHER }),
  });
  expect(screen.queryByText(/ended/)).toBeNull();
});

it("mount on NONE: Current None, no notice", () => {
  stub([]);
  setup();
  expect(current()).toBe("None");
  expect(screen.queryByText(/ended/)).toBeNull();
});

it("state null or not yet received: the plate reads No data yet", () => {
  stub([]);
  const { rerender } = setup({ link: simLink, state: null });
  expect(current()).toBe("No data yet");
  rerender({ link: simLink });
  expect(current()).toBe("No data yet");
});

it("controller STALE: Current kept under a StaleBadge, buttons enabled", () => {
  stub([]);
  const link: LinkSlice = {
    ...simLink,
    controller: { ...simLink.controller, status: "STALE" },
  };
  setup({
    link,
    state: withOverride({ mode: "CORRIDOR", phase: "NS", commandId: ID }),
  });
  expect(current()).toBe("Corridor NS");
  expect(within(panel()).getByText("STALE · 14:32:08")).toBeTruthy();
  expect(buttons().every((b) => !b.hasAttribute("aria-disabled"))).toBe(true);
});

const isBusy = () =>
  buttons().every((b) => b.getAttribute("aria-disabled") === "true");
const isFree = () => buttons().every((b) => !b.hasAttribute("aria-disabled"));

it("after Confirm, focus returns to the pressed button while it is Pending", async () => {
  stub([json(cmd(), 202)]);
  setup();
  await confirm(/corridor — NS/);
  expect(isBusy()).toBe(true);
  expect(document.activeElement).toBe(button(/corridor — NS/));
});

it("Cancel while the POST is in flight keeps the buttons disabled until it settles", async () => {
  let resolve: (r: Response) => void = () => {};
  stub([
    new Promise<Response>((r) => {
      resolve = r;
    }),
  ]);
  setup();
  fireEvent.click(button(/corridor — NS/));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(isBusy()).toBe(true);
  fireEvent.click(button(/corridor — EW/));
  expect(screen.queryByRole("dialog")).toBeNull();
  await act(async () => resolve(json(cmd({ status: "APPLIED" }), 202)));
  await waitFor(() => expect(isFree()).toBe(true));
});

it.each(["REQUESTED", "TIMEOUT"] as const)(
  "a stale %s list row after an SSE APPLIED changes nothing",
  async (status) => {
    let resolveList: (r: Response) => void = () => {};
    stub(
      [json(cmd(), 202)],
      () =>
        new Promise<Response>((r) => {
          resolveList = r;
        }),
    );
    const { emit, rerender } = setup();
    await confirm(/corridor — NS/);
    rerender({ link: simLink, state: NONE }, 2);
    emit(cmd({ status: "APPLIED" }));
    await act(async () =>
      resolveList(json({ items: [cmd({ status })], nextCursor: null })),
    );
    await act(async () => {});
    expect(isFree()).toBe(true);
    expect(panel().textContent).not.toContain("Pending");
    expect(screen.queryByText("No reply from controller in 5 s")).toBeNull();
  },
);

it("Pending is spoken once, even when a REQUESTED frame repeats in a later tick", async () => {
  stub([json(cmd(), 202)]);
  const { emit, region } = setup();
  await confirm(/corridor — NS/);
  await waitFor(() =>
    expect(region()).toBe("Pending · waiting for controller"),
  );
  await act(() => new Promise((r) => setTimeout(r, ANNOUNCE_DELAY_MS * 2)));
  emit(cmd());
  // A re-announcement would clear the region first.
  expect(region()).toBe("Pending · waiting for controller");
  await act(() => new Promise((r) => setTimeout(r, ANNOUNCE_DELAY_MS * 2)));
  expect(region()).toBe("Pending · waiting for controller");
});
