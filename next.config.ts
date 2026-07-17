import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    TZ: "America/Los_Angeles",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
