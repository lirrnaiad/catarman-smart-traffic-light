import type { OverrideCommand } from "@stl/contracts";
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import {
  createLiveBus,
  useLive,
  useLiveEvent,
  useLiveness,
  useStreamEpoch,
} from "./hooks.ts";
import { LiveTestProvider } from "./live-test-provider.tsx";

const command: OverrideCommand = {
  commandId: "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60",
  mode: "CORRIDOR",
  phase: "NS",
  status: "REQUESTED",
  reason: null,
  requestedAt: "2026-10-23T06:32:08.000Z",
  resolvedAt: null,
};

function View() {
  const counts = useLive("counts");
  const [status, setStatus] = useState("none");
  useLiveEvent("override", (c) => setStatus(c.status));
  return (
    <p>
      {`${useStreamEpoch()} ${useLiveness("controller")} ${useLiveness("vision")} ${counts?.total ?? "-"} ${status}`}
    </p>
  );
}

it("feeds slices, open state, epoch and occurrences through the same hooks", () => {
  const bus = createLiveBus();
  const slices = {
    link: {
      broker: "CONNECTED",
      controller: { status: "ONLINE", source: "sim", bootCount: 0 },
      vision: { status: "OFFLINE", source: null },
    },
    counts: {
      hourStart: "2026-10-23T06:00:00.000Z",
      total: 210,
      byApproach: { N: {}, S: {}, E: {}, W: {} },
    },
  } as const;
  const view = render(
    <LiveTestProvider slices={slices} epoch={3} bus={bus}>
      <View />
    </LiveTestProvider>,
  );
  expect(screen.getByText("3 LIVE STALE 210 none")).toBeTruthy();

  act(() => bus.emit("override", command));
  expect(screen.getByText("3 LIVE STALE 210 REQUESTED")).toBeTruthy();

  view.rerender(
    <LiveTestProvider slices={slices} epoch={4} open={false} bus={bus}>
      <View />
    </LiveTestProvider>,
  );
  expect(screen.getByText("4 STALE STALE 210 REQUESTED")).toBeTruthy();
});

function Subscriber({ onBreach }: { onBreach: () => void }) {
  useLiveEvent("breach", onBreach);
  return null;
}

it("useLiveEvent calls only the latest handler, and none after unmount", () => {
  const bus = createLiveBus();
  const first = vi.fn();
  const second = vi.fn();
  const breach = {
    id: "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60",
    occurredAt: "2026-10-23T06:32:08.000Z",
    receivedAt: "2026-10-23T06:32:08.100Z",
    approach: "E",
    vehicleClass: "car",
    centroid: { x: 0.5, y: 0.5 },
    cropUrl: null,
  } as const;
  const view = render(
    <LiveTestProvider bus={bus}>
      <Subscriber onBreach={first} />
    </LiveTestProvider>,
  );
  view.rerender(
    <LiveTestProvider bus={bus}>
      <Subscriber onBreach={second} />
    </LiveTestProvider>,
  );
  act(() => bus.emit("breach", breach));
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);

  view.unmount();
  bus.emit("breach", breach);
  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});
