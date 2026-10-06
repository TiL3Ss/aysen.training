import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16.2+ logs Server Function arguments in development by default.
  // This app passes credentials to login/register/password actions, so keep them out of terminal logs.
  logging: { serverFunctions: false },
  experimental: {
    // Leave headroom below Vercel Functions' 4.5 MB request ceiling.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
