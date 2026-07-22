import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "export",
  typescript: { ignoreBuildErrors: false },
  reactStrictMode: false,
  images: { unoptimized: true },
};
export default nextConfig;
