import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

// `output: "standalone"` adalah syarat Prisma Compute, tetapi di Vercel output
// ini justru dapat memicu kegagalan build (Vercel punya pipeline sendiri).
// Jadi: standalone hanya di luar Vercel, dan dibiarkan default saat di Vercel.
const isVercel = !!process.env.VERCEL;

const nextConfig: NextConfig = {
  ...(isVercel ? {} : { output: "standalone" as const }),
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  // SEC-09: header keamanan dasar untuk semua route.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "img-src 'self' data: blob:",
              "media-src 'self' blob:",
              "script-src 'self' 'unsafe-inline'",
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline'",
              "connect-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
