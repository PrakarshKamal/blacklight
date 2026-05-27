import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["pdf-parse", "tesseract.js", "sharp"],
  outputFileTracingIncludes: {
    "/api/scan": ["./public/samples/**/*"],
  },
};

export default nextConfig;
