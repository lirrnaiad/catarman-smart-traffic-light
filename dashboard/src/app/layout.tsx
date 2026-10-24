import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Frame } from "../components/shell/frame.tsx";
import { LiveProvider } from "../lib/live/live-provider.tsx";
import "./globals.css";
import "../components/ui/motion.css";

export const metadata: Metadata = {
  title: "Catarman SMART Traffic Light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LiveProvider>
          <Frame>{children}</Frame>
        </LiveProvider>
      </body>
    </html>
  );
}
