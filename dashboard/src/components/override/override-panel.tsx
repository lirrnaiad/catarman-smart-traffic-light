"use client";

import type {
  CommandStatus,
  OverrideCommand,
  OverrideRequest,
  StateSlice,
} from "@stl/contracts";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../../lib/api/client.ts";
import { listOverrides, postOverride } from "../../lib/api/overrides.ts";
import { useLive, useLiveEvent, useStreamEpoch } from "../../lib/live/hooks.ts";
import {
  commandStatusVisuals,
  overrideModeVisuals,
  phaseVisuals,
  rejectionReasonVisual,
} from "../../lib/visuals.ts";
import { well } from "../live/panel.tsx";
import { useAnnounce } from "../shell/live-region.tsx";
import { ConfirmDialog } from "../ui/confirm-dialog.tsx";
import { StaleBadge } from "../ui/stale-badge.tsx";
import { focusRing, hazardStripes, stencil } from "../ui/styles.ts";

type Action = {
  label: string;
  req: OverrideRequest;
  title: string;
  effect: string;
  icon: ReactNode;
  release?: boolean;
};

const corridor = (phase: "NS" | "EW", icon: ReactNode): Action => ({
  label: `Evacuation corridor — ${phaseVisuals[phase].label}`,
  req: { mode: "CORRIDOR", phase },
  title: `Activate evacuation corridor ${phaseVisuals[phase].label}?`,
  effect: "All other approaches go red.",
  icon,
});

// Icon paths from mockups/live-status.html.
const ACTIONS: Action[] = [
  {
    label: overrideModeVisuals.FLASHING_AMBER.label,
    req: { mode: "FLASHING_AMBER" },
    title: "Activate flashing amber?",
    effect: "Every approach flashes amber.",
    icon: (
      <>
        <circle cx="17" cy="17" r="7" />
        <path d="M17 2.5v4.5M17 27v4.5M2.5 17H7M27 17h4.5M6.8 6.8l3.2 3.2M24 24l3.2 3.2M27.2 6.8L24 10M10 24l-3.2 3.2" />
      </>
    ),
  },
  corridor(
    "NS",
    <>
      <path d="M9 3v28M25 3v28" opacity=".4" />
      <path d="M17 4v26M11.5 9.5L17 4l5.5 5.5M11.5 24.5L17 30l5.5-5.5" />
    </>,
  ),
  corridor(
    "EW",
    <>
      <path d="M3 9h28M3 25h28" opacity=".4" />
      <path d="M4 17h26M9.5 11.5L4 17l5.5 5.5M24.5 11.5L30 17l-5.5 5.5" />
    </>,
  ),
  {
    label: "Release to automatic",
    req: { mode: "NONE" },
    title: "Release to automatic?",
    effect: "The controller returns to its automatic level.",
    release: true,
    icon: (
      <>
        <path d="M27.5 12.5A11.5 11.5 0 1 0 28.5 21" />
        <path d="M28.5 4.5v8h-8" />
      </>
    ),
  },
];

type Override = NonNullable<StateSlice>["override"];

function currentLabel(o: Override): string {
  if (!o || o.mode === "NONE") return overrideModeVisuals.NONE.label;
  if (o.mode === "FLASHING_AMBER")
    return overrideModeVisuals.FLASHING_AMBER.label;
  return `${overrideModeVisuals.CORRIDOR.label} ${phaseVisuals[o.phase].label}`;
}

const rejected = (code: string) =>
  `${commandStatusVisuals.REJECTED.label} · ${rejectionReasonVisual(code).label}`;

/** How many recent SSE `override` frames are kept, for a 202 that loses the race to its own frames. */
const SEEN_MAX = 16;

type Tracked = { id: string; status: CommandStatus };

/** CAP-5's MDRRMO override panel (DESIGN → MDRRMO override panel, EXPERIENCE Flow 1). */
export function OverridePanel() {
  const state = useLive("state");
  const epoch = useStreamEpoch();
  const announce = useAnnounce();
  const [dialog, setDialog] = useState<number | null>(null);
  const [pressed, setPressed] = useState<number | null>(null);
  const [tracked, setTracked] = useState<Tracked | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The POST is in flight: no second command, even if the dialog was cancelled meanwhile.
  const [sending, setSending] = useState(false);
  const trackedRef = useRef<Tracked | null>(null);
  const seen = useRef(new Map<string, OverrideCommand>());
  const releases = useRef(new Set<string>());
  const spoken = useRef(new Set<string>());

  function say(key: string, text: string) {
    if (spoken.current.has(key)) return;
    spoken.current.add(key);
    announce(text);
  }

  /** Takes a frame for the tracked command; a REQUESTED never undoes a later status, and APPLIED/REJECTED are final. */
  function apply(c: OverrideCommand) {
    const cur = trackedRef.current;
    if (cur?.id !== c.commandId) return;
    if (cur.status === "APPLIED" || cur.status === "REJECTED") return;
    if (c.status === "REQUESTED" && cur.status !== "REQUESTED") return;
    const next = { id: c.commandId, status: c.status };
    trackedRef.current = next;
    setTracked(next);
    const key = `${c.commandId}:${c.status}`;
    if (c.status === "REQUESTED") {
      say(key, commandStatusVisuals.REQUESTED.label);
    } else if (c.status === "APPLIED") {
      setNotice(null);
      say(key, commandStatusVisuals.APPLIED.label);
    } else {
      const text =
        c.status === "TIMEOUT"
          ? commandStatusVisuals.TIMEOUT.label
          : c.reason
            ? rejected(c.reason)
            : commandStatusVisuals.REJECTED.label;
      setNotice(text);
      say(key, text);
    }
  }

  useLiveEvent("override", (c) => {
    seen.current.set(c.commandId, c);
    if (seen.current.size > SEEN_MAX)
      seen.current.delete(seen.current.keys().next().value as string);
    if (c.mode === "NONE") releases.current.add(c.commandId);
    // Frames for other ids (such as the orphan REJECTED after a 409) are ignored.
    apply(c);
  });

  async function send(i: number) {
    const { req } = ACTIONS[i];
    setNotice(null);
    setPressed(i);
    setSending(true);
    trackedRef.current = null;
    setTracked(null);
    try {
      const body = await postOverride(req);
      if (req.mode === "NONE") releases.current.add(body.commandId);
      trackedRef.current = { id: body.commandId, status: "REQUESTED" };
      // An SSE frame for this id may have beaten the 202; it is newer.
      apply(seen.current.get(body.commandId) ?? body);
    } catch (err) {
      const text = rejected(
        err instanceof ApiRequestError ? err.code : "INTERNAL",
      );
      setNotice(text);
      announce(text);
    } finally {
      setSending(false);
      setDialog(null);
    }
  }

  // A missed SSE frame (stream dropped) can't leave the buttons disabled: re-read on reconnect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on each stream epoch only.
  useEffect(() => {
    const cur = trackedRef.current;
    if (cur?.status !== "REQUESTED") return;
    let live = true;
    listOverrides().then(
      (page) => {
        const row = page.items.find((c) => c.commandId === cur.id);
        if (live && row) apply(row);
      },
      () => {}, // stays Pending until the next epoch or SSE frame
    );
    return () => {
      live = false;
    };
  }, [epoch]);

  // Ended on its own: non-NONE → {NONE, X} where X is no release this page has seen. Never on mount.
  const override = state?.override;
  const overrideKey = override
    ? `${override.mode}:${override.mode === "CORRIDOR" ? override.phase : ""}:${override.commandId ?? ""}`
    : "";
  const prev = useRef<Override | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the override's value, not its identity.
  useEffect(() => {
    if (!state) return;
    const p = prev.current;
    const cur = state.override ?? { mode: "NONE" as const };
    prev.current = cur;
    if (!p || p.mode === "NONE" || cur.mode !== "NONE") return;
    if (cur.commandId && releases.current.has(cur.commandId)) return;
    const text = `${p.mode === "CORRIDOR" ? "Corridor" : "Override"} ended — link loss or fault`;
    setNotice(text);
    announce(text);
  }, [overrideKey, !state]);

  const requested = tracked?.status === "REQUESTED";
  const busy = requested || sending;
  const open = dialog === null ? null : ACTIONS[dialog];

  return (
    // Its content height, never less: the counts panel above flexes instead, so a button is never
    // shorter than its label and a notice can't push the rows into each other (user, 2026-10-26).
    <section
      aria-labelledby="override-panel-title"
      className={`flex shrink-0 rounded-xl p-hazard-frame ${hazardStripes} shadow-[0_4px_0_var(--color-edge-dark),0_14px_30px_color-mix(in_srgb,var(--color-edge-dark)_55%,transparent)]`}
    >
      <div className="flex flex-1 flex-col rounded-[5px] bg-linear-to-b from-surface-housing-hi to-surface-housing-lo px-[16px] pb-[12px] shadow-[0_0_0_2px_var(--color-edge-dark)]">
        <div
          className={`${stencil} -mx-[16px] mb-[8px] flex h-panel-title-height shrink-0 items-center justify-between gap-[12px] rounded-t-[5px] border-b-2 border-edge-dark bg-linear-to-b from-surface-title-hi to-surface-title-lo px-[16px] text-text`}
        >
          <h2 id="override-panel-title" className="text-label-panel">
            MDRRMO override
          </h2>
          <StaleBadge of="controller" since={state?.receivedAt} />
        </div>

        {/* Its own row: at 432px the title row can't hold the plate with "Flashing amber" or a StaleBadge (user, 2026-10-24). */}
        <p
          className={`${well} ${stencil} mb-[8px] flex shrink-0 items-baseline gap-[12px] px-[14px] py-[4px] text-[14px] font-extrabold tracking-[0.14em] text-text-3`}
        >
          Current
          <b className="text-[17px] tracking-[0.06em] text-text">
            {state ? currentLabel(state.override) : "No data yet"}
          </b>
        </p>

        {/* Each row is as tall as its tallest label: three lines for the corridors. */}
        <div className="grid grid-cols-2 gap-[10px]">
          {ACTIONS.map((a, i) => (
            <button
              key={a.label}
              type="button"
              // aria-disabled, not disabled: ConfirmDialog restores focus to this button as it closes.
              aria-disabled={busy || undefined}
              onClick={() => {
                if (!busy) setDialog(i);
              }}
              className={`${stencil} ${focusRing} flex items-center gap-[12px] rounded-md border border-edge-dark px-[12px] py-[4px] text-left text-label-control shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-text)_14%,transparent),0_4px_0_var(--color-edge-dark)] aria-disabled:opacity-55 ${
                a.release
                  ? "bg-linear-to-b from-surface-housing-hi to-surface-housing text-text-2"
                  : "bg-linear-to-b from-surface-plate-hi to-surface-plate text-text"
              }`}
            >
              <svg
                viewBox="0 0 34 34"
                aria-hidden="true"
                className="size-[34px] flex-none fill-none stroke-current stroke-[2.4] [stroke-linecap:round] [stroke-linejoin:round]"
              >
                {a.icon}
              </svg>
              {/* The pressed button reads Pending in its label's place (EXPERIENCE), within the
                  corridors' three lines, so a press never grows the panel. The label stays in its name. */}
              <span>
                <span
                  className={requested && pressed === i ? "sr-only" : undefined}
                >
                  {a.label}
                </span>
                {requested && pressed === i && (
                  <span className="block text-text-2">
                    {commandStatusVisuals.REQUESTED.label}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* A notice takes the footer's slot, so it never changes the panel's height (user, 2026-10-26). */}
        {notice ? (
          <p
            className={`${well} ${stencil} mt-[8px] flex min-h-[28px] items-stretch overflow-hidden text-label-link leading-[1.1] text-text`}
          >
            <span aria-hidden="true" className={`${hazardStripes} w-[12px]`} />
            <span className="self-center px-[12px] py-[4px]">{notice}</span>
          </p>
        ) : (
          <p
            className={`${stencil} mt-[8px] flex min-h-[28px] items-center gap-[8px] text-caption font-extrabold text-text-2`}
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="size-[16px] fill-none stroke-current stroke-[1.8]"
            >
              <rect x="4" y="9" width="12" height="9" rx="1.5" />
              <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
            </svg>
            Every override asks for confirmation first
          </p>
        )}
      </div>

      <ConfirmDialog
        open={open !== null}
        title={open?.title ?? ""}
        effect={open?.effect ?? ""}
        confirmLabel="Confirm"
        onConfirm={() => (dialog === null ? Promise.resolve() : send(dialog))}
        onCancel={() => setDialog(null)}
      />
    </section>
  );
}
