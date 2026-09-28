'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import QuestionForm, { Facet, QuestionDraft } from '../QuestionForm'

export default function EditQuestionPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<{ initial: Partial<QuestionDraft>; timesAnswered: number } | null>(null)
  const [facets, setFacets] = useState<Facet[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [qRes, fRes] = await Promise.all([fetch(`/api/play/host/questions/${id}`), fetch('/api/play/host/questions?limit=0')])
        if (qRes.status === 401 || fRes.status === 401) { router.push('/play/login'); return }
        const qj = await qRes.json()
        const fj = await fRes.json()
        if (!qRes.ok) throw new Error(qj.error)
        const q = qj.question
        setFacets(fj.facets ?? [])
        setData({
          timesAnswered: q.timesAnswered,
          initial: {
            subject: q.subject,
            topic: q.topic,
            questionType: q.questionType,
            questionText: q.questionText,
            options: q.options ?? undefined,
            correctAnswer: q.correctAnswer,
            points: q.points,
            explanation: q.explanation ?? '',
            status: q.status,
          },
        })
      } catch (err: any) {
        setError(err?.message || 'Something went wrong loading the question.')
      }
    }
    load()
  }, [id, router])

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="portal-page-title" style={{ margin: 0 }}>Edit question</h1>
        <Link href="/play/host/questions" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Back</Link>
      </div>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {data ? <QuestionForm questionId={id} initial={data.initial} facets={facets} timesAnswered={data.timesAnswered} /> : !error && <p>Loading…</p>}
    </div>
  )
}
