import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Derived rather than hardcoded so a different Supabase project doesn't
// silently have its auth calls blocked.
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "";

// 'unsafe-inline' is unavoidable for scripts here: Next inlines its own
// hydration bootstrap, and the theme script in the root layout has to run
// before first paint. Locking it down properly needs per-request nonces,
// which would force every static page to render dynamically — a poor trade
// for a site that is almost entirely static content. The directives that do
// not depend on nonces are still worth setting, so they are set strictly.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://accounts.google.com${
    isProd ? "" : " 'unsafe-eval'"
  }`,
  // Google Identity Services pulls its button stylesheet from this origin.
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data:",
  "font-src 'self' data:",
  // 'self' does not cover the ws: scheme, which dev HMR needs.
  `connect-src 'self' https://accounts.google.com${
    supabaseOrigin ? ` ${supabaseOrigin}` : ""
  }${isProd ? "" : " ws://localhost:* ws://127.0.0.1:*"}`,
  // Google Identity Services renders its account chooser in an iframe.
  "frame-src https://accounts.google.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  // Omitted in development, where it would rewrite http://localhost to https.
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Legacy companion to frame-ancestors, for older browsers.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
