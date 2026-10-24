"use client";

import {
  type StreamData,
  type StreamName,
  streamSchemas,
} from "@stl/contracts";
import { type ReactNode, useEffect, useState } from "react";
import { apiUrl } from "../api/client.ts";
import {
  createLiveBus,
  LiveBusContext,
  LiveContext,
  type LiveState,
  type OccurrenceName,
  SLICE_NAMES,
  type SliceName,
} from "./hooks.ts";

const STREAM_NAMES = Object.keys(streamSchemas) as StreamName[];

function isSlice(name: StreamName): name is SliceName {
  return (SLICE_NAMES as readonly string[]).includes(name);
}

/** Parses one frame. Drops an invalid one with a warning that names the event and paths, never the data. */
function parseFrame<N extends StreamName>(
  name: N,
  raw: string,
): { data: StreamData<N> } | undefined {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    console.warn(`[sse] dropped ${name} frame: invalid JSON`);
    return undefined;
  }
  const parsed = streamSchemas[name].safeParse(json);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((i) => i.path.join(".") || "(root)");
    console.warn(`[sse] dropped ${name} frame: invalid at ${paths.join(", ")}`);
    return undefined;
  }
  return { data: parsed.data as StreamData<N> };
}

/** Opens the tab's one `EventSource` on `/api/stream` (AD-8). Mount once, in the root layout. */
export function LiveProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<LiveState>({
    slices: {},
    open: false,
    epoch: 0,
  });
  const [bus] = useState(createLiveBus);

  useEffect(() => {
    let source: EventSource;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      source = new EventSource(apiUrl("/api/stream"));
      source.addEventListener("open", () =>
        setLive((s) => ({ ...s, open: true, epoch: s.epoch + 1 })),
      );
      // The browser retries a dropped stream itself (`retry: 2000`), but gives up for good
      // (CLOSED) on a non-200 or wrong content type, so then we reopen after 2 s.
      // Slices keep their last values meanwhile.
      source.addEventListener("error", () => {
        setLive((s) => (s.open ? { ...s, open: false } : s));
        if (source.readyState === EventSource.CLOSED) {
          source.close();
          retry = setTimeout(connect, 2000);
        }
      });
      for (const name of STREAM_NAMES) {
        source.addEventListener(name, (event) => {
          const frame = parseFrame(name, (event as MessageEvent<string>).data);
          if (!frame) return;
          if (isSlice(name)) {
            // shortcut: one context holds every slice, so each frame re-renders every live
            // consumer; fine at M1 rates, upgrade to per-slice contexts or useSyncExternalStore
            // if renders show up in profiling.
            setLive((s) => ({
              ...s,
              slices: { ...s.slices, [name]: frame.data },
            }));
          } else {
            bus.emit(name as OccurrenceName, frame.data as never);
          }
        });
      }
    };
    connect();
    return () => {
      clearTimeout(retry);
      source.close();
    };
  }, [bus]);

  return (
    <LiveBusContext value={bus}>
      <LiveContext value={live}>{children}</LiveContext>
    </LiveBusContext>
  );
}
