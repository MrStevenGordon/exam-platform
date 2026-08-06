'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import './globals.css'

// Fires only when the root layout itself throws (error.tsx can't catch
// that, since it lives inside the layout it would need to replace) — has
// to render its own <html>/<body> since the real root layout is the thing
// that crashed.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div style={{ maxWidth: 460, margin: '60px auto', padding: '0 20px' }}>
          <div className="card">
            <h1 style={{ marginBottom: 8 }}>Something went wrong</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 20 }}>
              We&apos;ve been notified and are looking into it. You can try again, or come back in a moment.
            </p>
            <button onClick={retry} className="btn btn-primary" style={{ width: '100%' }}>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
