'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function TakeExamSubmittedPage() {
  const params = useParams()
  const examId = params.examId as string

  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState<{ total: number; max: number } | null>(null)
  const [showScore, setShowScore] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const lookupRes = await fetch(`/api/org-exam-lookup?examId=${examId}`)
      const lookupData = await lookupRes.json()
      setShowScore(!!lookupData.showScoreToRespondent)

      const { data: session } = await supabase
        .from('org_exam_sessions')
        .select('total_score, max_possible_score')
        .eq('org_exam_id', examId)
        .eq('auth_user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (session && session.total_score !== null) {
        setScore({ total: session.total_score, max: session.max_possible_score })
      }
      setLoading(false)
    }
    load()
  }, [examId])

  return (
    <div className="page-container" style={{ maxWidth: 480 }}>
      <div className="card" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <h1 style={{ marginBottom: 8 }}>Submitted</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Thank you — your response has been recorded.</p>
        {!loading && showScore && score && (
          <p style={{ marginTop: 16, fontSize: 18, fontWeight: 700 }}>
            You scored {score.total} / {score.max}
          </p>
        )}
      </div>
    </div>
  )
}
