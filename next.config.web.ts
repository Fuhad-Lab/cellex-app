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
  // cacheComponents: keeps up to 3 previously-visited pages alive in RAM
  // (via React's <Activity> component) instead of unmounting them on navigation.
  // This preserves all component state, form inputs, and scroll position
  // strictly in browser memory — no localStorage/sessionStorage, so it is
  // XSS-safe. Solves the "pages are not saved when I leave and come back" UX issue.
  cacheComponents: true,
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
