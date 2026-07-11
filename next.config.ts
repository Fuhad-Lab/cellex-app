import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false,
  // HF Spaces reverse proxy terminates TLS — trust the upstream so cookies and absolute URLs work
  experimental: {
    // Allow running behind Hugging Face Spaces reverse proxy
    serverActions: {
      allowedOrigins: ['*.hf.space', '*.space-z.ai'],
    },
  },
  // Compress responses (HF Space reverse proxy may or may not gzip)
  compress: true,
  // HF Space sets PORT env; respect it
  poweredByHeader: false,
};

export default nextConfig;
