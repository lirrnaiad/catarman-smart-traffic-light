import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog.tsx";

function Harness({
  onConfirm = () => Promise.resolve(),
  onCancel,
}: {
  onConfirm?: () => Promise<unknown>;
  onCancel?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <ConfirmDialog
        open={open}
        title="Activate evacuation corridor NS?"
        effect="All other approaches go red."
        confirmLabel="Confirm"
        onConfirm={onConfirm}
        onCancel={() => {
          onCancel?.();
          setOpen(false);
        }}
      />
    </>
  );
}

function openDialog(): HTMLElement {
  const opener = screen.getByRole("button", { name: "Open" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

it("is a labeled modal that opens on Cancel, traps Tab and closes on Esc", () => {
  const onCancel = vi.fn();
  render(<Harness onCancel={onCancel} />);
  const opener = openDialog();

  const dialog = screen.getByRole("dialog", {
    name: "Activate evacuation corridor NS?",
  });
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  const cancel = screen.getByRole("button", { name: "Cancel" });
  const confirm = screen.getByRole("button", { name: "Confirm" });
  expect(document.activeElement).toBe(cancel);

  fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(confirm);
  fireEvent.keyDown(confirm, { key: "Tab" });
  expect(document.activeElement).toBe(cancel);

  fireEvent.keyDown(cancel, { key: "Escape" });
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(opener);
});

type Settle = (p: PromiseWithResolvers<void>) => void;
it.each<[string, Settle]>([
  ["resolves", (p) => p.resolve()],
  ["rejects", (p) => p.reject(new Error("409"))],
])(
  "Confirm runs once while pending and re-enables when it %s",
  async (_, settle) => {
    const pending = Promise.withResolvers<void>();
    const onConfirm = vi.fn(() => pending.promise);
    render(<Harness onConfirm={onConfirm} />);
    openDialog();
    const confirm = screen.getByRole<HTMLButtonElement>("button", {
      name: "Confirm",
    });

    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(confirm.disabled).toBe(true);

    await act(async () => settle(pending));
    expect(confirm.disabled).toBe(false);
  },
);

it("only one dialog can be open", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const props = {
    open: true,
    effect: "x",
    confirmLabel: "Confirm",
    onConfirm: () => Promise.resolve(),
    onCancel: () => {},
  };
  render(
    <>
      <ConfirmDialog {...props} title="First" />
      <ConfirmDialog {...props} title="Second" />
    </>,
  );
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(screen.getByRole("dialog", { name: "First" })).toBeTruthy();
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

it("Esc still cancels after Confirm is pressed, with focus kept on Cancel", () => {
  const pending = Promise.withResolvers<void>();
  const onCancel = vi.fn();
  render(<Harness onConfirm={() => pending.promise} onCancel={onCancel} />);
  openDialog();
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Cancel" }),
  );

  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("pulls focus that moves outside the panel back to Cancel", () => {
  render(<Harness />);
  const opener = openDialog();
  opener.focus();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Cancel" }),
  );
});

it("a press on the backdrop does not take focus", () => {
  render(<Harness />);
  openDialog();
  const backdrop = screen.getByRole("dialog").parentElement as HTMLElement;
  expect(fireEvent.mouseDown(backdrop)).toBe(false);
});
