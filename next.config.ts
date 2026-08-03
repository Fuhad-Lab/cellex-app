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
  // cacheComponents DISABLED — it conflicts with GlobalStateProvider.
  //
  // cacheComponents keeps up to ~3 pages alive by wrapping each page (including
  // its layout subtree) in React's <Activity> component. This means each cached
  // page gets its OWN instance of GlobalStateProvider, so the in-memory store
  // is NOT shared across pages — defeating the whole point of lifting state
  // into the Root Layout.
  //
  // Instead, we rely on GlobalStateProvider (in layout.tsx) to hold page state
  // in a single ref that survives any number of navigation hops. The Root
  // Layout truly stays mounted (one instance) without cacheComponents, so the
  // store is shared. Memory-only, XSS-safe.
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
