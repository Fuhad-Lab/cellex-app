import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Strict TypeScript — fail the build on missing imports / type errors.
  // This catches bugs like the "Sparkles not imported" crash at build time
  // instead of letting them hit production.
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // cacheComponents DISABLED — conflicts with GlobalStateProvider.
  // See next.config.ts for full explanation.
  // cacheComponents: true,
  // Allow running behind Hugging Face Spaces reverse proxy.
  experimental: {
    serverActions: {
      allowedOrigins: ['*.hf.space', '*.space-z.ai'],
    },
  },
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;
