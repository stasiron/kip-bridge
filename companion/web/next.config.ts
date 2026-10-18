import type { NextConfig } from "next";

/**
 * Static export so the same build can be:
 * - served by the local bridge on one origin with the WebSocket, and
 * - hosted on Vercel as a landing page.
 * There is no server runtime here. The page must not call a private LAN address.
 */
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
