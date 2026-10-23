import { topics } from "@stl/contracts";
import { describe, expect, it, vi } from "vitest";
import { createPublisher } from "./publisher.ts";

const cmd = {
  v: 1 as const,
  commandId: "6f1c1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f",
  ts: 1_800_000_000_000,
  mode: "CORRIDOR" as const,
  phase: "EW" as const,
};

describe("publisher", () => {
  it("publishes with the topic table's QoS and retain flag", async () => {
    const publishAsync = vi.fn(async () => undefined);
    await createPublisher({ publishAsync, connected: true }, "int-01").publish(
      "controller/override/cmd",
      cmd,
    );
    const t = topics["controller/override/cmd"];
    expect(publishAsync).toHaveBeenCalledWith(
      "stl/int-01/controller/override/cmd",
      JSON.stringify(cmd),
      { qos: t.qos, retain: t.retain },
    );
  });

  it("refuses an invalid payload and sends nothing", async () => {
    const publishAsync = vi.fn(async () => undefined);
    const publisher = createPublisher(
      { publishAsync, connected: true },
      "int-01",
    );
    await expect(
      publisher.publish("controller/override/cmd", { ...cmd, ts: 5 }),
    ).rejects.toThrow();
    expect(publishAsync).not.toHaveBeenCalled();
  });

  it("refuses to publish while disconnected and sends nothing", async () => {
    const publishAsync = vi.fn(async () => undefined);
    const publisher = createPublisher(
      { publishAsync, connected: false },
      "int-01",
    );
    await expect(
      publisher.publish("controller/override/cmd", cmd),
    ).rejects.toThrow(/not connected/);
    expect(publishAsync).not.toHaveBeenCalled();
  });

  it("refuses a topic the gateway doesn't publish", async () => {
    const publishAsync = vi.fn(async () => undefined);
    const publisher = createPublisher(
      { publishAsync, connected: true },
      "int-01",
    );
    await expect(
      // @ts-expect-error controller/state is a controller topic
      publisher.publish("controller/state", {}),
    ).rejects.toThrow(/not a gateway topic/);
    expect(publishAsync).not.toHaveBeenCalled();
  });
});
