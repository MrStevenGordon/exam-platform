'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LiveState } from '@/lib/playLive'

// Polls the live game state. This is the stand-in for a realtime channel: the server decides the phase
// and the timer, and the browser just renders what it is told and counts down between polls.
// It asks about every 2 seconds, and once more just after a question's time is due to run out so the
// answer appears promptly. (One class playing is then about 15 requests a second instead of 30.)
const POLL_MS = 2000
const AFTER_DEADLINE_MS = 150
const MIN_POLL_MS = 250
export function useLiveState(code: string) {
  const router = useRouter()
  const [state, setState] = useState<LiveState | null>(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const receivedAt = useRef(Date.now())
  const stopped = useRef(false)
  const lastMsRemaining = useRef<number | null>(null)

  const fetchOnce = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/play/live/${code}`, { cache: 'no-store' })
      if (res.status === 401) { router.push('/play/login'); return false }
      if (res.status === 404) { setError('This game was not found, or you are not part of it.'); return false }
      if (!res.ok) return true
      const data: LiveState = await res.json()
      receivedAt.current = Date.now()
      lastMsRemaining.current = data.game.status === 'question' ? data.game.msRemaining : null
      setNow(Date.now())
      setState(data)
      setError('')
      return data.game.status !== 'ended'
    } catch {
      return true
    }
  }, [code, router])

  useEffect(() => {
    stopped.current = false
    let timer: ReturnType<typeof setTimeout>
    const loop = async () => {
      const keepGoing = await fetchOnce()
      if (keepGoing && !stopped.current) {
        const left = lastMsRemaining.current == null ? null : lastMsRemaining.current - (Date.now() - receivedAt.current)
        const delay = left != null && left < POLL_MS + AFTER_DEADLINE_MS ? Math.max(MIN_POLL_MS, left + AFTER_DEADLINE_MS) : POLL_MS
        timer = setTimeout(loop, delay)
      }
    }
    loop()
    return () => { stopped.current = true; clearTimeout(timer) }
  }, [fetchOnce])

  const running = state?.game.status === 'question'
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [running])

  const msLeft = state?.game.msRemaining == null ? null : Math.max(0, state.game.msRemaining - (now - receivedAt.current))
  return { state, error, msLeft, refresh: fetchOnce }
}
