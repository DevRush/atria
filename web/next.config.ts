import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray parent lockfile doesn't confuse Turbopack.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
