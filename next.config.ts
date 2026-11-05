import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The knowledge base is read from disk at runtime, so Vercel has to be told
  // to ship the /knowledge folder alongside the API route.
  outputFileTracingIncludes: {
    "/api/chat": ["./knowledge/**/*"],
  },
  async headers() {
    return [
      {
        // Keep this short so widget fixes reach Babson's pages within the hour.
        source: "/widget.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600" }],
      },
    ];
  },
};

export default nextConfig;
