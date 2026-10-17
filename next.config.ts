import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The OAuth callback URL carries a one-time code; keep it out of the dev request log.
  logging: { incomingRequests: { ignore: [/^\/auth\/callback/] } },
};

export default nextConfig;
