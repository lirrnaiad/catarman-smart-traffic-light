"use client";

import { type ReactNode, useMemo, useState } from "react";
import {
  createLiveBus,
  type LiveBus,
  LiveBusContext,
  LiveContext,
  type Slices,
} from "./hooks.ts";

type Props = {
  children: ReactNode;
  slices?: Slices;
  open?: boolean;
  epoch?: number;
  /** Pass `createLiveBus()` and call `bus.emit(name, data)` to fire occurrences. */
  bus?: LiveBus;
};

/** Feeds the live hooks in tests, with no `EventSource`. Rerender with new props to change state. */
export function LiveTestProvider({
  children,
  slices = {},
  open = true,
  epoch = 1,
  bus,
}: Props) {
  const [ownBus] = useState(createLiveBus);
  const value = useMemo(() => ({ slices, open, epoch }), [slices, open, epoch]);
  return (
    <LiveBusContext value={bus ?? ownBus}>
      <LiveContext value={value}>{children}</LiveContext>
    </LiveBusContext>
  );
}
