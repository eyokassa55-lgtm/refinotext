import type { NextConfig } from "next";
import path from "path";

const indexRobots = [{ key: "X-Robots-Tag", value: "index, follow" }];
const noindexRobots = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingIncludes: {
    "/api/humanize": ["./data/training_data.jsonl"],
  },
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "@google/genai",
    "google-auth-library",
    "ws",
  ],
  // Hide the Vercel/Next.js floating dev badge in the browser.
  devIndicators: false,
  async headers() {
    return [
      { source: "/", headers: indexRobots },
      { source: "/pricing", headers: indexRobots },
      { source: "/pricing/:path*", headers: indexRobots },
      { source: "/contact", headers: indexRobots },
      { source: "/contact/:path*", headers: indexRobots },
      { source: "/privacy", headers: indexRobots },
      { source: "/privacy/:path*", headers: indexRobots },
      { source: "/terms", headers: indexRobots },
      { source: "/terms/:path*", headers: indexRobots },
      { source: "/acceptable-use", headers: indexRobots },
      { source: "/acceptable-use/:path*", headers: indexRobots },
      { source: "/refunds", headers: indexRobots },
      { source: "/refunds/:path*", headers: indexRobots },
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
