import * as Sentry from '@sentry/nextjs'

// Sentry's own Replay ClickDetector annotates rage/dead clicks *inside* a
// recording, but never uploads one on its own — with replaysSessionSampleRate
// at 0 (error-biased capture), a rage click with no accompanying JS
// exception would otherwise vanish with nothing to show for it. This
// listens independently, and on a rage click both flags it as its own
// Sentry event and force-flushes the buffered replay so it has evidence
// attached — the goal being to see the UX failure before the user has to
// file a support ticket about it.

const INTERACTIVE_SELECTOR = 'button, a, [role="button"], input[type="submit"], input[type="button"]'
const WINDOW_MS = 1200
const THRESHOLD = 3
const COOLDOWN_MS = 10_000

type ClickState = { count: number; firstTs: number; lastFlaggedAt: number }

let started = false
const clickState = new WeakMap<Element, ClickState>()

function describeElement(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const label = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || ''
  const id = el.id ? `#${el.id}` : ''
  return [tag, id, label].filter(Boolean).join(' ')
}

function flagRageClick(el: Element, count: number) {
  const description = describeElement(el)

  Sentry.captureMessage(`Rage click: ${description || 'unlabeled element'}`, {
    level: 'warning',
    tags: { ux_failure: 'rage_click' },
    extra: {
      clickCount: count,
      url: window.location.href,
      elementDescription: description,
    },
  })

  // Force-upload whatever replay buffer exists right now so the flagged
  // event has a replay attached, even though no exception was thrown.
  void Sentry.getReplay()?.flush().catch(() => {})
}

export function initRageClickDetection() {
  if (started || typeof window === 'undefined') return
  started = true

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target : null
      const el = target?.closest(INTERACTIVE_SELECTOR) || target
      if (!el) return

      const now = Date.now()
      const existing = clickState.get(el)

      if (!existing || now - existing.firstTs > WINDOW_MS) {
        clickState.set(el, { count: 1, firstTs: now, lastFlaggedAt: existing?.lastFlaggedAt || 0 })
        return
      }

      const count = existing.count + 1
      existing.count = count

      if (count >= THRESHOLD && now - existing.lastFlaggedAt > COOLDOWN_MS) {
        flagRageClick(el, count)
        existing.lastFlaggedAt = now
        existing.count = 0
        existing.firstTs = now
      }
    },
    { capture: true, passive: true }
  )
}
