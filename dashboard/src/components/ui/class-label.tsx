import type { VehicleClass } from "@stl/contracts";
import { classColor, colorVar } from "../../lib/visuals.ts";

/** A vehicle class's label from the file, or the raw id when unknown, with its class chip. */
export function ClassLabel({
  id,
  classes,
}: {
  id: string;
  classes: readonly VehicleClass[];
}) {
  const label = classes.find((c) => c.id === id)?.label ?? id;
  const token = classColor(id, classes);
  return (
    <span className="inline-flex items-center gap-[6px]">
      <span
        aria-hidden="true"
        data-token={token}
        className="inline-block size-[10px] shrink-0 rounded-xs"
        style={{ background: colorVar(token) }}
      />
      {label}
    </span>
  );
}
