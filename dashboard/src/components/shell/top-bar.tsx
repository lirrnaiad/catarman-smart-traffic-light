"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { focusRing, stencil } from "../ui/styles.ts";
import { UnlitHead } from "./loader.tsx";

export const NAV = [
  { href: "/", label: "Live" },
  { href: "/traffic/", label: "Traffic peaks" },
  { href: "/breaches/", label: "Breaches" },
  { href: "/log/overrides/", label: "Override log" },
  { href: "/log/states/", label: "State history" },
] as const;

/** `/traffic` and `/traffic/` are the same route. */
export function samePath(a: string, b: string): boolean {
  const norm = (p: string) => p.replace(/\/+$/, "") || "/";
  return norm(a) === norm(b);
}

/** Brand, INT-01 plate and the five nav tabs (DESIGN.md → Top bar). */
export function TopBar() {
  const pathname = usePathname() ?? "/";
  return (
    <header className="flex h-topbar-height shrink-0 items-center justify-between border-b-2 border-edge-dark bg-linear-to-b from-surface-housing-hi to-surface-housing-lo px-page-margin">
      <div className="flex items-center gap-[18px]">
        {/* The one decorative use of tinted glass: an unlit head. */}
        <UnlitHead size={13} />
        <div>
          <div className={`${stencil} text-title-brand`}>
            Catarman SMART Traffic Light
          </div>
          <div className={`${stencil} mt-[7px] text-label-sub text-text-3`}>
            Edge-only adaptive signal · Catarman, Northern Samar
          </div>
        </div>
        <div
          className={`${stencil} ml-[8px] flex flex-col rounded border border-edge-dark bg-linear-to-b from-surface-plate-hi to-surface-plate px-[16px] pt-[6px] pb-[7px] text-text shadow-[0_3px_0_var(--color-edge-dark)]`}
        >
          <span className="text-[11px] font-bold tracking-[0.22em] text-text-2">
            Intersection
          </span>
          <b className="text-[30px] leading-none font-extrabold tracking-[0.06em]">
            INT-01
          </b>
        </div>
      </div>
      <nav aria-label="Main" className="flex h-[54px] gap-[8px]">
        {NAV.map(({ href, label }) => {
          const current = samePath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={current ? "page" : undefined}
              className={`${stencil} ${focusRing} flex items-center rounded-md border border-edge-dark px-[22px] text-label-tab no-underline ${
                current
                  ? "bg-text text-text-inverse shadow-[inset_0_-4px_0_color-mix(in_srgb,var(--color-edge-dark)_22%,transparent),0_3px_0_var(--color-edge-dark)]"
                  : "bg-linear-to-b from-surface-housing-hi to-surface-housing text-text-2 shadow-[0_3px_0_var(--color-edge-dark)]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
