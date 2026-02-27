import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["gtfs-realtime-bindings"],

  // Disable client-side Router Cache staleness
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 30, // minimum allowed value
    },
  },
};

export default nextConfig;
