/** True on Vercel serverless — use lighter extraction to avoid timeouts/OOM. */
export function isServerlessEnvironment(): boolean {
  return (
    process.env.VERCEL === "1" ||
    process.env.BLACKLIGHT_LIGHT_SCAN === "true"
  );
}

export function appOrigin(): string {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
