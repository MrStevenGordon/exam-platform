'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { examNoun, nounCapital, type ExamNoun } from '@/lib/examWording'

const BACK: Record<ExamNoun, { href: string; label: string }> = {
  task: { href: '/student/tasks', label: 'Back to my tasks' },
  test: { href: '/student/tests', label: 'Back to my tests' },
  exam: { href: '/student', label: 'Back to my exams' },
}

export default function SubmittedPage() {
  const params = useParams()
  const [noun, setNoun] = useState<ExamNoun>('exam')

  useEffect(() => {
    let alive = true
    supabase.from('draft_exams').select('exam_kind').eq('id', params.id as string).maybeSingle().then(({ data }) => {
      if (alive && data) setNoun(examNoun(data.exam_kind))
    })
    return () => { alive = false }
  }, [params.id])

  return (
    <div className="page-container" style={{ maxWidth: 480, textAlign: 'center' }}>
      <div className="card" style={{ background: 'var(--success-bg)' }}>
        <h1 style={{ color: 'var(--success)' }}>{nounCapital(noun)} submitted</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Your answers have been recorded.</p>
        <Link href={BACK[noun].href}>
          <button className="btn btn-primary" style={{ marginTop: 16 }}>{BACK[noun].label}</button>
        </Link>
      </div>
    </div>
  )
}
