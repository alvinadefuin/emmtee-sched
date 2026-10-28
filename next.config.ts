import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The image route reads fonts from disk at runtime (they are too large for the
  // 500 KB ImageResponse bundle), so they must be traced into the deployment.
  outputFileTracingIncludes: {
    "/api/months/[ym]/image": ["./assets/fonts/**"],
  },
};

export default nextConfig;
