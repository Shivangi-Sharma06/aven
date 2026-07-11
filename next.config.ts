import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Handle Buffer polyfill for Stellar SDK in the browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      buffer: "buffer",
      stream: false,
      crypto: false,
    };
    return config;
  },
};

export default nextConfig;
