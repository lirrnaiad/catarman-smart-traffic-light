"use client";

import { useState } from "react";
import { apiUrl } from "../../lib/api/client.ts";
import { stencil } from "../ui/styles.ts";

/**
 * Breach thumb (DESIGN → breach-thumb): the anonymized crop with a "BLURRED" tag,
 * or the "No crop" placeholder when `cropUrl` is null or the image fails to load.
 * 156×104 by default; a caller may size it smaller.
 */
export function CropThumb({
  cropUrl,
  width = 156,
  height = 104,
}: {
  cropUrl: string | null;
  width?: number;
  height?: number;
}) {
  // Keyed by URL, so a new crop gets a fresh try.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const show = cropUrl !== null && cropUrl !== failedUrl;
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-md border border-edge-dark ${
        show
          ? "bg-thumb-3"
          : "grid place-items-center border-[1.5px] border-dashed border-text-3 bg-surface-housing"
      }`}
      style={{ width, height }}
    >
      {show ? (
        <>
          {/* biome-ignore lint/performance/noImgElement: a static export serves API bytes as-is; next/image would need a loader. */}
          <img
            src={apiUrl(cropUrl)}
            alt="Blurred, anonymized crop"
            className="size-full object-cover"
            onError={() => setFailedUrl(cropUrl)}
          />
          <span
            aria-hidden="true"
            className={`${stencil} absolute bottom-[4px] left-[4px] rounded-xs bg-text px-[4px] text-micro text-text-inverse`}
          >
            Blurred
          </span>
        </>
      ) : (
        <span className={`${stencil} text-micro text-text-3`}>No crop</span>
      )}
    </div>
  );
}
