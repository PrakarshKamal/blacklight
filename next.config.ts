import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every response. The CSP is intentionally
 * permissive for inline styles/scripts (required by Next.js + Tailwind without a
 * nonce setup); tightening it to a nonce-based policy is a sensible follow-up.
 */
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "font-src 'self' data:",
      "connect-src 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["pdf-parse", "tesseract.js", "sharp", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/scan": [
      "./public/samples/**/*",
      "./node_modules/tesseract.js/src/**/*",
      "./node_modules/tesseract.js-core/**/*",
      // tesseract.js's worker thread runs outside Next's module resolution, so
      // its own runtime deps must be force-traced into the function bundle.
      "./node_modules/bmp-js/**/*",
      "./node_modules/is-url/**/*",
      "./node_modules/node-fetch/**/*",
      "./node_modules/zlibjs/**/*",
      "./node_modules/wasm-feature-detect/**/*",
      "./node_modules/regenerator-runtime/**/*",
      "./node_modules/idb-keyval/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-*/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
