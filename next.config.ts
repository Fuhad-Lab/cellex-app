import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // cacheComponents DISABLED — conflicts with GlobalStateProvider.
  // cacheComponents: true,
  experimental: {
    serverActions: {
      allowedOrigins: ['*.hf.space', '*.space-z.ai'],
    },
  },
  compress: true,
  poweredByHeader: false,
  // === SECURITY HEADERS ===
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // HSTS — force HTTPS for 1 year, include subdomains
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // X-Content-Type-Options — prevent MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // X-Frame-Options — prevent clickjacking
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Referrer-Policy — control referrer leakage
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Permissions-Policy — restrict powerful browser features
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=(), payment=()' },
          // Content-Security-Policy — prevent XSS and injection attacks
          { key: 'Content-Security-Policy', value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https: blob:",
            "media-src 'self' https: blob:",
            "connect-src 'self' https://*.supabase.co https://*.onrender.com https://*.space-z.ai https://*.hf.space https://integrate.api.nvidia.com",
            "frame-ancestors 'self'",
            "base-uri 'self'",
            "form-action 'self'",
          ].join('; ') },
        ],
      },
    ];
  },
};

export default nextConfig;
