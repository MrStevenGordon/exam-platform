import * as Sentry from '@sentry/nextjs'

// A missing DSN makes this a safe no-op — nothing is sent until
// NEXT_PUBLIC_SENTRY_DSN is actually configured.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
})
