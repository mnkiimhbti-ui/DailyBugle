import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // News images come from thousands of publisher domains, so we render them
  // with a plain <img> instead of next/image (which needs a domain allowlist
  // and would spend Vercel's free image optimisation quota).
  reactStrictMode: true,
};

export default nextConfig;
