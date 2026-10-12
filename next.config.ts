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
};

export default nextConfig;
