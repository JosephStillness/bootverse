import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // iCloud must not sync regenerable build artifacts or replay conflicting type files.
  distDir: ".next.nosync",
  poweredByHeader: false,
  output: process.env.BOOTVERSE_STANDALONE === "1" ? "standalone" : undefined,
  // Release builds do not restore caches; persisted cache filenames were corrupted in this workspace.
  experimental: {turbopackFileSystemCacheForBuild:false,turbopackFileSystemCacheForDev:false},
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // Prevent email callback tokens and public body information entering referrer logs.
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Inline Next scripts remain supported; a nonce-based script policy needs a separate rollout.
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'; frame-src https://www.youtube-nocookie.com",
          },
        ],
      },
    ];
  },
  // Email callback URLs contain one-time tokens; keep them out of dev access logs.
  logging: { incomingRequests: { ignore: [/\/api\/auth\//] } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
