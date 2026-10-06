import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // School crests are uploaded to each school's own Supabase storage; they are shown through Next's image resizer (see
  // src/components/SchoolLogo.tsx) so a large upload is not downloaded at full size on every page.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' }],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

// Silent unless SENTRY_AUTH_TOKEN is set (source-map upload during build) —
// safe to wrap even before Sentry is fully configured, since Sentry.init()
// itself is a no-op with no DSN.
//
// Requires TURBOPACK=1 at build time (see package.json's build script) even
// though `next build` already uses Turbopack by default on this Next.js
// version. @sentry/nextjs detects the active bundler by checking
// process.env.TURBOPACK / a --turbo flag, not by actually observing what
// Next.js does — without it, the plugin assumes webpack, silently skips
// enabling productionBrowserSourceMaps, and uploads nothing. No error, no
// warning, it just quietly ships without source maps.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
});
