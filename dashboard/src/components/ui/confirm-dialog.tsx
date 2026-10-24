"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { focusRing, hazardStripes, stencil } from "./styles.ts";

type Props = {
  open: boolean;
  title: string;
  /** The sentence-case effect line, e.g. "All other approaches go red." */
  effect: ReactNode;
  confirmLabel: string;
  /** Confirm stays disabled until this settles; a rejection is the caller's to show. */
  onConfirm: () => Promise<unknown>;
  onCancel: () => void;
};

// Modals stack one level deep (EXPERIENCE → Information Architecture): the first open dialog owns the screen.
let owner: string | null = null;

const button = `${stencil} h-[60px] rounded-md border border-edge-dark text-[21px] font-extrabold tracking-[0.14em] ${focusRing} disabled:opacity-55`;

/** Modal, focus-trapped confirmation. Cancel holds focus on open; Esc equals Cancel. */
export function ConfirmDialog({
  open,
  title,
  effect,
  confirmLabel,
  onConfirm,
  onCancel,
}: Props) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(onCancel);
  useEffect(() => {
    cancelRef.current = onCancel;
  });

  useEffect(() => {
    if (!open) return;
    if (owner !== null) {
      console.warn("[ui] ConfirmDialog: another dialog is already open");
      return;
    }
    owner = id;
    setShown(true);
    return () => {
      owner = null;
      setShown(false);
    };
  }, [open, id]);

  useEffect(() => {
    if (!shown) return;
    const before = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    // Document-level, so Esc and the Tab trap work wherever focus is.
    const onKeyDown = (e: KeyboardEvent) => {
      const box = panel.current;
      if (e.key === "Escape") {
        e.preventDefault();
        cancelRef.current();
        return;
      }
      if (e.key !== "Tab" || !box) return;
      const items = [
        ...box.querySelectorAll<HTMLElement>("button:not(:disabled)"),
      ];
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !box.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first?.focus();
      }
    };
    // Focus that lands outside the panel is pulled back to Cancel.
    const onFocusIn = (e: FocusEvent) => {
      if (!panel.current?.contains(e.target as Node)) cancel.current?.focus();
    };
    // A press on the backdrop never takes focus away from the panel.
    const onMouseDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node)) e.preventDefault();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      // Listeners go first, so restoring focus outside isn't pulled back.
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("mousedown", onMouseDown);
      before?.focus();
    };
  }, [shown]);

  if (!shown) return null;

  function confirm() {
    if (busy.current) return;
    busy.current = true;
    // Confirm is about to disable; keep focus in the panel, on the safe choice.
    cancel.current?.focus();
    setPending(true);
    onConfirm()
      .catch(() => {})
      .finally(() => {
        busy.current = false;
        setPending(false);
      });
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-edge-dark/78">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="w-[446px] overflow-hidden rounded-lg border border-edge-dark bg-linear-to-b from-surface-housing-hi to-surface-housing-lo shadow-[0_6px_0_var(--color-edge-dark),0_30px_60px_color-mix(in_srgb,var(--color-edge-dark)_70%,transparent)]"
      >
        <div
          className={`h-[18px] border-b-2 border-edge-dark ${hazardStripes}`}
        />
        <div className="px-[24px] pt-[18px] pb-[22px]">
          <div
            className={`${stencil} flex items-center gap-[8px] text-[13px] font-extrabold tracking-[0.16em] text-text-2`}
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="size-[16px] fill-none stroke-current stroke-[1.8]"
            >
              <rect x="4" y="9" width="12" height="9" rx="1.5" />
              <path d="M7 9V6.5a3 3 0 0 1 6 0V9" />
            </svg>
            MDRRMO override · confirm
          </div>
          <h2
            id={`${id}-title`}
            className={`${stencil} mt-[10px] mb-[16px] text-headline-dialog`}
          >
            {title}
          </h2>
          <div className="rounded-md border border-edge-dark bg-surface-recess p-[14px] text-body-dialog font-body">
            <p className="m-0">{effect}</p>
            <p
              className={`${stencil} mt-[6px] text-[15px] font-extrabold tracking-[0.14em] text-text-2`}
            >
              MDRRMO only.
            </p>
          </div>
          <div className="mt-[20px] grid grid-cols-2 gap-[12px]">
            <button
              ref={cancel}
              type="button"
              onClick={onCancel}
              className={`${button} bg-linear-to-b from-surface-plate-hi to-surface-plate text-text shadow-[0_4px_0_var(--color-edge-dark)]`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={pending}
              className={`${button} ${hazardStripes} bg-hazard-paint bg-size-[16px_100%] bg-no-repeat pl-[18px] text-text-inverse shadow-[0_4px_0_var(--color-edge-dark)]`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
