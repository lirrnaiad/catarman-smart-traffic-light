import type { NextConfig } from "next";

// AD-9: a static export only. @stl/contracts ships TS source, so Next transpiles it.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: ["@stl/contracts"],
};

export default nextConfig;
