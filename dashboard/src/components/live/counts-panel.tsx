"use client";

import { Approach } from "@stl/contracts";
import { useLive } from "../../lib/live/hooks.ts";
import { manilaHourLabel } from "../../lib/time.ts";
import { useVehicleClasses } from "../../lib/use-vehicle-classes.ts";
import { classLabelParts, softHyphenate } from "../../lib/visuals.ts";
import { ClassLabel } from "../ui/class-label.tsx";
import { stencil } from "../ui/styles.ts";
import { NoData, Panel } from "./panel.tsx";

/** CAP-3's hour counts from the `counts` slice: approach × class, then the hour total as sent. */
export function CountsPanel() {
  const counts = useLive("counts");
  const classes = useVehicleClasses().classes ?? [];
  const ids = counts
    ? [
        ...new Set([
          ...classes.map((c) => c.id),
          ...Approach.options.flatMap((a) => Object.keys(counts.byApproach[a])),
        ]),
      ]
    : [];
  // A label's aside ("(incl. habal-habal)") moves to a footnote, so each header fits its column.
  let marks = 0;
  const columns = ids.map((id) => {
    const full = classes.find((c) => c.id === id)?.label ?? id;
    const { short, note } = classLabelParts(full);
    const mark = note ? "*".repeat(++marks) : "";
    return {
      id,
      full,
      head: softHyphenate(short) + mark,
      foot: note && `${mark} ${note}`,
    };
  });
  return (
    // The right column's flexible panel: its rows give up height so the override panel below
    // can keep its content height (user, 2026-10-26).
    <Panel
      title="Vehicle counts this hour"
      tag={counts ? `Since ${manilaHourLabel(counts.hourStart)}` : "This hour"}
      of="vision"
      className="min-h-0 flex-1"
    >
      {counts ? (
        <>
          <div className="min-h-0 flex-1 overflow-hidden">
            <table
              className={`${stencil} h-full w-full table-fixed border-separate border-spacing-y-[3px] font-extrabold`}
            >
              <thead>
                <tr className="text-[12.5px] leading-[1.15] tracking-normal text-text-3">
                  <th className="w-[36px] pb-[2px] pl-[8px] text-left align-bottom">
                    Appr.
                  </th>
                  {/* The chip sits under its label, so the chips line up in one row above the numbers. */}
                  {columns.map(({ id, full, head }) => (
                    <th
                      key={id}
                      aria-label={full}
                      className="px-[2px] pb-[2px] text-right align-bottom hyphens-auto [&>span]:flex-col-reverse [&>span]:items-end [&>span]:gap-[3px]"
                    >
                      <ClassLabel id={id} classes={classes} label={head} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Approach.options.map((a) => (
                  <tr key={a} className="bg-surface-recess">
                    <th
                      scope="row"
                      className="rounded-l-[5px] pl-[12px] text-left text-[26px] leading-none shadow-[inset_4px_0_0_var(--color-surface-plate)]"
                    >
                      {a}
                    </th>
                    {ids.map((id) => {
                      const n = counts.byApproach[a][id] ?? 0;
                      return (
                        <td
                          key={id}
                          className={`h-[30px] px-[4px] text-right text-numeral-count leading-none tabular-nums last:rounded-r-[5px] ${n === 0 ? "text-text-3" : ""}`}
                        >
                          {n}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-[8px] flex items-center justify-between rounded-md border border-edge-dark bg-linear-to-b from-surface-plate-hi to-surface-plate px-[16px] py-[6px] font-extrabold shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-text)_10%,transparent),0_3px_0_var(--color-edge-dark)]">
            <span
              className={`${stencil} text-[17px] leading-[1.2] tracking-[0.14em] text-text-2`}
            >
              Hour total
              <small className="block text-[12px] text-text-3">
                All approaches, all classes
              </small>
            </span>
            <span className="text-display-total tabular-nums">
              {counts.total}
            </span>
          </div>
          {columns.map(
            ({ id, foot }) =>
              foot && (
                <p
                  key={id}
                  className={`${stencil} mx-[2px] mt-[4px] text-micro leading-none text-text-3`}
                >
                  {foot}
                </p>
              ),
          )}
        </>
      ) : (
        <NoData />
      )}
    </Panel>
  );
}
