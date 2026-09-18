'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BoardState } from '@/lib/playBoard'

// Polls the board state about once a second (local stand-in for a realtime
// channel). The server owns the phase and the buzz window; the browser renders
// what it is told and counts down between polls.
export function useBoardState(code: string) {
  const router = useRouter()
  const [state, setState] = useState<BoardState | null>(null)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const receivedAt = useRef(Date.now())
  const stopped = useRef(false)

  const fetchOnce = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/play/board/${code}`, { cache: 'no-store' })
      if (res.status === 401) { router.push('/play/login'); return false }
      if (res.status === 404) { setError('This game was not found, or you are not part of it.'); return false }
      if (!res.ok) return true
      const data: BoardState = await res.json()
      receivedAt.current = Date.now()
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
      if (keepGoing && !stopped.current) timer = setTimeout(loop, 1000)
    }
    loop()
    return () => { stopped.current = true; clearTimeout(timer) }
  }, [fetchOnce])

  const running = state?.game.status === 'clue'
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [running])

  const msLeft = state?.game.msRemaining == null ? null : Math.max(0, state.game.msRemaining - (now - receivedAt.current))
  return { state, error, msLeft, refresh: fetchOnce }
}
