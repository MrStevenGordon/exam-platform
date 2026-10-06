'use client'

import { useEffect, useState } from 'react'
import { isExamInsightAvailable, loadExamInsight } from '@/lib/examInsight'
import type { InsightPayload } from '@/lib/examInsightPure'
import InsightScreen from '@/components/insight/InsightScreen'

type State = { phase: 'loading' } | { phase: 'ready'; data: InsightPayload } | { phase: 'error'; message: string }

const MESSAGES: Record<string, string> = {
  not_installed: 'Insight is not switched on for your school yet.',
  not_allowed: 'You do not have access to the Insight page for this test.',
  not_found: 'This test could not be found.',
  failed: 'Something went wrong loading Insight. Please try again.',
}

// Loads one test's Insight with the signed-in person's own login and shows it. What they may see is decided in the database.
export default function ExamInsightView({ kind, examId, backHref, backLabel }: { kind: 'direct' | 'final'; examId: string; backHref: string; backLabel: string }) {
  const [state, setState] = useState<State>({ phase: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function load() {
      const available = await isExamInsightAvailable()
      if (!available) { if (!cancelled) setState({ phase: 'error', message: MESSAGES.not_installed }); return }
      const res = await loadExamInsight(kind, examId)
      if (cancelled) return
      setState(res.ok ? { phase: 'ready', data: res.data } : { phase: 'error', message: MESSAGES[res.reason] })
    }
    load()
    return () => { cancelled = true }
  }, [kind, examId])

  if (state.phase === 'loading') return <div className="page-container" role="status" style={{ color: 'var(--text-secondary)' }}>Loading insight…</div>
  if (state.phase === 'error') {
    return (
      <div className="page-container">
        <a href={backHref} style={{ color: 'var(--text-secondary)', fontSize: 14 }}>← {backLabel}</a>
        <div className="card" role="alert" style={{ marginTop: 16 }}>{state.message}</div>
      </div>
    )
  }
  return <InsightScreen payload={state.data} backHref={backHref} backLabel={backLabel} />
}
