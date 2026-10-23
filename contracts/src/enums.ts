import { z } from "zod";

// Every enum family in the spine's Consistency Conventions, except the rejection
// reason, which is an open UPPER_SNAKE code (see scalars.ts, AD-7).

export const Level = z.enum(["L1", "L2", "L3", "L4"]);
export type Level = z.infer<typeof Level>;

export const Aspect = z.enum([
  "GREEN",
  "YELLOW",
  "RED",
  "FLASHING_AMBER",
  "DARK",
]);
export type Aspect = z.infer<typeof Aspect>;

export const OverrideMode = z.enum(["NONE", "FLASHING_AMBER", "CORRIDOR"]);
export type OverrideMode = z.infer<typeof OverrideMode>;

export const Flood = z.enum(["DRY", "WET", "FLOODED"]);
export type Flood = z.infer<typeof Flood>;

export const Power = z.enum(["USB", "BATTERY"]);
export type Power = z.infer<typeof Power>;

/** Lower case: the one exception in contract v1. */
export const Source = z.enum(["sim", "live"]);
export type Source = z.infer<typeof Source>;

export const CommandStatus = z.enum([
  "REQUESTED",
  "APPLIED",
  "REJECTED",
  "TIMEOUT",
]);
export type CommandStatus = z.infer<typeof CommandStatus>;

export const LinkStatus = z.enum(["ONLINE", "STALE", "OFFLINE"]);
export type LinkStatus = z.infer<typeof LinkStatus>;

export const BrokerStatus = z.enum(["CONNECTED", "DISCONNECTED"]);
export type BrokerStatus = z.infer<typeof BrokerStatus>;

export const Liveness = z.enum(["LIVE", "STALE"]);
export type Liveness = z.infer<typeof Liveness>;

export const Approach = z.enum(["N", "S", "E", "W"]);
export type Approach = z.infer<typeof Approach>;

export const Phase = z.enum(["NS", "EW"]);
export type Phase = z.infer<typeof Phase>;
