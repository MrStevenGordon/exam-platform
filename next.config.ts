import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
};

// Silent unless SENTRY_AUTH_TOKEN is set (source-map upload during build) —
// safe to wrap even before Sentry is fully configured, since Sentry.init()
// itself is a no-op with no DSN.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
});
