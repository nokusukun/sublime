import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/sublime",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
