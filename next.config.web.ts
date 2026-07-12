import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow running behind Hugging Face Spaces reverse proxy
  experimental: {
    serverActions: {
      allowedOrigins: ['*.hf.space', '*.space-z.ai'],
    },
  },
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;
