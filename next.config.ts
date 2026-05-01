import type { NextConfig } from "next";

/** Explicit hosts — `hostname: "**"` can break picomatch / the image optimizer in some environments (500 on `/_next/image`). */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** Admin JSON must never be cached by browsers or intermediaries — avoids stale lists after mutations. */
  async headers() {
    return [
      {
        source: "/api/admin/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" }]
      }
    ];
  },
  images: {
    /** Avoid Sharp / `/_next/image` — fixes HTTP 500 when the optimizer fails (Windows, low memory, broken sharp). */
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "kits.roxthemes.com",
        pathname: "/kickstar/**"
      }
    ]
  }
};

export default nextConfig;
