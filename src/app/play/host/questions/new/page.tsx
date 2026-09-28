'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import QuestionForm, { Facet } from '../QuestionForm'

export default function NewQuestionPage() {
  const router = useRouter()
  const [facets, setFacets] = useState<Facet[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/play/host/questions?limit=0')
      .then(async (res) => {
        if (res.status === 401) { router.push('/play/login'); return }
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setFacets(data.facets)
      })
      .catch((err) => setError(err?.message || 'Something went wrong loading the form.'))
  }, [router])

  return (
    <div className="page-container" style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 className="portal-page-title" style={{ margin: 0 }}>Add a question</h1>
        <Link href="/play/host/questions" className="btn btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>Back</Link>
      </div>
      {error && <p className="banner banner-danger" role="alert">{error}</p>}
      {facets ? <QuestionForm facets={facets} /> : !error && <p>Loading…</p>}
    </div>
  )
}
