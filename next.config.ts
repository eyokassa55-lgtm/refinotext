import type { NextConfig } from "next";
import path from "path";

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
};

export default nextConfig;
