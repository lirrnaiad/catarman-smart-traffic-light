"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const AnnounceContext = createContext<(text: string) => void>(() => {});

/** Long enough for a screen reader to see the region cleared before the new text lands. */
export const ANNOUNCE_DELAY_MS = 100;

/** The layout's one polite live region; `useAnnounce()` speaks through it. */
export function LiveRegion({ children }: { children: ReactNode }) {
  const [text, setText] = useState("");
  const queue = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const announce = useCallback((t: string) => {
    // Several badges for one role announce the same change; read it once.
    if (queue.current.includes(t)) return;
    queue.current.push(t);
    if (queue.current.length > 1) return; // joins the text already pending
    // Clear first, so a repeat of the same text is a change and is re-read.
    setText("");
    timer.current = setTimeout(() => {
      setText(queue.current.join(". "));
      queue.current = [];
    }, ANNOUNCE_DELAY_MS);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <AnnounceContext value={announce}>
      {children}
      <div aria-live="polite" className="sr-only">
        {text}
      </div>
    </AnnounceContext>
  );
}

/** Returns `announce(text)`, a stable function that reads `text` out politely. */
export function useAnnounce(): (text: string) => void {
  return useContext(AnnounceContext);
}
