import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LiveProvider } from "../lib/live/live-provider.tsx";
import "./globals.css";

export const metadata: Metadata = {
  title: "Catarman SMART Traffic Light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LiveProvider>{children}</LiveProvider>
      </body>
    </html>
  );
}
