import type { LinkSlice, StateSlice } from "@stl/contracts";

export const simLink: LinkSlice = {
  broker: "CONNECTED",
  controller: { status: "ONLINE", source: "sim", bootCount: 0 },
  vision: { status: "ONLINE", source: "sim" },
};

export const state: NonNullable<StateSlice> = {
  level: "L4",
  signals: { NS: "FLASHING_AMBER", EW: "FLASHING_AMBER" },
  flood: "FLOODED",
  fault: true,
  override: {
    mode: "CORRIDOR",
    phase: "NS",
    commandId: "6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60",
  },
  receivedAt: "2026-10-23T06:32:08.000Z",
};
