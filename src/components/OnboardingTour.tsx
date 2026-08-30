'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type TourStep = {
  // CSS selector for the real nav item to spotlight, matched against the
  // Sidebar's own <Link href="...">, so no extra markup is needed there.
  href: string
  title: string
  body: string
}

type Props = {
  // Key into profiles.onboarding_tours_seen, e.g. 'teacher'. Lets each role
  // get its own tour and "seen" flag without a new migration.
  tourKey: string
  steps: TourStep[]
}

// Spotlight product tour: dims the page and cuts a bright hole around one
// real nav item at a time, with a callout box explaining it. Shows once per
// user (tracked in profiles.onboarding_tours_seen), and only on a desktop-
// width viewport: the Sidebar collapses into a closed-by-default mobile
// drawer below 768px (see Sidebar.tsx), so nav items aren't on screen to
// spotlight there. On mobile the check is simply deferred, not skipped
// permanently: nothing is marked "seen" until the tour actually runs.
export default function OnboardingTour({ tourKey, steps }: Props) {
  const [userId, setUserId] = useState<string | null>(null)
  const [visibleSteps, setVisibleSteps] = useState<TourStep[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [ready, setReady] = useState(false)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    async function checkShouldShow() {
      if (window.innerWidth < 768) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_tours_seen')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      if (profile?.onboarding_tours_seen?.[tourKey]) return

      // Only spotlight nav items actually present for this user (e.g. Team
      // Lead Exams / Lesson Plans are conditional on school + appointment).
      const present = steps.filter((s) => document.querySelector(`a[href="${s.href}"]`))
      if (present.length === 0) return

      setUserId(user.id)
      setVisibleSteps(present)
      setReady(true)
    }
    checkShouldShow()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourKey])

  useEffect(() => {
    if (!ready || visibleSteps.length === 0) return

    function positionToStep() {
      const step = visibleSteps[stepIndex]
      const el = document.querySelector(`a[href="${step.href}"]`)
      if (!el) { setRect(null); return }
      el.scrollIntoView({ block: 'nearest' })
      setRect(el.getBoundingClientRect())
    }

    positionToStep()
    function onResize() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(positionToStep)
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [ready, stepIndex, visibleSteps])

  async function finish() {
    setReady(false)
    if (!userId) return
    // Read-modify-write rather than a blind overwrite, so completing this
    // tour never clobbers another tour's seen flag already on the profile.
    const { data: profile } = await supabase.from('profiles').select('onboarding_tours_seen').eq('id', userId).single()
    const next = { ...(profile?.onboarding_tours_seen || {}), [tourKey]: true }
    await supabase.from('profiles').update({ onboarding_tours_seen: next }).eq('id', userId)
  }

  if (!ready || !rect) return null

  const step = visibleSteps[stepIndex]
  const isLast = stepIndex === visibleSteps.length - 1
  const pad = 8

  // Sidebar sits on the right on desktop (the only width this ever runs
  // at, see the viewport gate above), so the callout opens to its left.
  const calloutWidth = 300
  const calloutTop = Math.min(Math.max(rect.top - 8, 16), window.innerHeight - 220)
  const calloutLeft = rect.left - calloutWidth - 20

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
      <div
        style={{
          position: 'absolute',
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          borderRadius: 10,
          boxShadow: '0 0 0 9999px rgba(20, 12, 4, 0.72)',
          border: '2px solid var(--accent)',
          pointerEvents: 'none',
          transition: 'top 0.2s ease, left 0.2s ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: calloutTop,
          left: Math.max(calloutLeft, 16),
          width: calloutWidth,
          background: 'var(--card-bg)',
          borderRadius: 12,
          padding: 18,
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          {stepIndex + 1} of {visibleSteps.length}
        </div>
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>{step.title}</div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 16px' }}>{step.body}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={finish}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}
          >
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {stepIndex > 0 && (
              <button onClick={() => setStepIndex((i) => i - 1)} className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>
                Back
              </button>
            )}
            <button
              onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))}
              className="btn btn-primary"
              style={{ fontSize: 12, padding: '6px 14px' }}
            >
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
