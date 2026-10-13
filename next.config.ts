import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
