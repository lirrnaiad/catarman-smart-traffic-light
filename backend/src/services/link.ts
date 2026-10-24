import type {
  BrokerStatus,
  ControllerStatus,
  LinkSlice,
  VisionStatus,
} from "@stl/contracts";
import { type Hub, initialLink } from "../sse/hub.ts";

export type Role = "controller" | "vision";

/** A role is STALE once its last fresh message is older than this (AD-5). */
export const STALE_MS: Record<Role, number> = {
  controller: 5_000,
  vision: 3_000,
};

/** Link health (AD-5). The sole writer of the `link` slice (AD-8). */
export function createLink(hub: Hub) {
  let slice: LinkSlice = initialLink;
  const lastFresh: Record<Role, number> = { controller: 0, vision: 0 };

  function write(next: LinkSlice): void {
    if (JSON.stringify(next) === JSON.stringify(slice)) return;
    slice = next;
    hub.setSlice("link", next);
  }

  function setRole<R extends Role>(
    role: R,
    patch: Partial<LinkSlice[R]>,
  ): void {
    write({ ...slice, [role]: { ...slice[role], ...patch } });
  }

  return {
    setBroker(broker: BrokerStatus): void {
      write({ ...slice, broker });
    },

    /** `status` gives source and bootCount; only a fresh `online: false` changes the status. */
    onStatus(
      role: Role,
      payload: ControllerStatus | VisionStatus,
      retained: boolean,
    ): void {
      const patch: Partial<LinkSlice["controller"]> = {
        source: payload.source,
      };
      if (role === "controller") {
        patch.bootCount = (payload as ControllerStatus).bootCount ?? null;
      }
      if (!retained && !payload.online) patch.status = "OFFLINE";
      setRole(role, patch);
    },

    /** `controller/state` or `vision/heartbeat`; a retained copy never counts as liveness. */
    onFresh(role: Role, receivedAt: number, retained: boolean): void {
      if (retained) return;
      lastFresh[role] = receivedAt;
      setRole(role, { status: "ONLINE" });
    },

    /** ONLINE turns STALE after STALE_MS of silence; OFFLINE stays OFFLINE. */
    tick(now: number): void {
      for (const role of ["controller", "vision"] as const) {
        if (
          slice[role].status === "ONLINE" &&
          now - lastFresh[role] > STALE_MS[role]
        ) {
          setRole(role, { status: "STALE" });
        }
      }
    },

    get(): LinkSlice {
      return slice;
    },
  };
}

export type Link = ReturnType<typeof createLink>;
