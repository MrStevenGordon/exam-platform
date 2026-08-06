import * as Sentry from '@sentry/nextjs'
import { initRageClickDetection } from '@/lib/rageClickDetector'

// Error-biased replay: no baseline recording of clean sessions
// (replaysSessionSampleRate: 0), but every user gets a full replay of the
// ~60s leading up to any error (replaysOnErrorSampleRate: 1) — masking/
// media-blocking defaults stay on, since this handles student exam data.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.replayIntegration()],
})

initRageClickDetection()

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
