import type { NextConfig } from "next";
import path from "path";

const noindexRobots = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "@google/genai",
    "ws",
  ],
  // Hide the Vercel/Next.js floating dev badge in the browser.
  devIndicators: false,
  async headers() {
    return [
      { source: "/dashboard", headers: noindexRobots },
      { source: "/dashboard/:path*", headers: noindexRobots },
      { source: "/sign-in", headers: noindexRobots },
      { source: "/sign-in/:path*", headers: noindexRobots },
      { source: "/sign-up", headers: noindexRobots },
      { source: "/sign-up/:path*", headers: noindexRobots },
      { source: "/api/:path*", headers: noindexRobots },
    ];
  },
};

export default nextConfig;
