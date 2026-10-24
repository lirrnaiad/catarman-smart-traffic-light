"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useLive } from "../../lib/live/hooks.ts";
import { LinkHealthBar } from "./link-health-bar.tsx";
import { LiveRegion } from "./live-region.tsx";
import { Loader } from "./loader.tsx";
import { samePath, TopBar } from "./top-bar.tsx";

/** True once any slice has had its first SSE frame (`null` counts: it is a frame). */
export function useFirstFrame(): boolean {
  const slices = [
    useLive("link"),
    useLive("state"),
    useLive("counts"),
    useLive("demand"),
  ];
  return slices.some((s) => s !== undefined);
}

/** Every route's frame: loader, top bar, link bar, the content area and the live region. */
export function Frame({ children }: { children: ReactNode }) {
  const ready = useFirstFrame();
  const onLive = samePath(usePathname() ?? "/", "/");
  return (
    <LiveRegion>
      {!ready && <Loader />}
      {/* Hidden behind the loader: inert, so focus and readers can't reach it. */}
      <div inert={!ready} className="flex flex-col">
        <TopBar />
        <LinkHealthBar />
        <main
          className={`h-grid-height bg-[radial-gradient(ellipse_at_50%_42%,var(--color-surface-page-hi)_0%,var(--color-surface-page)_72%)] ${onLive ? "overflow-hidden" : "overflow-y-auto"}`}
        >
          {children}
        </main>
      </div>
    </LiveRegion>
  );
}
