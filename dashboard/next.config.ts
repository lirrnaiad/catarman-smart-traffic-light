import type { NextConfig } from "next";

// AD-9: a static export only. @stl/contracts ships TS source, so Next transpiles it.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@stl/contracts"],
  // Stops `next dev` writing a managed dashboard/AGENTS.md on every run (user, 2026-10-23).
  agentRules: false,
};

export default nextConfig;
