'use client'

import { useEffect, useRef, useState } from 'react'
import * as Sentry from '@sentry/nextjs'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: {
        sitekey: string
        callback: (token: string) => void
        'expired-callback'?: () => void
        'error-callback'?: (errorCode: string) => void
      }) => string
      reset: (widgetId: string) => void
    }
  }
}

// Renders nothing at all when no site key is configured — inert until a
// real Cloudflare Turnstile key is added, same pattern as Sentry's DSN.
//
// Cloudflare's own widget can throw internal errors that have nothing to
// do with our integration (ad-blockers, third-party-cookie restrictions,
// devtools open with the debugger disabled — Turnstile's 600xxx "generic
// challenge failure" family). Without an error-callback these become an
// uncaught exception *and* leave the visitor stuck: the submit button
// isn't gated on having a token, so they'd hit a dead-end "Verification
// failed" response with no way through. One silent retry, then a visible
// fallback with a direct contact path instead of a dead end.
export default function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const retriedRef = useRef(false)
  const [failed, setFailed] = useState(false)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey) return

    function handleError(errorCode: string) {
      onToken('')

      if (!retriedRef.current && widgetIdRef.current) {
        retriedRef.current = true
        window.turnstile?.reset(widgetIdRef.current)
        return
      }

      setFailed(true)
      Sentry.captureMessage(`Turnstile widget failed after retry (code ${errorCode})`, { level: 'warning' })
    }

    function render() {
      if (containerRef.current && window.turnstile) {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey!,
          callback: (token) => {
            setFailed(false)
            onToken(token)
          },
          'expired-callback': () => onToken(''),
          'error-callback': handleError,
        })
      }
    }

    if (window.turnstile) {
      render()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async = true
    script.onload = render
    document.head.appendChild(script)

    return () => {
      script.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey])

  if (!siteKey) return null

  return (
    <div style={{ margin: '12px 0' }}>
      <div ref={containerRef} />
      {failed && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
          Verification didn&apos;t load. Try disabling browser extensions or ad blockers, or email us
          directly at <a href="mailto:sales@smartassessja.com">sales@smartassessja.com</a>.
        </p>
      )}
    </div>
  )
}
