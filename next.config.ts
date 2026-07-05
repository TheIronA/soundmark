import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Pin the workspace root so a stray lockfile in a parent dir doesn't get
  // mistaken for the project root.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
