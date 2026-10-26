import {
  type LinkSlice,
  type OccurrenceName,
  type SliceName,
  type StreamData,
  type StreamName,
  sliceNames,
  sseFrame,
  streamSchemas,
} from "@stl/contracts";

export type { OccurrenceName, SliceName } from "@stl/contracts";

export const PING_MS = 15_000;

/** The response surface the hub needs; an Express `Response` fits. */
export interface SseClient {
  write(chunk: string): unknown;
  end(): unknown;
  on(event: "close", listener: () => void): unknown;
}

/** All offline until entry 3's services/link.ts writes the real value at boot. */
export const initialLink: LinkSlice = {
  broker: "DISCONNECTED",
  controller: { status: "OFFLINE", source: null, bootCount: null },
  vision: { status: "OFFLINE", source: null },
};

export function createHub({ validate }: { validate: "throw" | "log" }) {
  const slices: { [K in SliceName]: StreamData<K> } = {
    link: initialLink,
    state: null,
    counts: null,
    demand: null,
  };
  const clients = new Map<SseClient, NodeJS.Timeout>();
  let closed = false;

  /** Validates the outbound payload; null means "drop it". */
  function frame<N extends StreamName>(
    name: N,
    value: StreamData<N>,
  ): string | null {
    const result = streamSchemas[name].safeParse(value);
    if (result.success) return sseFrame(name, value);
    if (validate === "throw") throw result.error;
    console.error(`[sse] dropped invalid ${name}: ${result.error.message}`);
    return null;
  }

  function broadcast(text: string): void {
    for (const res of clients.keys()) res.write(text);
  }

  return {
    setSlice<N extends SliceName>(name: N, value: StreamData<N>): void {
      const text = frame(name, value);
      if (text === null) return;
      (slices as Record<SliceName, unknown>)[name] = value;
      broadcast(text);
    },

    getSlice<N extends SliceName>(name: N): StreamData<N> {
      return slices[name];
    },

    emit<N extends OccurrenceName>(name: N, value: StreamData<N>): void {
      const text = frame(name, value);
      if (text !== null) broadcast(text);
    },

    attach(res: SseClient): void {
      if (closed) {
        res.end();
        return;
      }
      res.write("retry: 2000\n\n");
      for (const name of sliceNames) res.write(sseFrame(name, slices[name]));
      clients.set(
        res,
        setInterval(() => res.write(": ping\n\n"), PING_MS),
      );
      res.on("close", () => {
        clearInterval(clients.get(res));
        clients.delete(res);
      });
    },

    close(): void {
      closed = true;
      for (const [res, timer] of clients) {
        clearInterval(timer);
        res.end();
      }
      clients.clear();
    },
  };
}

export type Hub = ReturnType<typeof createHub>;
