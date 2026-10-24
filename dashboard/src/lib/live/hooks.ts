"use client";

import type { Liveness, StreamData, StreamName } from "@stl/contracts";
import { createContext, useContext, useEffect, useRef } from "react";

export const SLICE_NAMES = [
  "link",
  "state",
  "counts",
  "demand",
] as const satisfies readonly StreamName[];
export type SliceName = (typeof SLICE_NAMES)[number];
export type OccurrenceName = Exclude<StreamName, SliceName>;

/** A slice is absent until its first frame; `null` is a frame meaning "no value yet". */
export type Slices = { [K in SliceName]?: StreamData<K> };

export type LiveState = { slices: Slices; open: boolean; epoch: number };

type Handler = (data: never) => void;

/** Fans occurrence frames out to `useLiveEvent` handlers, outside React state. */
export type LiveBus = {
  subscribe<N extends OccurrenceName>(
    name: N,
    handler: (data: StreamData<N>) => void,
  ): () => void;
  emit<N extends OccurrenceName>(name: N, data: StreamData<N>): void;
};

export function createLiveBus(): LiveBus {
  const handlers = new Map<OccurrenceName, Set<Handler>>();
  return {
    subscribe(name, handler) {
      const set = handlers.get(name) ?? new Set<Handler>();
      handlers.set(name, set);
      set.add(handler);
      return () => set.delete(handler);
    },
    emit(name, data) {
      for (const h of handlers.get(name) ?? [])
        (h as (d: typeof data) => void)(data);
    },
  };
}

export const LiveContext = createContext<LiveState>({
  slices: {},
  open: false,
  epoch: 0,
});
export const LiveBusContext = createContext<LiveBus>(createLiveBus());

/** The current value of a slice: `undefined` before its first frame. */
export function useLive<S extends SliceName>(slice: S): Slices[S] {
  return useContext(LiveContext).slices[slice];
}

/** Calls `handler` once per occurrence frame. Holds no React state. */
export function useLiveEvent<N extends OccurrenceName>(
  name: N,
  handler: (data: StreamData<N>) => void,
): void {
  const bus = useContext(LiveBusContext);
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(
    () => bus.subscribe(name, (data) => latest.current(data)),
    [bus, name],
  );
}

/** Increments on every stream open (connect and reconnect); 0 before the first. */
export function useStreamEpoch(): number {
  return useContext(LiveContext).epoch;
}

/** LIVE only while the stream is open, the broker is CONNECTED and the role is ONLINE. */
export function useLiveness(role: "controller" | "vision"): Liveness {
  const { open, slices } = useContext(LiveContext);
  const link = slices.link;
  return open && link?.broker === "CONNECTED" && link[role].status === "ONLINE"
    ? "LIVE"
    : "STALE";
}
